import csv
import io
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

import bcrypt
import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Request, Response
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, EmailStr
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# TheSportsDB API configuration
SPORTSDB_API_KEY = "3"  # Free tier key
SPORTSDB_BASE_URL = "https://www.thesportsdb.com/api/v1/json"

# Cache for TheSportsDB lookups to minimize API calls
sportsdb_cache = {}


async def query_sportsdb_team(team_name: str) -> Optional[str]:
    """
    Query TheSportsDB API to find team information and determine sport.
    Returns sport name or None if not found.
    """
    if not team_name:
        return None

    # Check cache first
    cache_key = team_name.lower().strip()
    if cache_key in sportsdb_cache:
        return sportsdb_cache[cache_key]

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            # Search for team by name
            response = await client.get(
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

                    # Cache the result
                    sportsdb_cache[cache_key] = result
                    return result
    except Exception as e:
        logging.warning(f"TheSportsDB API error for '{team_name}': {e}")

    # Cache negative result to avoid repeated failed lookups
    sportsdb_cache[cache_key] = None
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
    currency: str = "USD"
    created_at: datetime


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


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
    status: str  # "won", "lost", "pending", "push"
    result: float  # profit/loss amount
    bookie: Optional[str] = None
    tipster: Optional[str] = None
    sport: Optional[str] = None
    notes: Optional[str] = None
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


class FavoriteTeamCreate(BaseModel):
    team_id: str
    team_name: str
    sport: str
    league: Optional[str] = None
    badge: Optional[str] = None


class TeamSearchResult(BaseModel):
    team_id: str
    name: str
    sport: str
    league: Optional[str] = None
    badge: Optional[str] = None


class FavoriteTeam(BaseModel):
    model_config = ConfigDict(extra="ignore")
    team_id: str
    name: str
    sport: str
    league: Optional[str] = None
    badge: Optional[str] = None
    added_at: datetime


class Fixture(BaseModel):
    fixture_id: str
    home_team: str
    away_team: str
    date: str
    time: Optional[str] = None
    league: str
    sport: str
    venue: Optional[str] = None

# Auth Helper


def is_production() -> bool:
    """Check if we're running in production (HTTPS environment)"""
    return (
        os.environ.get('ENVIRONMENT') == 'production' or
        os.environ.get('VERCEL') == '1' or
        'render.com' in os.environ.get('RENDER_EXTERNAL_HOSTNAME', '')
    )


async def get_current_user(request: Request) -> str:
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]

    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_doc = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        # Clean up expired session
        await db.user_sessions.delete_one({"session_token": session_token})
        raise HTTPException(status_code=401, detail="Session expired")

    return session_doc["user_id"]

# Auth Routes


@api_router.post("/auth/register")
async def register(request: Request, response: Response, user_data: UserRegister):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Validate password strength
    if len(user_data.password) < 8:
        raise HTTPException(
            status_code=400, detail="Password must be at least 8 characters long")

    # Hash password
    password_hash = bcrypt.hashpw(user_data.password.encode(
        'utf-8'), bcrypt.gensalt()).decode('utf-8')

    # Create user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    name = user_data.name if user_data.name else user_data.email.split(
        "@")[0].title()

    await db.users.insert_one({
        "user_id": user_id,
        "email": user_data.email,
        "name": name,
        "password_hash": password_hash,
        "picture": None,
        "currency": "USD",
        "created_at": datetime.now(timezone.utc)
    })

    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=is_production(),
        samesite="none" if is_production() else "lax",
        max_age=7 * 24 * 60 * 60,
        path="/"
    )

    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return user_doc


@api_router.post("/auth/login")
async def login(request: Request, response: Response, user_data: UserLogin):
    # Find user
    user_doc = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(
            status_code=401, detail="Invalid email or password")

    # Check if user has password_hash (old demo users might not have one)
    if "password_hash" not in user_doc:
        raise HTTPException(
            status_code=401, detail="Account needs to be reset. Please register again.")

    # Verify password
    if not bcrypt.checkpw(user_data.password.encode('utf-8'), user_doc["password_hash"].encode('utf-8')):
        raise HTTPException(
            status_code=401, detail="Invalid email or password")

    user_id = user_doc["user_id"]

    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=is_production(),
        samesite="none" if is_production() else "lax",
        max_age=7 * 24 * 60 * 60,
        path="/"
    )

    # Return user without password_hash
    user_doc.pop("password_hash", None)
    return user_doc


