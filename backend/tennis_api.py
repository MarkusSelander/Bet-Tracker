from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import quote

DEFAULT_HOST = "https://tennis-api-atp-wta-itf.p.rapidapi.com"
SEARCH_MIN = 3


def tennis_sport() -> Dict[str, Any]:
    return {
        "id": "tennis",
        "label": "Tennis",
        "host": DEFAULT_HOST,
        "search_min": SEARCH_MIN,
    }


def encode_tennis_id(kind: str, tour: str, provider_id: Any) -> str:
    return f"tn:tennis:{kind}:{str(tour).lower()}_{provider_id}"


def parse_tennis_id(value: Optional[str]) -> Optional[Dict[str, str]]:
    parts = str(value or "").split(":")
    if len(parts) != 4 or parts[0] != "tn" or parts[1] != "tennis":
        return None
    kind = parts[2]
    rest = parts[3]
    if "_" not in rest:
        return None
    tour, provider_id = rest.split("_", 1)
    tour = tour.lower()
    if kind not in {"player", "tournament", "fixture"} or tour not in {"atp", "wta"}:
        return None
    if not provider_id:
        return None
    return {"sport": "tennis", "kind": kind, "tour": tour, "provider_id": provider_id}


def _first(*values: Any) -> Any:
    for value in values:
        if value not in (None, ""):
            return value
    return None


def _as_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _tour_from_category(category: str) -> Optional[str]:
    text = str(category or "").lower()
    if text.endswith("_wta") or text == "wta":
        return "wta"
    if text.endswith("_atp") or text == "atp":
        return "atp"
    return None


def _split_datetime(value: Any) -> tuple:
    if isinstance(value, dict):
        value = _first(value.get("start"), value.get("date"), value.get("datetime"))
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


def normalize_player(raw: Dict[str, Any], tour: str) -> Optional[Dict[str, Any]]:
    if not isinstance(raw, dict):
        return None
    player_id = _first(raw.get("id"), raw.get("playerId"), raw.get("player_id"))
    name = _first(raw.get("name"), raw.get("playerName"), raw.get("player_name"))
    if player_id is None or not name:
        return None
    country = _first(raw.get("countryAcr"), raw.get("country"), raw.get("nationality"))
    return {
        "kind": "player",
        "player_id": encode_tennis_id("player", tour, player_id),
        "player_name": name,
        "photo": _first(raw.get("image"), raw.get("photo"), raw.get("playerImage")),
        "sport": "tennis",
        "league": tour.upper(),
        "country": country,
        "team_id": None,
        "team_name": tour.upper(),
        "source": "tennis-api",
    }


def normalize_tournament(raw: Dict[str, Any], tour: str) -> Optional[Dict[str, Any]]:
    if not isinstance(raw, dict):
        return None
    tournament_id = _first(raw.get("id"), raw.get("seasonId"), raw.get("seasonid"), raw.get("tournamentId"))
    name = _first(raw.get("name"), raw.get("tournamentName"), raw.get("tourName"))
    if tournament_id is None or not name:
        return None
    return {
        "kind": "team",
        "team_id": encode_tennis_id("tournament", tour, tournament_id),
        "team_name": name,
        "team_badge": _first(raw.get("image"), raw.get("logo")),
        "sport": "tennis",
        "league": tour.upper(),
        "source": "tennis-api",
    }


def normalize_search_items(payload: Any) -> List[Dict[str, Any]]:
    buckets = payload
    if isinstance(payload, dict):
        buckets = payload.get("data") or payload.get("result") or []
    items: List[Dict[str, Any]] = []
    for bucket in buckets or []:
        if not isinstance(bucket, dict):
            continue
        tour = _tour_from_category(bucket.get("category") or "")
        rows = bucket.get("result") if isinstance(bucket.get("result"), list) else []
        category = str(bucket.get("category") or "").lower()
        for raw in rows:
            if category.startswith("player"):
                player = normalize_player(raw, tour or "atp")
                if player:
                    items.append(player)
            elif category.startswith("tournament"):
                tournament = normalize_tournament(raw, tour or "atp")
                if tournament:
                    items.append(tournament)
    return items


