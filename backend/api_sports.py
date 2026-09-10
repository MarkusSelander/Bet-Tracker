from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urlencode

SPORTS: Dict[str, Dict[str, Any]] = {
    "football": {
        "id": "football",
        "label": "Fotball",
        "host": "https://v3.football.api-sports.io",
        "shape": "football_v3",
        "search_min": 3,
        "upcoming_path": "/fixtures",
        "teams_path": "/teams",
        "players_path": "/players",
        "players_search_path": "/players/profiles",
    },
    "basketball": {
        "id": "basketball",
        "label": "Basket",
        "host": "https://v1.basketball.api-sports.io",
        "shape": "game_v1",
        "search_min": 3,
        "upcoming_path": "/games",
        "teams_path": "/teams",
        "players_path": "/players",
    },
    "hockey": {
        "id": "hockey",
        "label": "Ishockey",
        "host": "https://v1.hockey.api-sports.io",
        "shape": "game_v1",
        "search_min": 3,
        "upcoming_path": "/games",
        "teams_path": "/teams",
        "players_path": "/players",
    },
    "american-football": {
        "id": "american-football",
        "label": "Amerikansk fotball",
        "host": "https://v1.american-football.api-sports.io",
        "shape": "game_v1",
        "search_min": 3,
        "upcoming_path": "/games",
        "teams_path": "/teams",
        "players_path": "/players",
    },
}


def list_sports() -> List[Dict[str, Any]]:
    return [
        {"id": spec["id"], "label": spec["label"], "host": spec["host"], "search_min": spec["search_min"]}
        for spec in SPORTS.values()
    ]


def sport_spec(sport: Optional[str]) -> Dict[str, Any]:
    key = (sport or "football").lower()
    if key in {"soccer", "fotball"}:
        key = "football"
    if key not in SPORTS:
        key = "football"
    return SPORTS[key]


def encode_entity_id(sport: str, kind: str, provider_id: Any) -> str:
    return f"as:{sport}:{kind}:{provider_id}"


def parse_entity_id(value: Optional[str]) -> Optional[Dict[str, str]]:
    text = str(value or "")
    parts = text.split(":")
    if len(parts) != 4 or parts[0] != "as":
        return None
    return {"sport": parts[1], "kind": parts[2], "provider_id": parts[3]}


def football_season(month: Optional[int] = None, year: Optional[int] = None) -> int:
    now = datetime.now()
    month = month if month is not None else now.month
    year = year if year is not None else now.year
    return year if month >= 7 else year - 1


def upcoming_path(sport: str) -> str:
    return sport_spec(sport)["upcoming_path"]


def players_search_path(sport: str) -> str:
    spec = sport_spec(sport)
    return spec.get("players_search_path") or spec["players_path"]