@api_router.get("/auth/me")
async def get_me(request: Request):
    user_id = await get_current_user(request)
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    return user_doc


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})

    response.delete_cookie(
        "session_token",
        path="/",
        secure=is_production(),
        samesite="none" if is_production() else "lax"
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
async def get_bets(request: Request, date_from: Optional[str] = None, date_to: Optional[str] = None,
                   bookie: Optional[str] = None, tipster: Optional[str] = None, status: Optional[str] = None):
    user_id = await get_current_user(request)

    query = {"user_id": user_id}
    if date_from or date_to:
        query["date"] = {}
        if date_from:
            query["date"]["$gte"] = date_from
        if date_to:
            query["date"]["$lte"] = date_to
    if bookie:
        query["bookie"] = bookie
    if tipster:
        query["tipster"] = tipster
    if status:
        query["status"] = status

    bets = await db.bets.find(query, {"_id": 0}).sort("date", -1).to_list(10000)
    return bets


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
async def get_stats(request: Request):
    user_id = await get_current_user(request)

    all_bets = await db.bets.find({"user_id": user_id}, {"_id": 0}).sort("date", 1).sort("time", 1).to_list(10000)

    total_bets = len(all_bets)
    total_stake = sum(bet["stake"] for bet in all_bets)
    total_profit_loss = sum(bet["result"] for bet in all_bets)

    won_bets = [bet for bet in all_bets if bet["status"] == "won"]
    lost_bets = [bet for bet in all_bets if bet["status"] == "lost"]
    push_bets = [bet for bet in all_bets if bet["status"] == "push"]
    pending_bets = [bet for bet in all_bets if bet["status"] == "pending"]

    # Calculate streaks
    current_streak = 0
    current_streak_type = None
    best_win_streak = 0
    worst_loss_streak = 0
    temp_win_streak = 0
    temp_loss_streak = 0

    for bet in all_bets:
        if bet["status"] == "won":
            temp_win_streak += 1
            temp_loss_streak = 0
            if current_streak_type == "won" or current_streak_type is None:
                current_streak += 1
                current_streak_type = "won"
            else:
                current_streak = 1
                current_streak_type = "won"
            best_win_streak = max(best_win_streak, temp_win_streak)
        elif bet["status"] == "lost":
            temp_loss_streak += 1
            temp_win_streak = 0
            if current_streak_type == "lost" or current_streak_type is None:
                current_streak += 1
                current_streak_type = "lost"
            else:
                current_streak = 1
                current_streak_type = "lost"
            worst_loss_streak = max(worst_loss_streak, temp_loss_streak)
        # Push doesn't break streak but doesn't count toward it

    return {
        "total_bets": total_bets,
        "total_stake": total_stake,
        "total_profit_loss": total_profit_loss,
        "roi": (total_profit_loss / total_stake * 100) if total_stake > 0 else 0,
        "won_count": len(won_bets),
        "lost_count": len(lost_bets),
        "push_count": len(push_bets),
        "pending_count": len(pending_bets),
        "win_rate": (len(won_bets) / (len(won_bets) + len(lost_bets)) * 100) if (len(won_bets) + len(lost_bets)) > 0 else 0,
        "current_streak": current_streak,
        "current_streak_type": current_streak_type,
        "best_win_streak": best_win_streak,
        "worst_loss_streak": worst_loss_streak
    }


@api_router.get("/analytics/chart")
async def get_chart_data(request: Request, days: int = 30):
    user_id = await get_current_user(request)

    # Calculate the date range for the last N days
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    start_date_str = start_date.strftime("%Y-%m-%d")

    # Fetch only bets within the date range
    bets = await db.bets.find({
        "user_id": user_id,
        "date": {"$gte": start_date_str}
    }, {"_id": 0}).sort("date", 1).to_list(10000)

    daily_data = {}
    chart_data = []
    cumulative_pl = 0

    for bet in bets:
        date = bet["date"]
        if date not in daily_data:
            daily_data[date] = {"date": date,
                                "daily_pl": 0, "cumulative_pl": 0, "bets": 0}

        daily_data[date]["daily_pl"] += bet["result"]
    for date in sorted(daily_data.keys()):
        cumulative_pl += daily_data[date]["daily_pl"]
        daily_data[date]["cumulative_pl"] = cumulative_pl
        chart_data.append(daily_data[date])

    return chart_data


@api_router.get("/analytics/calendar")
async def get_calendar_data(request: Request, year: int, month: int):
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
async def get_bookmaker_analytics(request: Request):
    user_id = await get_current_user(request)

    bets = await db.bets.find({"user_id": user_id}, {"_id": 0}).to_list(10000)

    bookie_stats = {}
    for bet in bets:
        bookie = bet.get("bookie", "Unknown")
        if bookie not in bookie_stats:
            bookie_stats[bookie] = {
                "name": bookie,
                "bets": 0,
                "stake": 0,
                "profit_loss": 0,
                "won": 0,
                "lost": 0,
                "push": 0,
                "pending": 0
            }

        bookie_stats[bookie]["bets"] += 1
        bookie_stats[bookie]["stake"] += bet["stake"]
        bookie_stats[bookie]["profit_loss"] += bet["result"]

        status = bet["status"]
        if status == "won":
            bookie_stats[bookie]["won"] += 1
        elif status == "lost":
            bookie_stats[bookie]["lost"] += 1
        elif status == "push":
            bookie_stats[bookie]["push"] += 1
        elif status == "pending":
            bookie_stats[bookie]["pending"] += 1

    # Calculate win rate and ROI for each bookie
    result = []
    for bookie, stats in bookie_stats.items():
        total_settled = stats["won"] + stats["lost"]
        stats["win_rate"] = (stats["won"] / total_settled *
                             100) if total_settled > 0 else 0
        stats["roi"] = (stats["profit_loss"] / stats["stake"]
                        * 100) if stats["stake"] > 0 else 0
        result.append(stats)

    return sorted(result, key=lambda x: x["profit_loss"], reverse=True)


@api_router.get("/analytics/tipsters")
async def get_tipster_analytics(request: Request):
    user_id = await get_current_user(request)

    bets = await db.bets.find({"user_id": user_id}, {"_id": 0}).to_list(10000)

    tipster_stats = {}
    for bet in bets:
        tipster = bet.get("tipster", "")
        if not tipster:
            continue

        if tipster not in tipster_stats:
            tipster_stats[tipster] = {
                "name": tipster,
                "bets": 0,
                "stake": 0,
                "profit_loss": 0,
                "won": 0,
                "lost": 0,
                "push": 0,
                "pending": 0
            }

        tipster_stats[tipster]["bets"] += 1
        tipster_stats[tipster]["stake"] += bet["stake"]
        tipster_stats[tipster]["profit_loss"] += bet["result"]

        status = bet["status"]
        if status == "won":
            tipster_stats[tipster]["won"] += 1
        elif status == "lost":
            tipster_stats[tipster]["lost"] += 1
        elif status == "push":
            tipster_stats[tipster]["push"] += 1
        elif status == "pending":
            tipster_stats[tipster]["pending"] += 1

    # Calculate win rate and ROI for each tipster
    result = []
    for tipster, stats in tipster_stats.items():
        total_settled = stats["won"] + stats["lost"]
        stats["win_rate"] = (stats["won"] / total_settled *
                             100) if total_settled > 0 else 0
        stats["roi"] = (stats["profit_loss"] / stats["stake"]
                        * 100) if stats["stake"] > 0 else 0
        result.append(stats)

    return sorted(result, key=lambda x: x["profit_loss"], reverse=True)


@api_router.get("/analytics/sports")
async def get_sport_analytics(request: Request):
    user_id = await get_current_user(request)

    bets = await db.bets.find({"user_id": user_id}, {"_id": 0}).to_list(10000)

    sport_stats = {}
    for bet in bets:
        sport = bet.get("sport", "Unknown")
        if not sport:
            sport = "Unknown"

        if sport not in sport_stats:
            sport_stats[sport] = {
                "name": sport,
                "bets": 0,
                "stake": 0,
                "profit_loss": 0,
                "won": 0,
                "lost": 0,
                "push": 0,
                "pending": 0
            }

        sport_stats[sport]["bets"] += 1
        sport_stats[sport]["stake"] += bet["stake"]
        sport_stats[sport]["profit_loss"] += bet["result"]

        status = bet["status"]
        if status == "won":
            sport_stats[sport]["won"] += 1
        elif status == "lost":
            sport_stats[sport]["lost"] += 1
        elif status == "push":
            sport_stats[sport]["push"] += 1
        elif status == "pending":
            sport_stats[sport]["pending"] += 1

    result = []
    for sport, stats in sport_stats.items():
        total_settled = stats["won"] + stats["lost"]
        stats["win_rate"] = (stats["won"] / total_settled *
                             100) if total_settled > 0 else 0
        stats["roi"] = (stats["profit_loss"] / stats["stake"]
                        * 100) if stats["stake"] > 0 else 0
        result.append(stats)

    return sorted(result, key=lambda x: x["profit_loss"], reverse=True)


@api_router.get("/analytics/odds-range")
async def get_odds_range_analytics(request: Request):
    user_id = await get_current_user(request)

    bets = await db.bets.find({"user_id": user_id}, {"_id": 0}).to_list(10000)

    ranges = [
        {"name": "1.00-1.50", "min": 1.0, "max": 1.5},
        {"name": "1.51-2.00", "min": 1.51, "max": 2.0},
        {"name": "2.01-3.00", "min": 2.01, "max": 3.0},
        {"name": "3.01-5.00", "min": 3.01, "max": 5.0},
        {"name": "5.01+", "min": 5.01, "max": float('inf')}
    ]

    odds_stats = {}
    for range_info in ranges:
        odds_stats[range_info["name"]] = {
            "name": range_info["name"],
            "bets": 0,
            "stake": 0,
            "profit_loss": 0,
            "won": 0,
            "lost": 0,
            "push": 0,
            "pending": 0
        }

    for bet in bets:
        odds = bet["odds"]
        for range_info in ranges:
            if range_info["min"] <= odds <= range_info["max"]:
                range_name = range_info["name"]
                odds_stats[range_name]["bets"] += 1
                odds_stats[range_name]["stake"] += bet["stake"]
                odds_stats[range_name]["profit_loss"] += bet["result"]

                status = bet["status"]
                if status == "won":
                    odds_stats[range_name]["won"] += 1
                elif status == "lost":
                    odds_stats[range_name]["lost"] += 1
                elif status == "push":
                    odds_stats[range_name]["push"] += 1
                elif status == "pending":
                    odds_stats[range_name]["pending"] += 1
                break

    result = []
    for range_name, stats in odds_stats.items():
        if stats["bets"] > 0:  # Only include ranges with bets
            total_settled = stats["won"] + stats["lost"]
            stats["win_rate"] = (
                stats["won"] / total_settled * 100) if total_settled > 0 else 0
            stats["roi"] = (stats["profit_loss"] / stats["stake"]
                            * 100) if stats["stake"] > 0 else 0
            result.append(stats)

    return result


@api_router.get("/bets/recent")
async def get_recent_bets(request: Request, limit: int = 10):
    user_id = await get_current_user(request)

    bets = await db.bets.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort([("date", -1), ("time", -1)]).limit(limit).to_list(limit)

    return bets


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


# Favorite Teams Routes

@api_router.post("/favorites/teams")
async def add_favorite_team(
    request: Request,
    team_input: FavoriteTeamCreate
):
    """Add a team to user's favorites"""
    user_id = await get_current_user(request)

    # Check if already exists
    existing = await db.favorite_teams.find_one({
        "user_id": user_id,
        "team_id": team_input.team_id
    })

    if existing:
        raise HTTPException(
            status_code=400, detail="Team already in favorites")

    favorite = {
        "user_id": user_id,
        "team_id": team_input.team_id,
        "team_name": team_input.team_name,
        "team_badge": team_input.badge,
        "sport": team_input.sport,
        "league": team_input.league,
        "added_at": datetime.now(timezone.utc)
    }

    await db.favorite_teams.insert_one(favorite)
    return {"message": "Team added to favorites", "team": favorite}


@api_router.delete("/favorites/teams/{team_id}")
async def remove_favorite_team(request: Request, team_id: str):
    """Remove a team from user's favorites"""
    user_id = await get_current_user(request)

    result = await db.favorite_teams.delete_one({
        "user_id": user_id,
        "team_id": team_id
    })

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404, detail="Team not found in favorites")

    return {"message": "Team removed from favorites"}


