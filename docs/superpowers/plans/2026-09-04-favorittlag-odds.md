# Favorittlag med Coolbet-odds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ett menypunkt Favoritter med SofaScore-feed (kommende kamper + Coolbet 1X2) og et kampkort med flere Coolbet-markeder.

**Architecture:** TheSportsDB forblir kilde for lag, logoer og kampoppsett (eksisterende favoritt-API). Ny modul `backend/coolbet_odds.py` matcher kamp mot Coolbet og trekker ut 1X2/hovedmarkeder; `server.py` beriker `GET /favorites/upcoming-matches` og eksponerer `GET /favorites/matches/{fixture_id}/markets`. Frontend grupperer feeden i `frontend/src/lib/favorites.js` og rendrer `FavoritesPage` + `MatchOddsDialog`.

**Tech Stack:** FastAPI, MongoDB, httpx, React (CRA), Tailwind, existing Dialog-komponenter, pytest, node:test.

**Spec:** `docs/superpowers/specs/2026-09-04-favorittlag-odds-design.md`

---

## File structure

| File | Responsibility |
|------|----------------|
| `backend/coolbet_odds.py` | Navnematching, 1X2/markeder, payload-flatten, cache-nøkler, Coolbet-søk |
| `backend/tests/test_coolbet_odds.py` | Enhetstester for matching og mapping (ingen live HTTP) |
| `backend/server.py` | Kalle beriking på upcoming-matches; nytt markets-endepunkt |
| `frontend/src/lib/favorites.js` | Grupper feed på dag+liga; CJS-eksport som `calendar.js` |
| `frontend/src/lib/favorites.test.js` | Tester for gruppering |
| `frontend/src/components/MatchOddsDialog.jsx` | Kampkort-dialog |
| `frontend/src/pages/FavoritesPage.jsx` | Søk, chips, SofaScore-liste |
| `frontend/src/components/Sidebar.jsx` | Nav-lenke |
| `frontend/src/App.js` | Rute `/favorites` |

Ikke i v1: lineup, H2H, live-score, andre bookmakere, lag som undermenyer.

---

### Task 1: Match kamp mot Coolbet-event og trekk ut 1X2

**Files:**
- Create: `backend/coolbet_odds.py`
- Test: `backend/tests/test_coolbet_odds.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_coolbet_odds.py`:

```python
from coolbet_odds import attach_odds, extract_1x2, flatten_search_payload, match_event


def test_flatten_reads_matches_or_events_lists():
    nested = flatten_search_payload({"matches": [{"id": "1", "name": "Brann - Viking"}]})
    assert nested[0]["id"] == "1"
    direct = flatten_search_payload([{"id": "2"}])
    assert direct[0]["id"] == "2"


def test_match_event_pairs_same_day_and_both_team_names():
    fixture = {
        "home_team_name": "SK Brann",
        "away_team_name": "Viking FK",
        "event_date": "2026-09-06",
    }
    events = [
        {"id": "wrong", "name": "Rosenborg - Molde", "start_date": "2026-09-06T16:00:00Z"},
        {"id": "hit", "name": "Brann - Viking", "startTime": "2026-09-06T16:00:00.000Z"},
    ]
    assert match_event(fixture, events)["id"] == "hit"


def test_match_event_returns_none_when_date_or_names_differ():
    fixture = {
        "home_team_name": "Brann",
        "away_team_name": "Viking",
        "event_date": "2026-09-06",
    }
    assert match_event(fixture, [{"id": "a", "name": "Brann - Viking", "start_date": "2026-09-07T16:00:00Z"}]) is None
    assert match_event(fixture, [{"id": "b", "name": "Brann - Molde", "start_date": "2026-09-06T16:00:00Z"}]) is None


def test_extract_1x2_from_named_market():
    odds = extract_1x2(
        {
            "markets": [
                {
                    "name": "Match Result (1X2)",
                    "outcomes": [
                        {"name": "1", "odds": 1.85},
                        {"name": "X", "odds": 3.4},
                        {"name": "2", "odds": 4.2},
                    ],
                }
            ]
        }
    )
    assert odds == {"home": 1.85, "draw": 3.4, "away": 4.2}


def test_attach_odds_sets_nulls_when_no_event():
    fixture = {
        "fixture_id": "e1",
        "home_team_name": "Brann",
        "away_team_name": "Viking",
        "event_date": "2026-09-06",
    }
    out = attach_odds(fixture, [])
    assert out["odds_1x2"] is None
    assert out["coolbet_event_id"] is None
    assert out["fixture_id"] == "e1"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/markusselander/Desktop/App/backend && ./venv/bin/python -m pytest tests/test_coolbet_odds.py -q`

