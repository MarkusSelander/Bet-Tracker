import asyncio
import csv
import io
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, Response
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict
from pymongo.errors import ConnectionFailure, OperationFailure, ServerSelectionTimeoutError
from starlette.middleware.cors import CORSMiddleware

from auth_cookies import use_cross_site_cookies
from coolbet import map_coolbet_ticket
from coolbet_sync import CHROME_EXTENSION_ORIGIN_RE, login_payload, resolve_last_coolbet_sync_at
from mongo import mongo_client_kwargs
from odds_client import OddsApiError, OddsClient, TTL_MARKETS, TTL_ODDS, TTL_SCORES, TTL_SPORTS, default_http_get, preferred_odds_fetch_error
from odds_logic import (
    best_h2h,
    favorite_matches,
    favorite_sport_keys,
    filter_matches,
    map_event_markets,
    merge_sport_fetch_results,
    normalize_event,
    search_event_sport_keys,
    search_leagues_and_teams,
    sport_tab_keys,
)
from stats import (
    bets_mongo_query,
    build_analytics_summary,
    build_chart_data,
    chart_date_bounds,
    compute_breakdown,
    compute_odds_range_breakdown,
    compute_stats,
    filter_bets,
)
from pymongo import InsertOne, ReplaceOne
from starlette.middleware.gzip import GZipMiddleware
from ttl_cache import SessionCache, TtlLruCache

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url, **mongo_client_kwargs(mongo_url))
db = client[os.environ['DB_NAME']]
is_production = use_cross_site_cookies()
odds_client = OddsClient(api_key=os.environ.get("ODDS_API_KEY", ""), http_get=default_http_get)
session_cache = SessionCache(ttl_seconds=15)
sportsdb_cache = TtlLruCache(maxsize=512, ttl_seconds=86_400)
sportsdb_http = httpx.AsyncClient(timeout=3.0)

app = FastAPI()
api_router = APIRouter(prefix="/api")

# TheSportsDB API configuration
SPORTSDB_API_KEY = "3"  # Free tier key
SPORTSDB_BASE_URL = "https://www.thesportsdb.com/api/v1/json"

LIST_PROJECTION = {"_id": 0, "legs": 0}
FULL_PROJECTION = {"_id": 0}


def bet_projection(include_legs: bool) -> dict:
    return FULL_PROJECTION if include_legs else LIST_PROJECTION


async def query_sportsdb_team(team_name: str) -> Optional[str]:
    """
    Query TheSportsDB API to find team information and determine sport.
    Returns sport name or None if not found.
    """
    if not team_name:
        return None

    # Check cache first
    cache_key = team_name.lower().strip()
    cached, hit = sportsdb_cache.get(cache_key)
    if hit:
        return cached

    try:
        response = await sportsdb_http.get(
            f"{SPORTSDB_BASE_URL}/{SPORTSDB_API_KEY}/searchteams.php",
            params={"t": team_name}
        )

        if response.status_code == 200:
            data = response.json()
            teams = data.get("teams")

            if teams and len(teams) > 0:
                # Get the first match
                team = teams[0]
                sport = team.get("strSport", "").strip()

                # Map TheSportsDB sport names to our sport categories
                sport_mapping = {
                    "Soccer": "Football",
                    "Basketball": "Basketball",
                    "Ice Hockey": "Ice Hockey",
                    "American Football": "American Football",
                    "Baseball": "Baseball",
                    "Tennis": "Tennis",
                    "Handball": "Handball",
                    "Volleyball": "Volleyball",
                    "Esports": "Esports",
                    "Fighting": "Other",
                    "Rugby": "Other",
                    "Cricket": "Other",
                    "Golf": "Other",
                    "Motorsport": "Other",
                    "Cycling": "Other",
                    "Darts": "Other",
                    "Snooker": "Other",
                }

                result = sport_mapping.get(sport, "Other")

                sportsdb_cache.set(cache_key, result)
                return result
    except Exception as e:
        logging.warning(f"TheSportsDB API error for '{team_name}': {e}")

    sportsdb_cache.set(cache_key, None)
    return None


async def detect_sport_from_game_async(game_name: str) -> str:
    """
    Async wrapper for sport detection that uses TheSportsDB API.
    First tries API lookup, then falls back to local pattern matching.
    """
    if not game_name:
        return "Other"

    # Try to extract team names from common formats
    # Format: "Team A - Team B", "Team A vs Team B", "Team A v Team B"
    separators = [' - ', ' vs ', ' v ', ' @ ']
    teams = []

    game_clean = game_name.strip()
    for sep in separators:
        if sep in game_clean:
            parts = game_clean.split(sep)
            if len(parts) == 2:
                teams = [parts[0].strip(), parts[1].strip()]
                break

    # Try TheSportsDB API lookup for each team
    for team in teams:
        if team:
            sport = await query_sportsdb_team(team)
            if sport and sport != "Other":
                return sport

    # Fallback to local pattern matching
    return detect_sport_from_game(game_name)