@api_router.get("/favorites/teams")
async def get_favorite_teams(request: Request):
    """Get all favorite teams for current user"""
    user_id = await get_current_user(request)

    teams = await db.favorite_teams.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("added_at", -1).to_list(100)

    return teams


@api_router.get("/favorites/upcoming-matches")
async def get_upcoming_matches(request: Request, days: int = 7):
    """Get upcoming matches for user's favorite teams"""
    user_id = await get_current_user(request)

    # Get user's favorite teams
    favorite_teams = await db.favorite_teams.find(
        {"user_id": user_id},
        {"team_id": 1, "team_name": 1}
    ).to_list(100)

    if not favorite_teams:
        return {}

    team_ids = [team["team_id"] for team in favorite_teams]

    # Check cache first
    now = datetime.now(timezone.utc)
    end_date = now + timedelta(days=days)

    cached_fixtures = await db.cached_fixtures.find({
        "$or": [
            {"home_team_id": {"$in": team_ids}},
            {"away_team_id": {"$in": team_ids}}
        ],
        "event_date": {
            "$gte": now.strftime("%Y-%m-%d"),
            "$lte": end_date.strftime("%Y-%m-%d")
        },
        "expires_at": {"$gt": now}
    }, {"_id": 0}).to_list(1000)

    # If cache is empty or stale, fetch from API
    if not cached_fixtures:
        cached_fixtures = await fetch_and_cache_fixtures(team_ids, days)

    # Group by date
    grouped = {}
    for fixture in cached_fixtures:
        date = fixture["event_date"]
        if date not in grouped:
            grouped[date] = []
        grouped[date].append(fixture)

    return grouped