Expected: FAIL with `ModuleNotFoundError: No module named 'coolbet_odds'`

- [ ] **Step 3: Write minimal implementation**

Create `backend/coolbet_odds.py`:

```python
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
            return [item for item in value if isinstance(item, dict)]
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
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd /Users/markusselander/Desktop/App/backend && ./venv/bin/python -m pytest tests/test_coolbet_odds.py -q`

Expected: PASS (5 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/coolbet_odds.py backend/tests/test_coolbet_odds.py
git commit -m "$(cat <<'EOF'
Match TheSportsDB-kamper mot Coolbet-events og trekk ut 1X2.

EOF
)"
```

---

### Task 2: Trekk ut 1X2, over/under og BTTS til kampkortet

**Files:**
- Modify: `backend/coolbet_odds.py`
- Test: `backend/tests/test_coolbet_odds.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_coolbet_odds.py`:

```python
from coolbet_odds import extract_main_markets


def test_extract_main_markets_keeps_1x2_ou_btts_only():
    markets = extract_main_markets(
        {
            "id": "hit",
            "markets": [
                {
                    "name": "Match Result (1X2)",
                    "outcomes": [
                        {"name": "1", "odds": 1.85},
                        {"name": "X", "odds": 3.4},
                        {"name": "2", "odds": 4.2},
                    ],
                },
                {
                    "name": "Total Goals Over/Under 2.5",
                    "outcomes": [
                        {"name": "Over", "odds": 1.72},
                        {"name": "Under", "odds": 2.05},
                    ],
                },
                {
                    "name": "Both Teams to Score",
                    "outcomes": [
                        {"name": "Yes", "odds": 1.8},
                        {"name": "No", "odds": 1.95},
                    ],
                },
                {
                    "name": "Correct Score",
                    "outcomes": [{"name": "1-0", "odds": 8.0}],
                },
            ],
        }
    )
    names = [market["key"] for market in markets]
    assert names == ["1x2", "over_under", "btts"]
    assert markets[1]["line"] == 2.5
    assert markets[2]["outcomes"][0]["odds"] == 1.8


def test_extract_main_markets_empty_without_event():
    assert extract_main_markets(None) == []
    assert extract_main_markets({}) == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/markusselander/Desktop/App/backend && ./venv/bin/python -m pytest tests/test_coolbet_odds.py::test_extract_main_markets_keeps_1x2_ou_btts_only -q`

Expected: FAIL with `ImportError` or `extract_main_markets` not defined

- [ ] **Step 3: Write minimal implementation**

Append to `backend/coolbet_odds.py`:

```python
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
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd /Users/markusselander/Desktop/App/backend && ./venv/bin/python -m pytest tests/test_coolbet_odds.py -q`

Expected: PASS (7 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/coolbet_odds.py backend/tests/test_coolbet_odds.py
git commit -m "$(cat <<'EOF'
Begrens kampkort-markeder til 1X2, over/under og BTTS.

EOF
)"
```

---

### Task 3: Coolbet-søk (HTTP) med mockbar client

**Files:**
- Modify: `backend/coolbet_odds.py`
- Test: `backend/tests/test_coolbet_odds.py`

- [ ] **Step 1: Write the failing test**

Append:

```python
from coolbet_odds import search_query, fetch_coolbet_events


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def json(self):
        return self._payload


class FakeClient:
    def __init__(self, payload):
        self.payload = payload
        self.urls = []

    def get(self, url, timeout=10.0, headers=None):
        self.urls.append(url)
        return FakeResponse(self.payload)


def test_search_query_joins_team_names():
    assert search_query("Brann", "Viking") == "Brann Viking"


def test_fetch_coolbet_events_uses_search_url_and_flattens():
    client = FakeClient({"matches": [{"id": "9", "name": "Brann - Viking"}]})
    events = fetch_coolbet_events("Brann", "Viking", client=client)
    assert events[0]["id"] == "9"
    assert "s/sbgate/sports/search" in client.urls[0]
    assert "Brann" in client.urls[0]


def test_fetch_coolbet_events_returns_empty_on_http_error():
    class Boom:
        def get(self, url, timeout=10.0, headers=None):
            raise RuntimeError("network")

    assert fetch_coolbet_events("Brann", "Viking", client=Boom()) == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/markusselander/Desktop/App/backend && ./venv/bin/python -m pytest tests/test_coolbet_odds.py::test_fetch_coolbet_events_uses_search_url_and_flattens -q`

Expected: FAIL (`search_query` / `fetch_coolbet_events` undefined)

- [ ] **Step 3: Write minimal implementation**

Append to `backend/coolbet_odds.py`:

```python
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
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd /Users/markusselander/Desktop/App/backend && ./venv/bin/python -m pytest tests/test_coolbet_odds.py -q`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/coolbet_odds.py backend/tests/test_coolbet_odds.py
git commit -m "$(cat <<'EOF'
Hent Coolbet-events via søk, med tom liste ved nettverksfeil.

EOF
)"
```

---

### Task 4: Berik upcoming-matches og markets-endepunkt i server.py

**Files:**
- Modify: `backend/server.py` (import + `get_upcoming_matches` rundt linje 1379–1423, nytt endepunkt etter den)
- Test: `backend/tests/test_coolbet_odds.py` (hold HTTP-løs: test `enrich_fixtures` her)

If `server.py` is awkward to unit-test without Mongo, put `enrich_fixtures` in `coolbet_odds.py` and call it from the route.

- [ ] **Step 1: Write the failing test**

Append:

```python
from coolbet_odds import enrich_fixtures, markets_payload


def test_enrich_fixtures_calls_search_once_per_fixture():
    fixture = {
        "fixture_id": "fix-1",
        "home_team_name": "Brann",
        "away_team_name": "Viking",
        "event_date": "2026-09-06",
    }
    event = {
        "id": "cb-1",
        "name": "Brann - Viking",
        "start_date": "2026-09-06T16:00:00Z",
        "markets": [
            {
                "name": "Match Result (1X2)",
                "outcomes": [
                    {"name": "1", "odds": 1.9},
                    {"name": "X", "odds": 3.5},
                    {"name": "2", "odds": 4.0},
                ],
            }
        ],
    }

    def fake_fetch(home, away, client=None):
        assert home == "Brann"
        return [event]

    out = enrich_fixtures([fixture], fetch_events=fake_fetch)
    assert out[0]["coolbet_event_id"] == "cb-1"
    assert out[0]["odds_1x2"]["home"] == 1.9


def test_markets_payload_uses_cached_event_or_empty():
    event = {
        "id": "cb-1",
        "markets": [
            {
                "name": "Both Teams to Score",
                "outcomes": [{"name": "Yes", "odds": 1.8}, {"name": "No", "odds": 1.95}],
            }
        ],
    }
    payload = markets_payload({"coolbet_event_id": "cb-1"}, event)
    assert payload["missing"] is False
    assert payload["markets"][0]["key"] == "btts"
    empty = markets_payload({"coolbet_event_id": None}, None)
    assert empty["missing"] is True
    assert empty["markets"] == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/markusselander/Desktop/App/backend && ./venv/bin/python -m pytest tests/test_coolbet_odds.py::test_enrich_fixtures_calls_search_once_per_fixture -q`

Expected: FAIL (`enrich_fixtures` undefined)

- [ ] **Step 3: Write minimal implementation**

Append to `backend/coolbet_odds.py`:

```python
def enrich_fixtures(fixtures: List[Dict[str, Any]], fetch_events=None) -> List[Dict[str, Any]]:
    fetch = fetch_events or fetch_coolbet_events
    enriched = []
    for fixture in fixtures:
        events = fetch(
            fixture.get("home_team_name") or "",
            fixture.get("away_team_name") or "",
        )
        enriched.append(attach_odds(fixture, events))
    return enriched