# Sport detection function
def detect_sport_from_game(game_name: str) -> str:
    """
    Detect the correct sport based on the game name.
    Ignores any existing sport value and determines sport from team/player names.

    Returns one of: Football, Basketball, Tennis, Ice Hockey, Baseball, 
                   American Football, Esports, Handball, Volleyball, Other
    """
    if not game_name:
        return "Other"

    game_lower = game_name.lower()

    # Basketball - NBA teams (all 30 teams)
    basketball_nba = [
        # Atlantic Division
        'celtics', 'nets', '76ers', 'sixers', 'knicks', 'raptors',
        # Central Division
        'bulls', 'cavaliers', 'cavs', 'pistons', 'pacers', 'bucks',
        # Southeast Division
        'hawks', 'heat', 'hornets', 'magic', 'wizards',
        # Northwest Division
        'nuggets', 'timberwolves', 'thunder', 'trail blazers', 'blazers', 'jazz',
        # Pacific Division
        'warriors', 'clippers', 'lakers', 'suns', 'kings',
        # Southwest Division
        'mavericks', 'mavs', 'rockets', 'grizzlies', 'pelicans', 'spurs'
    ]

    # Basketball - EuroLeague and international
    basketball_international = [
        'real madrid', 'barcelona', 'barca', 'olympiacos', 'panathinaikos',
        'fenerbahce', 'fener', 'cska moscow', 'cska', 'zalgiris', 'kaunas',
        'maccabi', 'tel aviv', 'efes', 'anadolu efes', 'bayern munich',
        'olimpia milano', 'armani', 'virtus bologna', 'virtus', 'asvel',
        'monaco', 'baskonia', 'vitoria', 'partizan', 'red star', 'crvena zvezda'
    ]

    # Basketball - indicators
    basketball_keywords = ['nba', 'euroleague',
                           'ncaa basketball', 'march madness']

    # American Football - NFL teams (all 32 teams)
    american_football_nfl = [
        # AFC East
        'patriots', 'bills', 'dolphins', 'jets',
        # AFC North
        'ravens', 'bengals', 'browns', 'steelers',
        # AFC South
        'texans', 'colts', 'jaguars', 'jags', 'titans',
        # AFC West
        'broncos', 'chiefs', 'raiders', 'chargers',
        # NFC East
        'cowboys', 'giants', 'eagles', 'commanders', 'washington',
        # NFC North
        'bears', 'lions', 'packers', 'vikings',
        # NFC South
        'falcons', 'panthers', 'saints', 'buccaneers', 'bucs',
        # NFC West
        'cardinals', 'rams', '49ers', 'niners', 'seahawks'
    ]

    # American Football - indicators
    american_football_keywords = [
        'nfl', 'ncaa football', 'college football', 'super bowl']

    # Ice Hockey - NHL teams (all 32 teams)
    ice_hockey_nhl = [
        # Atlantic Division
        'bruins', 'sabres', 'red wings', 'panthers', 'canadiens', 'habs',
        'senators', 'lightning', 'maple leafs', 'leafs',
        # Metropolitan Division
        'hurricanes', 'canes', 'blue jackets', 'devils', 'islanders',
        'rangers', 'flyers', 'penguins', 'pens', 'capitals', 'caps',
        # Central Division
        'blackhawks', 'hawks', 'avalanche', 'avs', 'stars', 'wild',
        'predators', 'preds', 'blues', 'jets',
        # Pacific Division
        'ducks', 'flames', 'oilers', 'kings', 'sharks', 'kraken',
        'canucks', 'golden knights', 'knights', 'coyotes', 'yotes'
    ]

    # Ice Hockey - international
    ice_hockey_international = [
        'jokerit', 'ska', 'cska', 'dynamo', 'spartak', 'lokomotiv',
        'metallurg', 'avangard', 'frölunda', 'hv71', 'djurgarden',
        'lulea', 'vaxjo', 'zurich', 'zsc', 'bern', 'davos'
    ]

    # Ice Hockey - indicators
    ice_hockey_keywords = ['nhl', 'khl', 'shl', 'liiga', 'del', 'stanley cup']

    # Baseball - MLB teams (all 30 teams)
    baseball_mlb = [
        # AL East
        'red sox', 'yankees', 'yanks', 'blue jays', 'jays', 'orioles', 'rays',
        # AL Central
        'white sox', 'indians', 'guardians', 'tigers', 'royals', 'twins',
        # AL West
        'astros', 'angels', 'athletics', "a's", 'mariners', 'rangers',
        # NL East
        'braves', 'marlins', 'mets', 'phillies', 'nationals', 'nats',
        # NL Central
        'cubs', 'reds', 'brewers', 'pirates', 'cardinals', 'cards',
        # NL West
        'diamondbacks', 'd-backs', 'rockies', 'dodgers', 'padres', 'giants'
    ]

    # Baseball - indicators
    baseball_keywords = ['mlb', 'world series', 'baseball']

    # Football (Soccer) - Major European clubs
    football_clubs = [
        # England - Premier League
        'arsenal', 'chelsea', 'liverpool', 'manchester united', 'man united', 'man utd',
        'manchester city', 'man city', 'tottenham', 'spurs', 'everton', 'leicester',
        'west ham', 'wolves', 'wolverhampton', 'newcastle', 'aston villa', 'brighton',
        'crystal palace', 'southampton', 'leeds', 'norwich', 'watford', 'burnley',
        'fulham', 'brentford', 'bournemouth', 'nottingham forest',
        # Spain - La Liga
        'real madrid', 'barcelona', 'atletico madrid', 'atletico', 'sevilla',
        'valencia', 'villarreal', 'real sociedad', 'athletic bilbao', 'athletic club',
        'real betis', 'betis', 'celta vigo', 'espanyol', 'getafe', 'osasuna',
        # Germany - Bundesliga
        'bayern munich', 'bayern', 'borussia dortmund', 'dortmund', 'bvb',
        'rb leipzig', 'leipzig', 'bayer leverkusen', 'leverkusen', 'borussia monchengladbach',
        'gladbach', 'wolfsburg', 'frankfurt', 'eintracht', 'union berlin', 'freiburg',
        'hoffenheim', 'cologne', 'mainz', 'augsburg', 'hertha',
        # Italy - Serie A
        'juventus', 'juve', 'inter milan', 'inter', 'ac milan', 'milan', 'napoli',
        'roma', 'lazio', 'atalanta', 'fiorentina', 'torino', 'sassuolo', 'hellas verona',
        'sampdoria', 'genoa', 'bologna', 'udinese', 'cagliari', 'empoli',
        # France - Ligue 1
        'psg', 'paris saint-germain', 'marseille', 'lyon', 'monaco', 'lille',
        'nice', 'rennes', 'montpellier', 'nantes', 'strasbourg', 'lens',
        # Portugal
        'benfica', 'porto', 'sporting', 'sporting cp', 'braga',
        # Netherlands
        'ajax', 'psv', 'psv eindhoven', 'feyenoord', 'az alkmaar',
        # Other major clubs
        'celtic', 'rangers', 'galatasaray', 'besiktas', 'anderlecht'
    ]

    # Football - common keywords (be careful not to conflict with American football)
    football_keywords = [
        'fc ', ' fc', 'united ', 'city ', 'champions league', 'ucl', 'europa league',
        'premier league', 'la liga', 'bundesliga', 'serie a', 'ligue 1',
        'championship', 'eredivisie', 'primeira liga', 'copa del rey', 'fa cup'
    ]

    # Tennis - Professional players (top players for recognition)
    tennis_players = [
        'djokovic', 'nadal', 'federer', 'alcaraz', 'medvedev', 'tsitsipas',
        'zverev', 'rublev', 'sinner', 'ruud', 'auger-aliassime', 'fritz',
        'swiatek', 'sabalenka', 'gauff', 'rybakina', 'jabeur', 'pegula',
        'kvitova', 'osaka', 'halep', 'muguruza', 'raducanu', 'kerber'
    ]

    # Tennis - indicators and patterns
    tennis_keywords = [
        'atp', 'wta', 'grand slam', 'wimbledon', 'roland garros', 'french open',
        'us open', 'australian open', 'davis cup', 'masters 1000', 'atp 500'
    ]

    # Esports - Teams
    esports_teams = [
        # CS:GO/CS2
        'navi', "na'vi", 'natus vincere', 'faze clan', 'faze', 'g2 esports', 'g2',
        'vitality', 'team vitality', 'astralis', 'heroic', 'cloud9', 'c9',
        'team liquid', 'liquid', 'fnatic', 'mouz', 'mousesports', 'big clan',
        # League of Legends
        't1', 'skt', 'gen.g', 'geng', 'damwon', 'drx', 'jd gaming', 'jdg',
        'edg', 'edward gaming', 'rng', 'royal never give up', 'tes', 'top esports',
        'fpx', 'funplus phoenix', 'we', 'team we', 'ig', 'invictus gaming',
        # Dota 2
        'og esports', 'og', 'team secret', 'evil geniuses', 'eg', 'psg.lgd',
        'team spirit', 'tundra esports', 'tundra',
        # Valorant
        'sentinels', 'optic gaming', 'loud', 'paper rex', 'prx', 'drx',
        # Other
        '100 thieves', '100t', 'tsm', 'team solomid', 'nrg', 'complexity'
    ]

    # Esports - games and tournaments
    esports_keywords = [
        'lol', 'league of legends', 'dota', 'dota 2', 'csgo', 'cs:go', 'cs2', 'cs:2',
        'valorant', 'overwatch', 'ow', 'apex legends', 'call of duty', 'cod',
        'rocket league', 'rl', 'fortnite', 'worlds', 'the international', 'ti',
        'iem', 'esl', 'blast', 'pgl major', 'vct'
    ]

    # Handball - Major clubs
    handball_teams = [
        'kiel', 'thw kiel', 'barcelona', 'barca', 'fc barcelona', 'montpellier',
        'veszprem', 'telekom veszprem', 'vardar', 'flensburg', 'sg flensburg',
        'psg handball', 'paris', 'aalborg', 'aalborg handbold', 'kielce', 'vive kielce',
        'meshkov brest', 'meshkov', 'celje', 'pick szeged', 'szeged', 'magdeburg',
        'sc magdeburg', 'nantes', 'lemgo', 'gummersbach', 'porto'
    ]

    # Handball - indicators
    handball_keywords = ['ehf', 'champions league handball',
                         'handball bundesliga', 'handball']

    # Volleyball - Major clubs
    volleyball_teams = [
        'perugia', 'sir perugia', 'trentino', 'itas trentino', 'modena', 'lube civitanova',
        'lube', 'cucine lube', 'zenit kazan', 'zenit', 'zaksa', 'fenerbahce',
        'halkbank', 'berlin recycling', 'berlin', 'monza', 'piacenza', 'milano'
    ]

    # Volleyball - indicators
    volleyball_keywords = [
        'volleyball', 'cev champions league', 'superliga', 'serie a1 volleyball']

    # === Detection Logic (Order matters for accuracy) ===

    # 1. Check league/tournament indicators first (most specific)
    for keyword in basketball_keywords:
        if keyword in game_lower:
            return "Basketball"

    for keyword in american_football_keywords:
        if keyword in game_lower:
            return "American Football"

    for keyword in ice_hockey_keywords:
        if keyword in game_lower:
            return "Ice Hockey"

    for keyword in baseball_keywords:
        if keyword in game_lower:
            return "Baseball"

    for keyword in tennis_keywords:
        if keyword in game_lower:
            return "Tennis"

    for keyword in esports_keywords:
        if keyword in game_lower:
            return "Esports"

    for keyword in handball_keywords:
        if keyword in game_lower:
            return "Handball"

    for keyword in volleyball_keywords:
        if keyword in game_lower:
            return "Volleyball"

    # 2. Check team names (most reliable for team sports)

    # Basketball teams
    for team in basketball_nba + basketball_international:
        if team in game_lower:
            return "Basketball"

    # American Football teams (check before regular football to avoid conflicts)
    for team in american_football_nfl:
        if team in game_lower:
            return "American Football"

    # Ice Hockey teams
    for team in ice_hockey_nhl + ice_hockey_international:
        if team in game_lower:
            return "Ice Hockey"

    # Baseball teams
    for team in baseball_mlb:
        if team in game_lower:
            return "Baseball"

    # Esports teams
    for team in esports_teams:
        if team in game_lower:
            return "Esports"

    # Handball teams
    for team in handball_teams:
        if team in game_lower:
            return "Handball"

    # Volleyball teams
    for team in volleyball_teams:
        if team in game_lower:
            return "Volleyball"

    # Tennis players
    for player in tennis_players:
        if player in game_lower:
            return "Tennis"

    # 3. Check Football/Soccer (after other sports to avoid false positives)
    for club in football_clubs:
        if club in game_lower:
            return "Football"

    for keyword in football_keywords:
        if keyword in game_lower:
            return "Football"

    # 4. Tennis pattern detection (if no other sport matched)
    # Tennis typically has " v ", " vs ", " - " between player names
    # and usually consists of 2-6 words total (First Last v First Last)
    if (' v ' in game_lower or ' vs ' in game_lower or ' - ' in game_lower):
        words = game_lower.split()
        # If it's a short format with separators, likely tennis
        if len(words) >= 3 and len(words) <= 8:
            # Not a team sport if it's this short and has vs/v
            return "Tennis"

    # 5. Default to Other if no match found
    return "Other"