async def fetch_and_cache_fixtures(team_ids: List[str], days: int) -> List[dict]:
    """Fetch fixtures from TheSportsDB and cache them"""
    fixtures = []
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=6)  # 6 hour cache

    async with httpx.AsyncClient(timeout=10.0) as client:
        for team_id in team_ids:
            try:
                # Fetch next 5 events for each team
                response = await client.get(
                    f"{SPORTSDB_BASE_URL}/{SPORTSDB_API_KEY}/eventsnext.php?id={team_id}"
                )

                if response.status_code != 200:
                    continue

                data = response.json()
                events = data.get("events") or []

                for event in events[:5]:  # Limit to next 5 matches
                    if not event:
                        continue

                    fixture = {
                        "fixture_id": event.get("idEvent"),
                        "home_team_id": event.get("idHomeTeam"),
                        "away_team_id": event.get("idAwayTeam"),
                        "home_team_name": event.get("strHomeTeam"),
                        "away_team_name": event.get("strAwayTeam"),
                        "home_team_badge": event.get("strHomeTeamBadge"),
                        "away_team_badge": event.get("strAwayTeamBadge"),
                        "event_date": event.get("dateEvent"),
                        "event_time": event.get("strTime"),
                        "venue": event.get("strVenue"),
                        "league": event.get("strLeague"),
                        "sport": event.get("strSport"),
                        "status": event.get("strStatus", "scheduled").lower(),
                        "cached_at": now,
                        "expires_at": expires_at
                    }

                    # Upsert to cache
                    await db.cached_fixtures.update_one(
                        {"fixture_id": fixture["fixture_id"]},
                        {"$set": fixture},
                        upsert=True
                    )

                    fixtures.append(fixture)

            except Exception as e:
                logging.error(
                    f"Error fetching fixtures for team {team_id}: {e}")
                continue

    return fixtures