def parse_tennis_fixtures(tour: str, payload: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    fixtures = []
    rows = payload
    if isinstance(payload, dict):
        rows = payload.get("data") or payload.get("response") or []
    for raw in rows or []:
        if not isinstance(raw, dict):
            continue
        fixture_id = _first(raw.get("id"), raw.get("fixtureId"), raw.get("gameId"))
        player1 = _as_dict(raw.get("player1"))
        player2 = _as_dict(raw.get("player2"))
        home_name = _first(player1.get("name"), raw.get("player1Name"), raw.get("home"))
        away_name = _first(player2.get("name"), raw.get("player2Name"), raw.get("away"))
        home_id = _first(player1.get("id"), raw.get("player1Id"))
        away_id = _first(player2.get("id"), raw.get("player2Id"))
        tournament = _as_dict(raw.get("tournament"))
        league = _first(tournament.get("name"), raw.get("tournamentName"), raw.get("tourName"), tour.upper())
        date_value = _first(raw.get("date"), raw.get("datetime"), raw.get("startDate"), raw.get("start"))
        event_date, event_time = _split_datetime(date_value)
        if not event_time:
            event_time = str(_first(raw.get("time"), raw.get("startTime"), "") or "")
        if fixture_id is None or not home_name or not away_name:
            continue
        fixtures.append(
            {
                "fixture_id": encode_tennis_id("fixture", tour, fixture_id),
                "home_team_id": encode_tennis_id("player", tour, home_id) if home_id is not None else None,
                "away_team_id": encode_tennis_id("player", tour, away_id) if away_id is not None else None,
                "home_team_name": home_name,
                "away_team_name": away_name,
                "home_team_badge": _first(player1.get("image"), raw.get("player1Image")),
                "away_team_badge": _first(player2.get("image"), raw.get("player2Image")),
                "event_date": event_date,
                "event_time": event_time,
                "league": league,
                "sport": "tennis",
                "status": str(_first(raw.get("status"), "NS")).lower(),
                "source": "tennis-api",
            }
        )
    return fixtures


class TennisApiClient:
    def __init__(self, api_key: str, host: Optional[str] = None, http=None):
        self.api_key = api_key
        self.host = (host or DEFAULT_HOST).rstrip("/")
        if not self.host.startswith("http"):
            self.host = f"https://{self.host}"
        self.http = http

    def _headers(self) -> Dict[str, str]:
        hostname = self.host.replace("https://", "").replace("http://", "")
        return {
            "X-RapidAPI-Key": self.api_key,
            "X-RapidAPI-Host": hostname,
        }

    def _url(self, path: str, params: Optional[Dict[str, Any]] = None) -> str:
        query = ""
        if params:
            pairs = [f"{key}={quote(str(value))}" for key, value in params.items() if value not in (None, "")]
            query = ("?" + "&".join(pairs)) if pairs else ""
        return f"{self.host}{path}{query}"

    def _parse_body(self, payload: Any) -> Any:
        if isinstance(payload, dict) and "data" in payload:
            return payload.get("data")
        return payload

    async def aget(self, path: str, params: Optional[Dict[str, Any]] = None) -> Any:
        if self.http is None:
            raise RuntimeError("HTTP client missing")
        response = await self.http.get(self._url(path, params), headers=self._headers())
        if getattr(response, "status_code", 200) >= 400:
            return []
        payload = response.json() if hasattr(response, "json") else {}
        return self._parse_body(payload)

    async def asearch(self, query: str, kind: str = "all") -> List[Dict[str, Any]]:
        if len(query.strip()) < SEARCH_MIN:
            return []
        raw = await self.aget("/tennis/v2/search", {"search": query.strip()})
        items = normalize_search_items(raw if isinstance(raw, list) else {"data": raw})
        if kind == "player":
            return [item for item in items if item.get("kind") == "player"]
        if kind == "team":
            return [item for item in items if item.get("kind") == "team"]
        return items

    async def aupcoming_for_player(self, player_id: str) -> List[Dict[str, Any]]:
        parsed = parse_tennis_id(player_id)
        if not parsed or parsed["kind"] != "player":
            return []
        raw = await self.aget(
            f"/tennis/v2/{parsed['tour']}/fixtures/player/{parsed['provider_id']}",
            {"include": "tournament,round", "pageSize": 20},
        )
        return parse_tennis_fixtures(parsed["tour"], raw)

    async def aupcoming_for_tournament(self, tournament_id: str) -> List[Dict[str, Any]]:
        parsed = parse_tennis_id(tournament_id)
        if not parsed or parsed["kind"] != "tournament":
            return []
        raw = await self.aget(
            f"/tennis/v2/{parsed['tour']}/fixtures/tournament/{parsed['provider_id']}",
            {"include": "tournament,round", "pageSize": 20},
        )
        return parse_tennis_fixtures(parsed["tour"], raw)