def markets_payload(fixture: Dict[str, Any], event: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not fixture.get("coolbet_event_id") or not event:
        return {"markets": [], "missing": True}
    return {"markets": extract_main_markets(event), "missing": False, "coolbet_event_id": fixture.get("coolbet_event_id")}
```

Then in `backend/server.py` add import near `from coolbet import map_coolbet_ticket`:

```python
from coolbet_odds import enrich_fixtures, fetch_coolbet_events, markets_payload, match_event, extract_main_markets
```

Replace the grouping loop in `get_upcoming_matches` so fixtures are enriched first:

```python
    cached_fixtures = enrich_fixtures(cached_fixtures, fetch_events=fetch_coolbet_events)

    grouped = {}
    for fixture in cached_fixtures:
        date = fixture["event_date"]
        if date not in grouped:
            grouped[date] = []
        grouped[date].append(fixture)

    return grouped
```

Add after `get_upcoming_matches`:

```python
@api_router.get("/favorites/matches/{fixture_id}/markets")
async def get_favorite_match_markets(request: Request, fixture_id: str):
    await get_current_user(request)
    fixture = await db.cached_fixtures.find_one({"fixture_id": fixture_id}, {"_id": 0})
    if not fixture:
        return {"markets": [], "missing": True}

    events = fetch_coolbet_events(
        fixture.get("home_team_name") or "",
        fixture.get("away_team_name") or "",
    )
    event = match_event(fixture, events)
    enriched = {
        **fixture,
        "coolbet_event_id": event.get("id") if event else None,
    }
    if event and event.get("id"):
        enriched["coolbet_event_id"] = str(event.get("id"))
    return markets_payload(enriched, event)
```

If `match_event` returns a dict without attaching 1x2 here, that is fine — markets endpoint only needs markets.

Optional 5-minute cache: skip in v1 unless enrich is slow; `enrich_fixtures` already isolates fetch.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd /Users/markusselander/Desktop/App/backend && ./venv/bin/python -m pytest tests/test_coolbet_odds.py tests/test_coolbet.py -q`

Expected: PASS (existing coolbet tests still pass)

- [ ] **Step 5: Commit**

```bash
git add backend/coolbet_odds.py backend/tests/test_coolbet_odds.py backend/server.py
git commit -m "$(cat <<'EOF'
Berik favorittkamper med Coolbet-odds og eksponer kampmarkeder.

EOF
)"
```

---

### Task 5: Grupper feed på dag og liga (frontend)

**Files:**
- Create: `frontend/src/lib/favorites.js`
- Test: `frontend/src/lib/favorites.test.js`

Upcoming API returns `{ "2026-09-06": [fixture, ...], ... }`. The page needs SofaScore grouping: date → league → matches.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/favorites.test.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildFavoriteFeed, formatKickoff } = require('./favorites');

test('buildFavoriteFeed groups by date then league and keeps 1x2', () => {
  const grouped = {
    '2026-09-07': [
      {
        fixture_id: '2',
        event_date: '2026-09-07',
        event_time: '17:00:00',
        league: 'Premier League',
        home_team_name: 'Arsenal',
        away_team_name: 'Chelsea',
        odds_1x2: { home: 1.95, draw: 3.5, away: 3.8 },
      },
    ],
    '2026-09-06': [
      {
        fixture_id: '1',
        event_date: '2026-09-06',
        event_time: '18:00:00',
        league: 'Eliteserien',
        home_team_name: 'Brann',
        away_team_name: 'Viking',
        odds_1x2: { home: 1.85, draw: 3.4, away: 4.2 },
      },
      {
        fixture_id: '3',
        event_date: '2026-09-06',
        event_time: '20:00:00',
        league: 'Eliteserien',
        home_team_name: 'Rosenborg',
        away_team_name: 'Molde',
        odds_1x2: null,
        coolbet_event_id: null,
      },
    ],
  };

  const feed = buildFavoriteFeed(grouped);
  assert.equal(feed[0].date, '2026-09-06');
  assert.equal(feed[0].leagues[0].name, 'Eliteserien');
  assert.equal(feed[0].leagues[0].matches.length, 2);
  assert.equal(feed[0].leagues[0].matches[0].odds_1x2.home, 1.85);
  assert.equal(feed[1].leagues[0].name, 'Premier League');
});