@api_router.get("/teams/search")
async def search_teams(request: Request, query: str, sport: Optional[str] = None):
    """Search for teams by name"""
    # Require authentication
    await get_current_user(request)
    
    if len(query) < 2:
        return []

    # Check cache first
    cache_key = f"{sport}:{query.lower()}" if sport else query.lower()
    cached = await db.teams_cache.find_one(
        {"search_key": cache_key},
        {"_id": 0}
    )

    now = datetime.now(timezone.utc)
    if cached and cached.get("expires_at") > now:
        return cached.get("teams", [])

    # Fetch from API
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            response = await client.get(
                f"{SPORTSDB_BASE_URL}/{SPORTSDB_API_KEY}/searchteams.php?t={query}"
            )

            if response.status_code != 200:
                return []

            data = response.json()
            teams_data = data.get("teams") or []

            teams = []
            for team in teams_data:
                if not team:
                    continue

                team_sport = team.get("strSport", "").lower()
                if sport and team_sport != sport.lower():
                    continue

                teams.append({
                    "team_id": team.get("idTeam"),
                    "team_name": team.get("strTeam"),
                    "team_badge": team.get("strTeamBadge"),
                    "sport": team_sport,
                    "league": team.get("strLeague"),
                    "country": team.get("strCountry")
                })

            # Cache results
            await db.teams_cache.update_one(
                {"search_key": cache_key},
                {
                    "$set": {
                        "search_key": cache_key,
                        "teams": teams,
                        "cached_at": now,
                        "expires_at": now + timedelta(hours=24)
                    }
                },
                upsert=True
            )

            return teams

        except Exception as e:
            logging.error(f"Error searching teams: {e}")
            return []


# CORS configuration
cors_origins_env = os.environ.get('CORS_ORIGINS', '')
if cors_origins_env:
    # Split by comma and strip whitespace
    cors_origins = [origin.strip()
                    for origin in cors_origins_env.split(',') if origin.strip()]
else:
    # Default to allowing all origins (only for development)
    cors_origins = ['*']

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app.include_router(api_router)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
