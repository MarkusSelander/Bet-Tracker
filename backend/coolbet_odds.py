import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

_STRIP = re.compile(r"\b(fk|fc|sk|il|if|bk|cf|ac|as|the)\b", re.I)
_SPLIT = re.compile(r"\s+[-–vV]{1,3}\s+")


def normalize_name(value: Optional[str]) -> str:
    text = (value or "").lower()
    text = _STRIP.sub(" ", text)
    return re.sub(r"[^a-z0-9æøåäöü]+", " ", text, flags=re.I).strip()


def names_match(left: str, right: str) -> bool:
    a, b = normalize_name(left), normalize_name(right)
    if not a or not b:
        return False
    return a == b or a in b or b in a


def event_title(event: Dict[str, Any]) -> str:
    return (
        event.get("name")
        or event.get("match_name")
        or event.get("eventName")
        or ""
    )


def event_sides(event: Dict[str, Any]) -> tuple:
    home = event.get("home_name") or event.get("homeTeamName") or event.get("home_team_name")
    away = event.get("away_name") or event.get("awayTeamName") or event.get("away_team_name")
    if home and away:
        return str(home), str(away)
    parts = _SPLIT.split(event_title(event), maxsplit=1)
    if len(parts) == 2:
        return parts[0], parts[1]
    return "", ""


def event_date_key(event: Dict[str, Any]) -> Optional[str]:
    raw = (
        event.get("start_date")
        or event.get("startTime")
        or event.get("start_time")
        or event.get("date")
        or event.get("event_date")
    )
    if not raw:
        return None
    text = str(raw)
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return text[:10] if len(text) >= 10 else None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.date().isoformat()


def flatten_search_payload(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ("matches", "events", "results", "data", "tickets"):
        value = payload.get(key)
        if isinstance(value, list):
            items = [item for item in value if isinstance(item, dict)]
            if items:
                return items
            continue
        if isinstance(value, dict):
            nested = flatten_search_payload(value)
            if nested:
                return nested
    if payload.get("id") or payload.get("name") or payload.get("match_name"):
        return [payload]
    return []


def match_event(fixture: Dict[str, Any], events: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    want_date = str(fixture.get("event_date") or "")[:10]
    home = fixture.get("home_team_name") or ""
    away = fixture.get("away_team_name") or ""
    for event in events:
        if event_date_key(event) != want_date:
            continue
        event_home, event_away = event_sides(event)
        if names_match(home, event_home) and names_match(away, event_away):
            return event
        if names_match(home, event_away) and names_match(away, event_home):
            return event
    return None


def _outcome_odds(item: Dict[str, Any]) -> Optional[float]:
    value = item.get("odds") if item.get("odds") is not None else item.get("price")
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def extract_1x2(event: Optional[Dict[str, Any]]) -> Optional[Dict[str, float]]:
    if not event:
        return None
    markets = event.get("markets") or event.get("market_list") or []
    if not isinstance(markets, list):
        return None
    for market in markets:
        if not isinstance(market, dict):
            continue
        label = str(market.get("name") or market.get("market_name") or "").lower()
        mtype = str(market.get("type") or market.get("market_type") or "").lower()
        if "1x2" not in label and "1x2" not in mtype and "match result" not in label:
            continue
        outcomes = [
            item
            for item in (market.get("outcomes") or market.get("selections") or [])
            if isinstance(item, dict)
        ]
        if len(outcomes) < 3:
            continue
        mapped = {"home": None, "draw": None, "away": None}
        for outcome in outcomes:
            name = str(outcome.get("name") or outcome.get("outcome_name") or "").lower()
            odds = _outcome_odds(outcome)
            if name in {"1", "home", "h"}:
                mapped["home"] = odds
            elif name in {"x", "draw", "tie", "uavgjort"}:
                mapped["draw"] = odds
            elif name in {"2", "away", "a"}:
                mapped["away"] = odds
        if None in mapped.values():
            mapped = {
                "home": _outcome_odds(outcomes[0]),
                "draw": _outcome_odds(outcomes[1]),
                "away": _outcome_odds(outcomes[2]),
            }
        if None not in mapped.values():
            return mapped
    return None


def event_id(event: Optional[Dict[str, Any]]) -> Optional[str]:
    if not event:
        return None
    value = event.get("id") or event.get("event_id") or event.get("match_id")
    return str(value) if value is not None else None


def attach_odds(fixture: Dict[str, Any], events: List[Dict[str, Any]]) -> Dict[str, Any]:
    event = match_event(fixture, events)
    return {
        **fixture,
        "odds_1x2": extract_1x2(event),
        "coolbet_event_id": event_id(event),
    }


_LINE = re.compile(r"(\d+(?:\.\d+)?)")


def classify_market(market: Dict[str, Any]) -> Optional[str]:
    label = str(market.get("name") or market.get("market_name") or "").lower()
    mtype = str(market.get("type") or market.get("market_type") or "").lower()
    blob = f"{label} {mtype}"
    if "1x2" in blob or "match result" in blob:
        return "1x2"
    if "both teams" in blob or "btts" in blob or "begge lag" in blob:
        return "btts"
    if "over/under" in blob or "over under" in blob or "total goals" in blob:
        return "over_under"
    return None


def extract_main_markets(event: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not event:
        return []
    raw = event.get("markets") or event.get("market_list") or []
    if not isinstance(raw, list):
        return []
    found: Dict[str, Dict[str, Any]] = {}
    for market in raw:
        if not isinstance(market, dict):
            continue
        key = classify_market(market)
        if not key or key in found:
            continue
        outcomes = []
        for item in market.get("outcomes") or market.get("selections") or []:
            if not isinstance(item, dict):
                continue
            odds = _outcome_odds(item)
            name = item.get("name") or item.get("outcome_name")
            if name and odds is not None:
                outcomes.append({"name": str(name), "odds": odds})
        if not outcomes:
            continue
        line = None
        if key == "over_under":
            match = _LINE.search(str(market.get("name") or market.get("line") or ""))
            if match:
                line = float(match.group(1))
            elif market.get("line") is not None:
                line = float(market["line"])
        found[key] = {
            "key": key,
            "name": market.get("name") or market.get("market_name") or key,
            "line": line,
            "outcomes": outcomes,
        }
    order = ["1x2", "over_under", "btts"]
    return [found[key] for key in order if key in found]


from urllib.parse import quote_plus

COOLBET_SEARCH_URL = "https://www.coolbet.com/s/sbgate/sports/search"
COOLBET_HEADERS = {
    "accept": "application/json",
    "x-language": "eu",
}


def search_query(home: str, away: str) -> str:
    return f"{home} {away}".strip()


def fetch_coolbet_events(home: str, away: str, client: Any = None) -> List[Dict[str, Any]]:
    query = search_query(home, away)
    if not query:
        return []
    url = f"{COOLBET_SEARCH_URL}?query={quote_plus(query)}&language=eu&layout=EUROPEAN"
    http = client
    close = False
    if http is None:
        import httpx

        http = httpx.Client(timeout=10.0)
        close = True
    try:
        response = http.get(url, timeout=10.0, headers=COOLBET_HEADERS)
        if getattr(response, "status_code", 200) != 200:
            return []
        payload = response.json()
        return flatten_search_payload(payload)
    except Exception:
        return []
    finally:
        if close:
            http.close()