test('formatKickoff slices to HH:MM', () => {
  assert.equal(formatKickoff('18:00:00'), '18:00');
  assert.equal(formatKickoff(null), '');
});

test('buildFavoriteFeed treats empty payload as empty list', () => {
  assert.deepEqual(buildFavoriteFeed({}), []);
  assert.deepEqual(buildFavoriteFeed(null), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/markusselander/Desktop/App && node --test frontend/src/lib/favorites.test.js`

Expected: FAIL (`Cannot find module './favorites'`)

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/lib/favorites.js`:

```javascript
function formatKickoff(time) {
  if (!time) return '';
  return String(time).slice(0, 5);
}

function buildFavoriteFeed(grouped) {
  if (!grouped || typeof grouped !== 'object') return [];
  const dates = Object.keys(grouped).sort();
  return dates.map((date) => {
    const matches = Array.isArray(grouped[date]) ? grouped[date] : [];
    const byLeague = {};
    for (const match of matches) {
      const league = match.league || 'Ukjent liga';
      if (!byLeague[league]) byLeague[league] = [];
      byLeague[league].push(match);
    }
    const leagues = Object.keys(byLeague)
      .sort()
      .map((name) => ({
        name,
        matches: byLeague[name].slice().sort((a, b) => String(a.event_time || '').localeCompare(String(b.event_time || ''))),
      }));
    return { date, leagues };
  });
}

exports.__esModule = true;
exports.formatKickoff = formatKickoff;
exports.buildFavoriteFeed = buildFavoriteFeed;
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd /Users/markusselander/Desktop/App && node --test frontend/src/lib/favorites.test.js`

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/favorites.js frontend/src/lib/favorites.test.js
git commit -m "$(cat <<'EOF'
Grupper favorittkamper på dag og liga som SofaScore-feed.

EOF
)"
```

---

### Task 6: FavoritesPage, kampkort, meny og rute

**Files:**
- Create: `frontend/src/pages/FavoritesPage.jsx`
- Create: `frontend/src/components/MatchOddsDialog.jsx`
- Modify: `frontend/src/components/Sidebar.jsx` (navItems etter Analyse)
- Modify: `frontend/src/App.js` (import + Route)

- [ ] **Step 1: Write MatchOddsDialog**

Create `frontend/src/components/MatchOddsDialog.jsx`:

```jsx
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

const MARKET_LABELS = {
  '1x2': 'Kampresultat',
  over_under: 'Over/under',
  btts: 'Begge lag scorer',
};

export default function MatchOddsDialog({ match, markets, missing, open, onOpenChange, loading }) {
  if (!match) return null;
  const title = `${match.home_team_name || ''} – ${match.away_team_name || ''}`.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#18181B] border-[#27272A] max-w-lg">
        <DialogHeader>
          <DialogTitle>{title || 'Kamp'}</DialogTitle>
          <DialogDescription>
            {[match.league, match.event_date, String(match.event_time || '').slice(0, 5)].filter(Boolean).join(' · ')}
          </DialogDescription>
        </DialogHeader>
        {loading ? <p className="text-sm text-text-muted">Henter odds…</p> : null}
        {!loading && missing ? (
          <p className="text-sm text-text-muted">Odds ble ikke funnet hos Coolbet for denne kampen.</p>
        ) : null}
        {!loading && !missing && Array.isArray(markets) ? (
          <div className="space-y-3">
            {markets.map((market) => (
              <div key={market.key} className="rounded-md border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-xs text-text-secondary mb-1">
                  {MARKET_LABELS[market.key] || market.name}
                  {market.line ? ` ${market.line}` : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(market.outcomes || []).map((outcome) => (
                    <span key={outcome.name} className="text-sm font-mono">
                      {outcome.name} {Number(outcome.odds).toFixed(2)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Write FavoritesPage**

Create `frontend/src/pages/FavoritesPage.jsx` with: `useOutletContext` for auth shell, `PageHeader` title `Favoritter` subtitle `Kommende kamper · odds fra Coolbet`, search input (min 2 tegn) calling `GET ${BACKEND_URL}/teams/search?query=`, results dropdown, `POST /favorites/teams` with `{ team_id, team_name, sport, league, badge: team_badge }`, chips from `GET /favorites/teams` with × calling `DELETE /favorites/teams/${team_id}`, feed from `GET /favorites/upcoming-matches` through `buildFavoriteFeed`. Empty favorites: text `Søk opp lag du vil følge.` plus the search field. Each match row is a button showing kickoff, optional 20px badges, names, and three `font-mono` odds or `—`. Click sets selected match and fetches `GET /favorites/matches/${fixture_id}/markets`. Render `MatchOddsDialog`. Use `cardClass = 'bg-[#18181B] border border-[#27272A] rounded-xl p-4'`. `fetch` with `credentials: 'include'`. Toast errors with sonner. `data-testid="favorites-title"` on PageHeader.

Badge field: API create model uses `badge`; list documents use `team_badge`. When posting, send `badge: team.team_badge`. When rendering chips, use `team.team_badge || team.badge`.

- [ ] **Step 3: Wire nav and router**

In `frontend/src/components/Sidebar.jsx` add `Star` to the lucide import. Insert after analytics:

```javascript
  { to: '/analytics', icon: BarChart3, label: 'Analyse', testId: 'nav-analytics' },
  { to: '/favorites', icon: Star, label: 'Favoritter', testId: 'nav-favorites' },
  { to: '/settings', icon: Settings, label: 'Innstillinger', testId: 'nav-settings' },
```

In `frontend/src/App.js`:

```javascript
import FavoritesPage from './pages/FavoritesPage';
```

Inside the protected routes, after analytics:

```javascript
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
```

- [ ] **Step 4: Run unit tests again**

Run:

```bash
cd /Users/markusselander/Desktop/App/backend && ./venv/bin/python -m pytest tests/test_coolbet_odds.py tests/test_coolbet.py -q
cd /Users/markusselander/Desktop/App && node --test frontend/src/lib/favorites.test.js frontend/src/lib/calendar.test.js
```

Expected: all PASS

- [ ] **Step 5: Manual check**

Start frontend if needed. Open `/favorites`. Confirm menu label, empty state, search, chip add/remove, feed grouping, dialog. If Coolbet search 403/empty, rows still show without odds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/FavoritesPage.jsx frontend/src/components/MatchOddsDialog.jsx frontend/src/components/Sidebar.jsx frontend/src/App.js
git commit -m "$(cat <<'EOF'
Legg Favoritter i menyen med SofaScore-feed og Coolbet-kampkort.

EOF
)"
```

---

## Self-review

**Spec coverage**
- Menypunkt + `/favorites` → Task 6
- Søk/chips POST/DELETE → Task 6 (existing API)
- Feed dag/liga, 1X2, tom odds → Task 5 + 6 + 4
- Kampkort 1X2/O/U/BTTS, forklaring uten treff → Task 2 + 4 + 6
- Berik upcoming-matches, ikke ekstra list-API → Task 4
- SportsDB nede / Coolbet nede → fetch returnerer `[]`, attach setter null (Task 3–4); page viser lag/kamper likevel (Task 6)
- Tester matching, tom odds, markets, gruppering → Task 1, 2, 4, 5

**Out of scope (do not implement):** undermenyer per lag, SofaScore-statistikk, andre bookmakere.