def current_team_from_history(sport: str, payload: Iterable[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    spec = sport_spec(sport)
    best = None
    best_season = -1
    for raw in payload or []:
        if not isinstance(raw, dict):
            continue
        team = raw.get("team") if isinstance(raw.get("team"), dict) else {}
        seasons = raw.get("seasons") if isinstance(raw.get("seasons"), list) else []
        latest = -1
        for season in seasons:
            try:
                latest = max(latest, int(season))
            except (TypeError, ValueError):
                continue
        if team.get("id") is None or latest < best_season:
            continue
        best_season = latest
        best = team
    if not best:
        return None
    return {
        "team_id": encode_entity_id(spec["id"], "team", best["id"]),
        "team_name": best.get("name"),
        "team_badge": best.get("logo"),
    }


def _first(*values: Any) -> Any:
    for value in values:
        if value not in (None, ""):
            return value
    return None


def normalize_team(sport: str, raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not isinstance(raw, dict):
        return None
    spec = sport_spec(sport)
    nested = raw.get("team") if isinstance(raw.get("team"), dict) else raw
    team_id = _first(nested.get("id"), raw.get("id"))
    name = _first(nested.get("name"), raw.get("name"))
    if team_id is None or not name:
        return None
    league = None
    if isinstance(raw.get("league"), dict):
        league = raw["league"].get("name")
    return {
        "kind": "team",
        "team_id": encode_entity_id(spec["id"], "team", team_id),
        "team_name": name,
        "team_badge": _first(nested.get("logo"), raw.get("logo")),
        "sport": spec["id"],
        "league": league,
        "country": _first(nested.get("country"), raw.get("country"), raw.get("nation")),
        "source": "api-sports",
    }


def normalize_player(sport: str, raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not isinstance(raw, dict):
        return None
    spec = sport_spec(sport)
    nested = raw.get("player") if isinstance(raw.get("player"), dict) else raw
    player_id = _first(nested.get("id"), raw.get("id"))
    name = _first(
        nested.get("name"),
        " ".join(part for part in (nested.get("firstname"), nested.get("lastname")) if part).strip(),
        raw.get("name"),
    )
    if player_id is None or not name:
        return None
    stats = raw.get("statistics") if isinstance(raw.get("statistics"), list) else []
    team = {}
    league = None
    if stats and isinstance(stats[0], dict):
        team = stats[0].get("team") or {}
        league_raw = stats[0].get("league") or {}
        league = league_raw.get("name") if isinstance(league_raw, dict) else None
    if not team and isinstance(raw.get("team"), dict):
        team = raw["team"]
    team_id = team.get("id") if isinstance(team, dict) else None
    return {
        "kind": "player",
        "player_id": encode_entity_id(spec["id"], "player", player_id),
        "player_name": name,
        "photo": _first(nested.get("photo"), nested.get("image")),
        "sport": spec["id"],
        "league": league,
        "team_id": encode_entity_id(spec["id"], "team", team_id) if team_id is not None else None,
        "team_name": team.get("name") if isinstance(team, dict) else None,
        "team_badge": team.get("logo") if isinstance(team, dict) else None,
        "source": "api-sports",
    }


def _split_datetime(value: Any) -> tuple:
    if isinstance(value, dict):
        value = value.get("start") or value.get("date")
    text = str(value or "")
    if "T" in text:
        date, rest = text.split("T", 1)
        time = rest.split("+", 1)[0].split("-", 1)[0]
        if len(time) == 5:
            time = f"{time}:00"
        return date, time[:8]
    if len(text) >= 10:
        return text[:10], ""
    return "", ""


def parse_fixtures(sport: str, payload: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    spec = sport_spec(sport)
    fixtures = []
    for raw in payload or []:
        if not isinstance(raw, dict):
            continue
        fixture_block = raw.get("fixture") if isinstance(raw.get("fixture"), dict) else raw
        fixture_id = _first(fixture_block.get("id"), raw.get("id"))
        teams = raw.get("teams") if isinstance(raw.get("teams"), dict) else {}
        home = teams.get("home") if isinstance(teams.get("home"), dict) else {}
        away = teams.get("away") if isinstance(teams.get("away"), dict) else teams.get("visitors")
        away = away if isinstance(away, dict) else {}
        league = raw.get("league") if isinstance(raw.get("league"), dict) else {}
        date_value = _first(fixture_block.get("date"), raw.get("date"), raw.get("datetime"))
        event_date, event_time = _split_datetime(date_value)
        if fixture_id is None or not home.get("name") or not away.get("name"):
            continue
        status = fixture_block.get("status") if isinstance(fixture_block.get("status"), dict) else {}
        fixtures.append(
            {
                "fixture_id": encode_entity_id(spec["id"], "fixture", fixture_id),
                "home_team_id": encode_entity_id(spec["id"], "team", home.get("id")) if home.get("id") is not None else None,
                "away_team_id": encode_entity_id(spec["id"], "team", away.get("id")) if away.get("id") is not None else None,
                "home_team_name": home.get("name"),
                "away_team_name": away.get("name"),
                "home_team_badge": home.get("logo"),
                "away_team_badge": away.get("logo"),
                "event_date": event_date,
                "event_time": event_time,
                "league": league.get("name"),
                "sport": spec["id"],
                "status": str(status.get("short") or raw.get("status") or "NS").lower(),
                "source": "api-sports",
            }
        )
    return fixtures


class ApiSportsClient:
    def __init__(self, api_key: str, http=None):
        self.api_key = api_key
        self.http = http

    def _headers(self) -> Dict[str, str]:
        return {"x-apisports-key": self.api_key}

    def _url(self, sport: str, path: str, params: Optional[Dict[str, Any]] = None) -> str:
        spec = sport_spec(sport)
        query = urlencode({key: value for key, value in (params or {}).items() if value not in (None, "")})
        url = f"{spec['host']}{path}"
        return f"{url}?{query}" if query else url

    def _parse_body(self, payload: Any) -> List[Dict[str, Any]]:
        if not isinstance(payload, dict):
            return []
        data = payload.get("response")
        return data if isinstance(data, list) else []

    def get(self, sport: str, path: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        if self.http is None:
            raise RuntimeError("HTTP client missing")
        response = self.http.get(self._url(sport, path, params), headers=self._headers())
        if hasattr(response, "raise_for_status"):
            try:
                response.raise_for_status()
            except Exception:
                return []
        payload = response.json() if hasattr(response, "json") else {}
        return self._parse_body(payload)

    async def aget(self, sport: str, path: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        if self.http is None:
            raise RuntimeError("HTTP client missing")
        response = await self.http.get(self._url(sport, path, params), headers=self._headers())
        if getattr(response, "status_code", 200) >= 400:
            return []
        payload = response.json() if hasattr(response, "json") else {}
        return self._parse_body(payload)

    def search_teams(self, query: str, sport: Optional[str] = None) -> List[Dict[str, Any]]:
        sports = [sport_spec(sport)["id"]] if sport else list(SPORTS)
        results = []
        for sport_id in sports:
            spec = sport_spec(sport_id)
            if len(query.strip()) < spec["search_min"]:
                continue
            raw = self.get(sport_id, spec["teams_path"], {"search": query.strip()})
            for item in raw:
                team = normalize_team(sport_id, item)
                if team:
                    results.append(team)
        return results

    def search_players(self, query: str, sport: Optional[str] = None) -> List[Dict[str, Any]]:
        sports = [sport_spec(sport)["id"]] if sport else ["football"]
        results = []
        for sport_id in sports:
            spec = sport_spec(sport_id)
            if len(query.strip()) < spec["search_min"]:
                continue
            raw = self.get(sport_id, players_search_path(sport_id), {"search": query.strip()})
            for item in raw:
                player = normalize_player(sport_id, item)
                if player:
                    results.append(player)
        return results

    def upcoming_for_team(self, team_id: str, next_count: int = 12) -> List[Dict[str, Any]]:
        parsed = parse_entity_id(team_id)
        if not parsed or parsed["kind"] != "team":
            return []
        sport = parsed["sport"]
        raw = self.get(
            sport,
            upcoming_path(sport),
            {"team": parsed["provider_id"], "next": next_count, "timezone": "Europe/Oslo"},
        )
        return parse_fixtures(sport, raw)

    async def asearch_teams(self, query: str, sport: Optional[str] = None) -> List[Dict[str, Any]]:
        sports = [sport_spec(sport)["id"]] if sport else list(SPORTS)
        results = []
        for sport_id in sports:
            spec = sport_spec(sport_id)
            if len(query.strip()) < spec["search_min"]:
                continue
            raw = await self.aget(sport_id, spec["teams_path"], {"search": query.strip()})
            for item in raw:
                team = normalize_team(sport_id, item)
                if team:
                    results.append(team)
        return results

    async def asearch_players(self, query: str, sport: Optional[str] = None) -> List[Dict[str, Any]]:
        sports = [sport_spec(sport)["id"]] if sport else ["football"]
        results = []
        for sport_id in sports:
            spec = sport_spec(sport_id)
            if len(query.strip()) < spec["search_min"]:
                continue
            raw = await self.aget(sport_id, players_search_path(sport_id), {"search": query.strip()})
            for item in raw:
                player = normalize_player(sport_id, item)
                if player:
                    results.append(player)
        return results

    async def aupcoming_for_team(self, team_id: str, next_count: int = 12) -> List[Dict[str, Any]]:
        parsed = parse_entity_id(team_id)
        if not parsed or parsed["kind"] != "team":
            return []
        sport = parsed["sport"]
        raw = await self.aget(
            sport,
            upcoming_path(sport),
            {"team": parsed["provider_id"], "next": next_count, "timezone": "Europe/Oslo"},
        )
        return parse_fixtures(sport, raw)

    def current_team_for_player(self, player_id: str) -> Optional[Dict[str, Any]]:
        parsed = parse_entity_id(player_id)
        if not parsed or parsed["kind"] != "player":
            return None
        raw = self.get(parsed["sport"], "/players/teams", {"player": parsed["provider_id"]})
        return current_team_from_history(parsed["sport"], raw)

    async def acurrent_team_for_player(self, player_id: str) -> Optional[Dict[str, Any]]:
        parsed = parse_entity_id(player_id)
        if not parsed or parsed["kind"] != "player":
            return None
        raw = await self.aget(parsed["sport"], "/players/teams", {"player": parsed["provider_id"]})
        return current_team_from_history(parsed["sport"], raw)