# Models


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    currency: str = "NOK"
    created_at: datetime


class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime


class Bet(BaseModel):
    model_config = ConfigDict(extra="ignore")
    bet_id: str
    user_id: str
    date: str
    time: Optional[str] = None
    game: str
    bet: str
    stake: float
    odds: float
    status: str  # "won", "lost", "pending", "push", "cashed"
    result: float  # profit/loss amount
    bookie: Optional[str] = None
    tipster: Optional[str] = None
    sport: Optional[str] = None
    notes: Optional[str] = None
    source_id: Optional[str] = None
    league: Optional[str] = None
    ticket_type: Optional[str] = None
    product: Optional[str] = None
    total_matches: Optional[int] = None
    expected_result_date: Optional[str] = None
    cashout_amount: Optional[float] = None
    display_id: Optional[int] = None
    legs: Optional[List[dict]] = None
    created_at: datetime


class BetCreate(BaseModel):
    date: str
    time: Optional[str] = None
    game: str
    bet: str
    stake: float
    odds: float
    status: str
    bookie: Optional[str] = None
    tipster: Optional[str] = None
    sport: Optional[str] = None
    notes: Optional[str] = None


class BetUpdate(BaseModel):
    date: Optional[str] = None
    time: Optional[str] = None
    game: Optional[str] = None
    bet: Optional[str] = None
    stake: Optional[float] = None
    odds: Optional[float] = None
    status: Optional[str] = None
    bookie: Optional[str] = None
    tipster: Optional[str] = None
    sport: Optional[str] = None
    notes: Optional[str] = None


class Bookmaker(BaseModel):
    model_config = ConfigDict(extra="ignore")
    bookmaker_id: str
    user_id: str
    name: str
    created_at: datetime


class BookmakerCreate(BaseModel):
    name: str


class Tipster(BaseModel):
    model_config = ConfigDict(extra="ignore")
    tipster_id: str
    user_id: str
    name: str
    created_at: datetime


class TipsterCreate(BaseModel):
    name: str


class FavoriteLeagueIn(BaseModel):
    key: str
    title: str = ""
    group: str = ""


class FavoriteTeamIn(BaseModel):
    name: str
    sport_key: str


class FavoriteEventIn(BaseModel):
    event_id: str
    sport_key: Optional[str] = None


# Auth Helper


async def get_current_user(request: Request) -> str:
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]

    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    cached_user = session_cache.get(session_token)
    if cached_user:
        return cached_user

    session_doc = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    session_cache.set(session_token, session_doc["user_id"])
    return session_doc["user_id"]

def _unavailable_db() -> HTTPException:
    return HTTPException(status_code=503, detail="Database unavailable")


def analytics_filters(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sport: Optional[str] = None,
    bookie: Optional[str] = None,
    tipster: Optional[str] = None,
) -> dict:
    return {
        "date_from": date_from,
        "date_to": date_to,
        "sport": sport,
        "bookie": bookie,
        "tipster": tipster,
    }


async def filtered_user_bets(user_id: str, include_legs: bool = False, **filters) -> list:
    query = bets_mongo_query(user_id, **filters)
    bets = await db.bets.find(query, bet_projection(include_legs)).sort([("date", 1), ("time", 1)]).to_list(10000)
    return filter_bets(bets, **filters)


async def attach_last_coolbet_sync(user_doc: Optional[dict]) -> Optional[dict]:
    if not user_doc:
        return user_doc
    if user_doc.get("last_coolbet_sync_at"):
        return user_doc
    latest = await db.bets.find_one(
        {"user_id": user_doc["user_id"], "bookie": "Coolbet"},
        {"_id": 0, "created_at": 1},
        sort=[("created_at", -1)],
    )
    last_sync = resolve_last_coolbet_sync_at(user_doc, (latest or {}).get("created_at"))
    if last_sync:
        user_doc["last_coolbet_sync_at"] = last_sync
        await db.users.update_one(
            {"user_id": user_doc["user_id"]},
            {"$set": {"last_coolbet_sync_at": last_sync}},
        )
    return user_doc


# Auth Routes


@api_router.get("/health")
async def health():
    return {"ok": True}


@api_router.post("/auth/login")
async def login(request: Request, response: Response):
    body = await request.json()
    email = body.get("email")
    password = body.get("password")

    if not email or not password:
        raise HTTPException(
            status_code=400, detail="Email and password required")

    try:
        existing_user = await db.users.find_one({"email": email}, {"_id": 0})

        if existing_user:
            user_doc = existing_user
        else:
            user_doc = {
                "user_id": f"user_{uuid.uuid4().hex[:12]}",
                "email": email,
                "name": email.split("@")[0].title(),
                "picture": None,
                "currency": "NOK",
                "created_at": datetime.now(timezone.utc),
            }
            await db.users.insert_one({**user_doc})

        session_token = f"session_{uuid.uuid4().hex}"
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)

        await db.user_sessions.insert_one({
            "user_id": user_doc["user_id"],
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc)
        })
        user_doc = await attach_last_coolbet_sync(user_doc)
    except (ConnectionFailure, OperationFailure, ServerSelectionTimeoutError):
        raise _unavailable_db() from None

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=is_production,
        samesite="none" if is_production else "lax",
        max_age=7 * 24 * 60 * 60,
        path="/"
    )

    # session_token is for Bearer clients (Chrome extension). Cookie auth is unchanged.
    return login_payload(user_doc, session_token)


@api_router.get("/auth/me")
async def get_me(request: Request):
    try:
        user_id = await get_current_user(request)
        user_doc = await attach_last_coolbet_sync(
            await db.users.find_one({"user_id": user_id}, {"_id": 0})
        )
    except (ConnectionFailure, OperationFailure, ServerSelectionTimeoutError):
        raise _unavailable_db() from None
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    return user_doc


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    if session_token:
        session_cache.pop(session_token)
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie(
        "session_token",
        path="/",
        secure=is_production,
        samesite="none" if is_production else "lax",
    )
    return {"message": "Logged out"}


@api_router.patch("/auth/currency")
async def update_currency(request: Request):
    user_id = await get_current_user(request)
    body = await request.json()
    currency = body.get("currency")

    if currency not in ["USD", "NOK", "UNITS"]:
        raise HTTPException(status_code=400, detail="Invalid currency")

    await db.users.update_one({"user_id": user_id}, {"$set": {"currency": currency}})
    return {"currency": currency}

# Bet Routes


@api_router.get("/bets", response_model=List[Bet])
async def get_bets(
    request: Request,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    bookie: Optional[str] = None,
    tipster: Optional[str] = None,
    status: Optional[str] = None,
    sport: Optional[str] = None,
    league: Optional[str] = None,
    ticket_type: Optional[str] = None,
    odds_min: Optional[float] = None,
    odds_max: Optional[float] = None,
    limit: Optional[int] = None,
    include_legs: bool = False,
):
    user_id = await get_current_user(request)
    filters = dict(
        date_from=date_from,
        date_to=date_to,
        bookie=bookie,
        tipster=tipster,
        status=status,
        sport=sport,
        league=league,
        ticket_type=ticket_type,
        odds_min=odds_min,
        odds_max=odds_max,
    )
    query = bets_mongo_query(user_id, **filters)
    cursor = db.bets.find(query, bet_projection(include_legs)).sort("date", -1)
    fetch_limit = limit if limit and limit > 0 else 10000
    if limit and limit > 0:
        cursor = cursor.limit(limit)
    bets = await cursor.to_list(fetch_limit)
    return filter_bets(bets, **filters)


@api_router.post("/bets", response_model=Bet)
async def create_bet(request: Request, bet_input: BetCreate):
    user_id = await get_current_user(request)

    bet_id = f"bet_{uuid.uuid4().hex[:12]}"

    result = 0
    if bet_input.status == "won":
        result = bet_input.stake * (bet_input.odds - 1)
    elif bet_input.status == "lost":
        result = -bet_input.stake

    bet_dict = bet_input.model_dump()
    bet_dict["bet_id"] = bet_id
    bet_dict["user_id"] = user_id
    bet_dict["result"] = result
    bet_dict["created_at"] = datetime.now(timezone.utc)

    await db.bets.insert_one(bet_dict)

    bet_doc = await db.bets.find_one({"bet_id": bet_id}, {"_id": 0})
    return bet_doc


@api_router.patch("/bets/{bet_id}", response_model=Bet)
async def update_bet(request: Request, bet_id: str, bet_update: BetUpdate):
    user_id = await get_current_user(request)

    bet_doc = await db.bets.find_one({"bet_id": bet_id, "user_id": user_id}, {"_id": 0})
    if not bet_doc:
        raise HTTPException(status_code=404, detail="Bet not found")

    update_data = bet_update.model_dump(exclude_unset=True)

    if "status" in update_data or "stake" in update_data or "odds" in update_data:
        status = update_data.get("status", bet_doc["status"])
        stake = update_data.get("stake", bet_doc["stake"])
        odds = update_data.get("odds", bet_doc["odds"])

        result = 0
        if status == "won":
            result = stake * (odds - 1)
        elif status == "lost":
            result = -stake

        update_data["result"] = result

    await db.bets.update_one(
        {"bet_id": bet_id, "user_id": user_id},
        {"$set": update_data}
    )

    updated_bet = await db.bets.find_one({"bet_id": bet_id}, {"_id": 0})
    return updated_bet


@api_router.delete("/bets/{bet_id}")
async def delete_bet(request: Request, bet_id: str):
    user_id = await get_current_user(request)

    result = await db.bets.delete_one({"bet_id": bet_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bet not found")

    return {"message": "Bet deleted"}

# Analytics Routes


@api_router.get("/analytics/stats")
async def get_stats(request: Request, filters: dict = Depends(analytics_filters)):
    user_id = await get_current_user(request)
    return compute_stats(await filtered_user_bets(user_id, **filters))


@api_router.get("/analytics/chart")
async def get_chart_data(
    request: Request,
    days: Optional[str] = None,
    filters: dict = Depends(analytics_filters),
):
    user_id = await get_current_user(request)
    try:
        start_date, end_date = chart_date_bounds(
            days=days,
            date_from=filters.get("date_from"),
            date_to=filters.get("date_to"),
        )
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Invalid days") from None

    bets = await filtered_user_bets(
        user_id,
        date_from=start_date,
        date_to=end_date,
        sport=filters.get("sport"),
        bookie=filters.get("bookie"),
        tipster=filters.get("tipster"),
    )

    return build_chart_data(bets)


@api_router.get("/analytics/calendar")
async def get_calendar_data(
    request: Request,
    year: int,
    month: int,
    filters: dict = Depends(analytics_filters),
):
    user_id = await get_current_user(request)

    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month + 1:02d}-01"

    bets = await db.bets.find({
        "user_id": user_id,
        "date": {"$gte": start_date, "$lt": end_date}
    }, {"_id": 0}).to_list(10000)
    bets = filter_bets(bets, **filters)

    daily_data = {}
    for bet in bets:
        date = bet["date"]
        if date not in daily_data:
            daily_data[date] = {"profit_loss": 0,
                                "bets": 0, "won": 0, "lost": 0}

        daily_data[date]["profit_loss"] += bet["result"]
        daily_data[date]["bets"] += 1
        if bet["status"] == "won":
            daily_data[date]["won"] += 1
        elif bet["status"] == "lost":
            daily_data[date]["lost"] += 1

    return [{"date": date, **data} for date, data in sorted(daily_data.items())]


@api_router.get("/analytics/bookmakers")
async def get_bookmaker_analytics(request: Request, filters: dict = Depends(analytics_filters)):
    user_id = await get_current_user(request)
    bets = await filtered_user_bets(user_id, **filters)
    return compute_breakdown(bets, "bookie")


@api_router.get("/analytics/tipsters")
async def get_tipster_analytics(request: Request, filters: dict = Depends(analytics_filters)):
    user_id = await get_current_user(request)
    bets = await filtered_user_bets(user_id, **filters)
    return compute_breakdown(bets, "tipster", skip_empty=True)


@api_router.get("/analytics/sports")
async def get_sport_analytics(request: Request, filters: dict = Depends(analytics_filters)):
    user_id = await get_current_user(request)
    bets = await filtered_user_bets(user_id, **filters)
    return compute_breakdown(bets, "sport")


@api_router.get("/analytics/odds-range")
async def get_odds_range_analytics(request: Request, filters: dict = Depends(analytics_filters)):
    user_id = await get_current_user(request)
    bets = await filtered_user_bets(user_id, **filters)
    return compute_odds_range_breakdown(bets)


@api_router.get("/analytics/leagues")
async def get_league_analytics(request: Request, filters: dict = Depends(analytics_filters)):
    user_id = await get_current_user(request)
    bets = await filtered_user_bets(user_id, **filters)
    return compute_breakdown(bets, "league")


@api_router.get("/analytics/ticket-types")
async def get_ticket_type_analytics(request: Request, filters: dict = Depends(analytics_filters)):
    user_id = await get_current_user(request)
    bets = await filtered_user_bets(user_id, **filters)
    return compute_breakdown(bets, "ticket_type")


@api_router.get("/analytics/summary")
async def get_analytics_summary(
    request: Request,
    days: Optional[str] = None,
    filters: dict = Depends(analytics_filters),
):
    user_id = await get_current_user(request)
    option_filters = {
        "date_from": filters.get("date_from"),
        "date_to": filters.get("date_to"),
    }
    option_bets = await filtered_user_bets(user_id, **option_filters)
    data_bets = filter_bets(
        option_bets,
        sport=filters.get("sport"),
        bookie=filters.get("bookie"),
        tipster=filters.get("tipster"),
    )
    try:
        start_date, end_date = chart_date_bounds(
            days=days,
            date_from=filters.get("date_from"),
            date_to=filters.get("date_to"),
        )
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Invalid days") from None
    chart_bets = filter_bets(
        option_bets,
        date_from=start_date,
        date_to=end_date,
        sport=filters.get("sport"),
        bookie=filters.get("bookie"),
        tipster=filters.get("tipster"),
    )
    return build_analytics_summary(data_bets, option_bets, chart_bets)


@api_router.get("/bets/recent")
async def get_recent_bets(request: Request, limit: int = 10):
    user_id = await get_current_user(request)

    bets = await db.bets.find(
        {"user_id": user_id},
        LIST_PROJECTION,
    ).sort([("date", -1), ("time", -1)]).limit(limit).to_list(limit)

    return bets


@api_router.get("/bets/source-ids")
async def get_bet_source_ids(request: Request, bookie: Optional[str] = None):
    user_id = await get_current_user(request)
    query = {"user_id": user_id, "source_id": {"$exists": True, "$nin": [None, ""]}}
    if bookie:
        query["bookie"] = bookie
    rows = await db.bets.find(query, {"_id": 0, "source_id": 1, "status": 1}).to_list(10000)
    return rows


# Bookmaker Routes


@api_router.get("/bookmakers", response_model=List[Bookmaker])
async def get_bookmakers(request: Request):
    user_id = await get_current_user(request)
    bookmakers = await db.bookmakers.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    return bookmakers


@api_router.post("/bookmakers", response_model=Bookmaker)
async def create_bookmaker(request: Request, bookmaker_input: BookmakerCreate):
    user_id = await get_current_user(request)

    existing = await db.bookmakers.find_one({"user_id": user_id, "name": bookmaker_input.name})
    if existing:
        raise HTTPException(status_code=400, detail="Bookmaker already exists")

    bookmaker_id = f"bookmaker_{uuid.uuid4().hex[:12]}"
    bookmaker_dict = {
        "bookmaker_id": bookmaker_id,
        "user_id": user_id,
        "name": bookmaker_input.name,
        "created_at": datetime.now(timezone.utc)
    }

    await db.bookmakers.insert_one(bookmaker_dict)

    bookmaker_doc = await db.bookmakers.find_one({"bookmaker_id": bookmaker_id}, {"_id": 0})
    return bookmaker_doc


@api_router.delete("/bookmakers/{bookmaker_id}")
async def delete_bookmaker(request: Request, bookmaker_id: str):
    user_id = await get_current_user(request)

    result = await db.bookmakers.delete_one({"bookmaker_id": bookmaker_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bookmaker not found")

    return {"message": "Bookmaker deleted"}

# Tipster Routes


@api_router.get("/tipsters", response_model=List[Tipster])
async def get_tipsters(request: Request):
    user_id = await get_current_user(request)
    tipsters = await db.tipsters.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    return tipsters


@api_router.post("/tipsters", response_model=Tipster)
async def create_tipster(request: Request, tipster_input: TipsterCreate):
    user_id = await get_current_user(request)

    existing = await db.tipsters.find_one({"user_id": user_id, "name": tipster_input.name})
    if existing:
        raise HTTPException(status_code=400, detail="Tipster already exists")

    tipster_id = f"tipster_{uuid.uuid4().hex[:12]}"
    tipster_dict = {
        "tipster_id": tipster_id,
        "user_id": user_id,
        "name": tipster_input.name,
        "created_at": datetime.now(timezone.utc)
    }

    await db.tipsters.insert_one(tipster_dict)

    tipster_doc = await db.tipsters.find_one({"tipster_id": tipster_id}, {"_id": 0})
    return tipster_doc


@api_router.delete("/tipsters/{tipster_id}")
async def delete_tipster(request: Request, tipster_id: str):
    user_id = await get_current_user(request)

    result = await db.tipsters.delete_one({"tipster_id": tipster_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tipster not found")

    return {"message": "Tipster deleted"}

# Import/Export Routes


@api_router.post("/bets/import")
async def import_bets(request: Request):
    user_id = await get_current_user(request)

    body = await request.json()
    csv_data = body.get("csv_data")

    if not csv_data:
        raise HTTPException(status_code=400, detail="csv_data required")

    csv_reader = csv.DictReader(io.StringIO(csv_data), delimiter=';')
    imported_count = 0

    for row in csv_reader:
        try:
            bet_id = f"bet_{uuid.uuid4().hex[:12]}"
            stake = float(row.get("STAKE", "0").strip('"'))
            odds = float(row.get("ODDS", "1").strip('"'))
            raw_status = row.get("STATUS", "pending").strip('"').lower()
            result_value = float(row.get("RESULT", "0").strip('"'))

            # Map status values
            if raw_status == "pushed":
                status = "push"
            elif raw_status == "cashed out":
                status = "lost"  # Treat cashed out as lost since result is negative
            else:
                status = raw_status

            # Auto-detect sport from game name using TheSportsDB API + local patterns
            game_name = row.get("GAME", "").strip('"')
            detected_sport = await detect_sport_from_game_async(game_name)

            bet_dict = {
                "bet_id": bet_id,
                "user_id": user_id,
                "date": row.get("DATE", "").strip('"'),
                "time": row.get("TIME", "").strip('"'),
                "game": game_name,
                "bet": row.get("BET", "").strip('"'),
                "stake": stake,
                "odds": odds,
                "status": status,
                "result": result_value,
                "bookie": row.get("BOOKIE", "").strip('"') or None,
                "tipster": row.get("TIPSTER", "").strip('"') or None,
                "sport": detected_sport,
                "created_at": datetime.now(timezone.utc)
            }

            await db.bets.insert_one(bet_dict)
            imported_count += 1
        except Exception as e:
            logging.error(f"Error importing row: {e}")
            continue

    return {"imported": imported_count}


@api_router.post("/bets/import/coolbet")
async def import_coolbet_bets(request: Request):
    user_id = await get_current_user(request)
    body = await request.json()

    if isinstance(body, list):
        tickets = body
    else:
        tickets = body.get("tickets")
        if tickets is None and isinstance(body.get("csv_data"), list):
            tickets = body.get("csv_data")

    if not isinstance(tickets, list):
        raise HTTPException(status_code=400, detail="tickets array required")

    imported = 0
    updated = 0
    skipped = 0
    now = datetime.now(timezone.utc)
    mapped_tickets = []

    for ticket in tickets:
        try:
            if not isinstance(ticket, dict) or not ticket.get("id"):
                skipped += 1
                continue
            mapped_tickets.append(map_coolbet_ticket(ticket))
        except Exception as e:
            logging.error(f"Error mapping Coolbet ticket: {e}")
            skipped += 1

    source_ids = [mapped["source_id"] for mapped in mapped_tickets if mapped.get("source_id")]
    existing_docs = []
    if source_ids:
        existing_docs = await db.bets.find(
            {"user_id": user_id, "source_id": {"$in": source_ids}},
            {"_id": 0, "bet_id": 1, "source_id": 1, "created_at": 1},
        ).to_list(len(source_ids))
    existing_by_source = {doc["source_id"]: doc for doc in existing_docs}

    ops = []
    for mapped in mapped_tickets:
        source_id = mapped.get("source_id")
        existing = existing_by_source.get(source_id)
        doc = {
            **mapped,
            "user_id": user_id,
            "bet_id": existing["bet_id"] if existing else f"bet_{uuid.uuid4().hex[:12]}",
            "created_at": existing["created_at"] if existing else now,
        }
        if existing:
            ops.append(ReplaceOne({"bet_id": existing["bet_id"], "user_id": user_id}, doc))
            updated += 1
        else:
            ops.append(InsertOne(doc))
            imported += 1

    if ops:
        await db.bets.bulk_write(ops, ordered=False)

    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"last_coolbet_sync_at": now}},
    )

    return {"imported": imported, "updated": updated, "skipped": skipped}


@api_router.get("/bets/export")
async def export_bets(request: Request):
    user_id = await get_current_user(request)

    bets = await db.bets.find({"user_id": user_id}, {"_id": 0}).sort("date", 1).to_list(10000)

    output = io.StringIO()
    fieldnames = ["DATE", "TIME", "GAME", "BET", "ODDS", "STAKE",
                  "STATUS", "RESULT", "TIPSTER", "SPORT", "BOOKIE"]
    writer = csv.DictWriter(output, fieldnames=fieldnames, delimiter=';')
    writer.writeheader()

    for bet in bets:
        writer.writerow({
            "DATE": bet.get("date", ""),
            "TIME": bet.get("time", ""),
            "GAME": bet.get("game", ""),
            "BET": bet.get("bet", ""),
            "ODDS": bet.get("odds", 0),
            "STAKE": bet.get("stake", 0),
            "STATUS": bet.get("status", ""),
            "RESULT": bet.get("result", 0),
            "TIPSTER": bet.get("tipster", ""),
            "SPORT": bet.get("sport", ""),
            "BOOKIE": bet.get("bookie", "")
        })

    csv_content = output.getvalue()
    return Response(content=csv_content, media_type="text/csv", headers={
        "Content-Disposition": "attachment; filename=bets_export.csv"
    })


@api_router.get("/bets/{bet_id}", response_model=Bet)
async def get_bet(request: Request, bet_id: str):
    user_id = await get_current_user(request)
    bet_doc = await db.bets.find_one({"bet_id": bet_id, "user_id": user_id}, {"_id": 0})
    if not bet_doc:
        raise HTTPException(status_code=404, detail="Bet not found")
    return bet_doc


# Chrome extension uses Authorization Bearer (not cookies). unpacked IDs change,
# so allow any chrome-extension:// origin in addition to CORS_ORIGINS (Vercel etc.).
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_origin_regex=CHROME_EXTENSION_ORIGIN_RE,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def _odds_http_error(err: OddsApiError) -> HTTPException:
    return HTTPException(status_code=err.status_code, detail=err.detail)


async def _user_docs(collection, user_id: str):
    return await collection.find({"user_id": user_id}, {"_id": 0}).to_list(1000)


def _sport_title_map(sports):
    return {sport.get("key"): sport.get("title") or sport.get("key") for sport in sports or []}


def _merge_score_and_odds(score_event, odds_event, sport_key, sport_title):
    combined = dict(score_event or {})
    for key, value in (odds_event or {}).items():
        if key == "scores" and combined.get("scores"):
            continue
        if value is not None or key not in combined:
            combined[key] = value
    combined.setdefault("sport_key", sport_key)
    combined.setdefault("sport_title", sport_title)
    if odds_event and odds_event.get("bookmakers"):
        combined["bookmakers"] = odds_event["bookmakers"]
    return normalize_event(combined, best_h2h(combined))


SPORT_FETCH_CONCURRENCY = 3
MATCHES_FETCH_BUDGET_SECONDS = 22.0


async def _sport_endpoint_rows(path, params, ttl_seconds):
    try:
        return await odds_client.get_json(path, params, ttl_seconds=ttl_seconds), None
    except OddsApiError as err:
        logger.warning("Odds API feilet for %s: %s", path, err.detail)
        return [], err


async def _matches_for_one_sport(key, titles):
    (scores_rows, scores_err), (odds_rows, odds_err) = await asyncio.gather(
        _sport_endpoint_rows(
            f"/sports/{key}/scores",
            {"daysFrom": "3"},
            TTL_SCORES,
        ),
        _sport_endpoint_rows(
            f"/sports/{key}/odds",
            {"regions": "eu", "markets": "h2h", "oddsFormat": "decimal"},
            TTL_ODDS,
        ),
    )
    errors = [err for err in (scores_err, odds_err) if err]
    if not scores_rows and not odds_rows:
        return preferred_odds_fetch_error(errors) if errors else []
    scores_map = {row["id"]: row for row in scores_rows or [] if row.get("id")}
    odds_map = {row["id"]: row for row in odds_rows or [] if row.get("id")}
    title = titles.get(key) or key
    return [
        _merge_score_and_odds(scores_map.get(event_id), odds_map.get(event_id), key, title)
        for event_id in dict.fromkeys([*scores_map, *odds_map])
    ]


async def _matches_for_sport_keys(sport_keys, sports):
    titles = _sport_title_map(sports)
    unique_keys = [key for key in dict.fromkeys(sport_keys or []) if key]
    if not unique_keys:
        return []
    sem = asyncio.Semaphore(SPORT_FETCH_CONCURRENCY)

    async def guarded(key):
        async with sem:
            try:
                return await _matches_for_one_sport(key, titles)
            except OddsApiError as err:
                logger.warning("Odds API feilet for sport_key=%s: %s", key, err.detail)
                return err

    tasks = [asyncio.create_task(guarded(key)) for key in unique_keys]
    done, pending = await asyncio.wait(tasks, timeout=MATCHES_FETCH_BUDGET_SECONDS)
    timed_out = []
    for task in pending:
        task.cancel()
        timed_out.append(OddsApiError(502, "Odds API utilgjengelig (timeout)"))
    if pending:
        await asyncio.gather(*pending, return_exceptions=True)

    results = []
    for task in done:
        try:
            results.append(task.result())
        except OddsApiError as err:
            results.append(err)
        except Exception:
            results.append(OddsApiError(502, "Odds API utilgjengelig"))
    results.extend(timed_out)
    return merge_sport_fetch_results(results)


async def _favorite_state(user_id: str):
    leagues = await _user_docs(db.favorite_leagues, user_id)
    teams = await _user_docs(db.favorite_teams, user_id)
    events = await _user_docs(db.favorite_events, user_id)
    league_keys = [row.get("sport_key") for row in leagues if row.get("sport_key")]
    event_ids = [row.get("event_id") for row in events if row.get("event_id")]
    return {
        "leagues": leagues,
        "teams": teams,
        "event_ids": event_ids,
        "league_keys": league_keys,
        "sport_keys": favorite_sport_keys(league_keys, teams, events),
    }


@api_router.get("/odds/sports")
async def get_odds_sports(request: Request):
    await get_current_user(request)
    try:
        return await odds_client.get_json("/sports", {"all": "false"}, ttl_seconds=TTL_SPORTS)
    except OddsApiError as err:
        raise _odds_http_error(err) from err


@api_router.get("/odds/matches")
async def get_odds_matches(
    request: Request,
    date: str,
    tab: str = "favorites",
    filter: str = "all",
):
    user_id = await get_current_user(request)
    try:
        if tab == "favorites":
            state = await _favorite_state(user_id)
            if not state["sport_keys"]:
                return []
            sports = await odds_client.get_json("/sports", {"all": "false"}, ttl_seconds=TTL_SPORTS)
            matches = await _matches_for_sport_keys(state["sport_keys"], sports)
            matches = favorite_matches(matches, state["league_keys"], state["teams"], state["event_ids"])
        else:
            sports = await odds_client.get_json("/sports", {"all": "false"}, ttl_seconds=TTL_SPORTS)
            sport_keys = sport_tab_keys(sports, tab)
            matches = await _matches_for_sport_keys(sport_keys, sports)
        return filter_matches(matches, date=date, status_filter=filter)
    except OddsApiError as err:
        raise _odds_http_error(err) from err


@api_router.get("/odds/matches/{event_id}/markets")
async def get_odds_match_markets(request: Request, event_id: str, sport_key: str):
    await get_current_user(request)
    try:
        payload = await odds_client.get_json(
            f"/sports/{sport_key}/events/{event_id}/odds",
            {"regions": "eu", "markets": "h2h,totals,btts", "oddsFormat": "decimal"},
            ttl_seconds=TTL_MARKETS,
        )
    except OddsApiError as err:
        raise _odds_http_error(err) from err
    event = payload[0] if isinstance(payload, list) and payload else payload
    return map_event_markets(event or {})


@api_router.get("/favorites/leagues")
async def get_favorite_leagues(request: Request):
    user_id = await get_current_user(request)
    rows = await _user_docs(db.favorite_leagues, user_id)
    return [
        {
            "key": row.get("sport_key"),
            "title": row.get("title") or row.get("sport_key"),
            "group": row.get("group") or "",
        }
        for row in rows
        if row.get("sport_key")
    ]


@api_router.post("/favorites/leagues")
async def pin_favorite_league(request: Request, body: FavoriteLeagueIn):
    user_id = await get_current_user(request)
    doc = {
        "user_id": user_id,
        "sport_key": body.key,
        "title": body.title or body.key,
        "group": body.group or "",
    }
    await db.favorite_leagues.update_one(
        {"user_id": user_id, "sport_key": body.key},
        {"$set": doc},
        upsert=True,
    )
    return {"key": doc["sport_key"], "title": doc["title"], "group": doc["group"]}


@api_router.delete("/favorites/leagues/{sport_key}")
async def unpin_favorite_league(request: Request, sport_key: str):
    user_id = await get_current_user(request)
    await db.favorite_leagues.delete_one({"user_id": user_id, "sport_key": sport_key})
    return {"ok": True}


@api_router.get("/favorites/teams")
async def get_favorite_teams(request: Request):
    user_id = await get_current_user(request)
    rows = await _user_docs(db.favorite_teams, user_id)
    return [
        {"name": row.get("name"), "sport_key": row.get("sport_key")}
        for row in rows
        if row.get("name")
    ]


@api_router.post("/favorites/teams")
async def follow_favorite_team(request: Request, body: FavoriteTeamIn):
    user_id = await get_current_user(request)
    doc = {"user_id": user_id, "name": body.name, "sport_key": body.sport_key}
    await db.favorite_teams.update_one(
        {"user_id": user_id, "name": body.name, "sport_key": body.sport_key},
        {"$set": doc},
        upsert=True,
    )
    return {"name": body.name, "sport_key": body.sport_key}


@api_router.delete("/favorites/teams")
async def unfollow_favorite_team(request: Request, body: FavoriteTeamIn):
    user_id = await get_current_user(request)
    await db.favorite_teams.delete_one(
        {"user_id": user_id, "name": body.name, "sport_key": body.sport_key}
    )
    return {"ok": True}


@api_router.get("/favorites/events")
async def get_favorite_events(request: Request):
    user_id = await get_current_user(request)
    rows = await _user_docs(db.favorite_events, user_id)
    return [
        {"event_id": row.get("event_id"), "sport_key": row.get("sport_key")}
        for row in rows
        if row.get("event_id")
    ]


@api_router.post("/favorites/events")
async def star_favorite_event(request: Request, body: FavoriteEventIn):
    user_id = await get_current_user(request)
    doc = {"user_id": user_id, "event_id": body.event_id}
    if body.sport_key:
        doc["sport_key"] = body.sport_key
    await db.favorite_events.update_one(
        {"user_id": user_id, "event_id": body.event_id},
        {"$set": doc},
        upsert=True,
    )
    return {"event_id": body.event_id, "sport_key": body.sport_key}


@api_router.delete("/favorites/events")
async def unstar_favorite_event(request: Request, body: FavoriteEventIn):
    user_id = await get_current_user(request)
    await db.favorite_events.delete_one({"user_id": user_id, "event_id": body.event_id})
    return {"ok": True}


@api_router.get("/favorites/search")
async def search_favorites(request: Request, query: str = ""):
    await get_current_user(request)
    needle = (query or "").strip()
    if not needle:
        return {"leagues": [], "teams": []}
    try:
        sports = await odds_client.get_json("/sports", {"all": "false"}, ttl_seconds=TTL_SPORTS)
        event_keys = search_event_sport_keys(sports, query)

        async def fetch_events(key):
            try:
                return await odds_client.get_json(f"/sports/{key}/events", {}, ttl_seconds=TTL_SCORES)
            except OddsApiError:
                return []

        batches = await asyncio.gather(*[fetch_events(key) for key in event_keys])
        events = []
        for batch in batches:
            events.extend(batch or [])
        return search_leagues_and_teams(sports, events, query)
    except OddsApiError as err:
        raise _odds_http_error(err) from err


app.include_router(api_router)


@app.on_event("startup")
async def ensure_indexes():
    if os.environ.get("PYTEST_CURRENT_TEST"):
        return
    try:
        await db.bets.create_index([("user_id", 1), ("date", -1)], name="bets_user_date")
        await db.bets.create_index(
            [("user_id", 1), ("status", 1), ("date", -1)],
            name="bets_user_status_date",
        )
        await db.bets.create_index(
            [("user_id", 1), ("bookie", 1), ("source_id", 1)],
            name="bets_user_bookie_source",
            unique=True,
            partialFilterExpression={"source_id": {"$type": "string"}},
        )
        await db.user_sessions.create_index("session_token", unique=True, name="sessions_token")
        await db.users.create_index("user_id", name="users_user_id")
    except Exception:
        logging.exception("Could not ensure Mongo indexes")


@app.on_event("shutdown")
async def shutdown_db_client():
    if not os.environ.get("PYTEST_CURRENT_TEST"):
        await sportsdb_http.aclose()
    client.close()
