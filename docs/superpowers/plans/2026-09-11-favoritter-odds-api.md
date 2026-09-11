# Favoritter Odds API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bygg `/favorites` som en Flashscore-flate med festede ligaer, mine lag og beste EU 1X2 fra The Odds API, pluss kampkort med 1X2 / O/U / BTTS.

**Architecture:** Ren logikk i `backend/odds_logic.py` (beste odds, filter, union, markeder). HTTP+TTL-cache i `backend/odds_client.py` med injiserbar `http_get`. FastAPI-ruter i `server.py` under `/api/odds/*` og `/api/favorites/*`. Frontend grupperer i `frontend/src/lib/oddsFavorites.js` og rendrer Flashscore-layout i `FavoritesPage`. Nøkkelen `ODDS_API_KEY` ligger bare i backend `.env`. Odds-payload caches i minne (ikke Mongo). Pins/lag/event-stjerner lagres i Mongo per bruker.

**Tech Stack:** FastAPI, httpx, Motor/MongoDB, React (CRA), Tailwind, shadcn Dialog, pytest, node:test.

**Spec:** `docs/superpowers/specs/2026-09-11-favoritter-odds-api-design.md`

---

## File structure

| File | Responsibility |
|------|----------------|
| `backend/odds_logic.py` | Beste 1X2, kampfilter, favoritt-union, sport-faner, søk, markedsmapping |
| `backend/odds_client.py` | The Odds API-kall, TTL-cache, 503 uten nøkkel |
| `backend/tests/test_odds_logic.py` | Enhetstester for logikk (ingen HTTP) |
| `backend/tests/test_odds_client.py` | Cache-hit og feil uten live-kall |
| `backend/server.py` | Auth-ruter som kaller logic/client + Mongo for pins |
| `backend/tests/test_odds_routes.py` | TestClient mot ruter med mock auth/client |
| `frontend/src/lib/oddsFavorites.js` | Grupper per liga, filter-etiketter, faner |
| `frontend/src/lib/oddsFavorites.test.js` | Gruppering og tom tilstand |
| `frontend/src/components/MatchMarketsDialog.jsx` | Kampkort |
| `frontend/src/pages/FavoritesPage.jsx` | Flashscore-layout |
| `README.md` | `ODDS_API_KEY` som placeholder |

Ikke i v1: tabeller, lineup, logo-pakker, «Nytt spill» fra kortet, historiske odds, nøkkel i frontend.

---

### Task 1: Beste EU 1X2 fra bookmaker-liste

**Files:**
- Create: `backend/odds_logic.py`
- Test: `backend/tests/test_odds_logic.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_odds_logic.py`:

```python
from odds_logic import best_h2h


def test_best_h2h_picks_highest_price_per_outcome_and_bookmaker():
    event = {
        "home_team": "Brann",
        "away_team": "Molde",
        "bookmakers": [
            {
                "title": "Unibet",
                "markets": [{
                    "key": "h2h",
                    "outcomes": [
                        {"name": "Brann", "price": 1.70},
                        {"name": "Draw", "price": 3.80},
                        {"name": "Molde", "price": 4.50},
                    ],
                }],
            },
            {
                "title": "Bet365",
                "markets": [{
                    "key": "h2h",
                    "outcomes": [
                        {"name": "Brann", "price": 1.72},
                        {"name": "Draw", "price": 3.75},
                        {"name": "Molde", "price": 4.40},
                    ],
                }],
            },
            {
                "title": "Coolbet",
                "markets": [{
                    "key": "h2h",
                    "outcomes": [
                        {"name": "Brann", "price": 1.68},
                        {"name": "Draw", "price": 3.90},
                        {"name": "Molde", "price": 4.60},
                    ],
                }],
            },
        ],
    }

    best = best_h2h(event)
    assert best["home"] == 1.72
    assert best["home_bookmaker"] == "Bet365"
    assert best["draw"] == 3.90
    assert best["draw_bookmaker"] == "Coolbet"
    assert best["away"] == 4.60
    assert best["away_bookmaker"] == "Coolbet"


def test_best_h2h_returns_none_without_h2h_market():
    assert best_h2h({"home_team": "A", "away_team": "B", "bookmakers": []}) is None


def test_best_h2h_allows_missing_draw_for_two_way_markets():
    event = {
        "home_team": "Djokovic",
        "away_team": "Sinner",
        "bookmakers": [{
            "title": "Unibet",
            "markets": [{
                "key": "h2h",
                "outcomes": [
                    {"name": "Djokovic", "price": 2.10},
                    {"name": "Sinner", "price": 1.75},
                ],
            }],
        }],
    }
    best = best_h2h(event)
    assert best["home"] == 2.10
    assert best["away"] == 1.75
    assert best["draw"] is None
    assert best["draw_bookmaker"] is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/markusselander/Desktop/App/backend && ./venv/bin/python -m pytest tests/test_odds_logic.py -q`

Expected: FAIL with `ModuleNotFoundError: No module named 'odds_logic'`

- [ ] **Step 3: Write minimal implementation**

Create `backend/odds_logic.py`:

```python
def _h2h_market(bookmaker):
    for market in bookmaker.get("markets") or []:
        if market.get("key") == "h2h":
            return market
    return None


def best_h2h(event):
    home = event.get("home_team")
    away = event.get("away_team")
    best = {
        "home": None,
        "draw": None,
        "away": None,
        "home_bookmaker": None,
        "draw_bookmaker": None,
        "away_bookmaker": None,
    }
    found = False
    for bookmaker in event.get("bookmakers") or []:
        market = _h2h_market(bookmaker)
        if not market:
            continue
        title = bookmaker.get("title") or bookmaker.get("key") or ""
        for outcome in market.get("outcomes") or []:
            name = outcome.get("name")
            price = outcome.get("price")
            if price is None:
                continue
            found = True
            if name == home and (best["home"] is None or price > best["home"]):
                best["home"] = price
                best["home_bookmaker"] = title
            elif name == away and (best["away"] is None or price > best["away"]):
                best["away"] = price
                best["away_bookmaker"] = title
            elif name == "Draw" and (best["draw"] is None or price > best["draw"]):
                best["draw"] = price
                best["draw_bookmaker"] = title
    if not found:
        return None
    return best
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/markusselander/Desktop/App/backend && ./venv/bin/python -m pytest tests/test_odds_logic.py -q`

Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/odds_logic.py backend/tests/test_odds_logic.py
git commit -m "$(cat <<'EOF'
Velg beste EU 1X2 per utfall fra Odds API-payload.

EOF
)"
```

---

### Task 2: Map kampkort-markeder (h2h, totals 2.5, btts)

**Files:**
- Modify: `backend/odds_logic.py`
- Modify: `backend/tests/test_odds_logic.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_odds_logic.py`:

```python
from odds_logic import map_event_markets


def test_map_event_markets_keeps_h2h_totals_near_25_and_btts():
    payload = {
        "home_team": "Brann",
        "away_team": "Molde",
        "bookmakers": [
            {
                "title": "Unibet",
                "markets": [
                    {
                        "key": "h2h",
                        "outcomes": [
                            {"name": "Brann", "price": 1.70},
                            {"name": "Draw", "price": 3.80},
                            {"name": "Molde", "price": 4.50},
                        ],
                    },
                    {
                        "key": "totals",
                        "outcomes": [
                            {"name": "Over", "price": 1.85, "point": 2.5},
                            {"name": "Under", "price": 1.95, "point": 2.5},
                            {"name": "Over", "price": 1.50, "point": 1.5},
                            {"name": "Under", "price": 2.40, "point": 1.5},
                        ],
                    },
                    {
                        "key": "btts",
                        "outcomes": [
                            {"name": "Yes", "price": 1.80},
                            {"name": "No", "price": 2.00},
                        ],
                    },
                    {
                        "key": "spreads",
                        "outcomes": [{"name": "Brann", "price": 1.90, "point": -1}],
                    },
                ],
            },
            {
                "title": "Coolbet",
                "markets": [
                    {
                        "key": "totals",
                        "outcomes": [
                            {"name": "Over", "price": 1.92, "point": 2.5},
                            {"name": "Under", "price": 1.88, "point": 2.5},
                        ],
                    },
                ],
            },
        ],
    }

    markets = {item["key"]: item for item in map_event_markets(payload)}
    assert set(markets) == {"h2h", "totals", "btts"}
    h2h_names = {row["name"]: row for row in markets["h2h"]["outcomes"]}
    assert h2h_names["Brann"]["price"] == 1.70
    totals = {row["name"]: row for row in markets["totals"]["outcomes"]}
    assert totals["Over"]["price"] == 1.92
    assert totals["Over"]["bookmaker"] == "Coolbet"
    assert totals["Over"]["point"] == 2.5
    assert "spreads" not in markets


def test_map_event_markets_omits_missing_btts():
    payload = {
        "home_team": "A",
        "away_team": "B",
        "bookmakers": [{
            "title": "Unibet",
            "markets": [{
                "key": "h2h",
                "outcomes": [{"name": "A", "price": 1.5}, {"name": "B", "price": 2.5}],
            }],
        }],
    }
    keys = [item["key"] for item in map_event_markets(payload)]
    assert keys == ["h2h"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/markusselander/Desktop/App/backend && ./venv/bin/python -m pytest tests/test_odds_logic.py::test_map_event_markets_keeps_h2h_totals_near_25_and_btts -q`

Expected: FAIL with `ImportError` or `AttributeError: map_event_markets`

- [ ] **Step 3: Write minimal implementation**

Append to `backend/odds_logic.py`:

```python
def _closest_totals_point(bookmakers, target=2.5):
    points = []
    for bookmaker in bookmakers:
        for market in bookmaker.get("markets") or []:
            if market.get("key") != "totals":
                continue
            for outcome in market.get("outcomes") or []:
                point = outcome.get("point")
                if point is not None:
                    points.append(float(point))
    if not points:
        return None
    return min(points, key=lambda value: (abs(value - target), value))


def _best_named_outcomes(bookmakers, market_key, allowed_names=None, point=None):
    best = {}
    for bookmaker in bookmakers:
        title = bookmaker.get("title") or bookmaker.get("key") or ""
        for market in bookmaker.get("markets") or []:
            if market.get("key") != market_key:
                continue
            for outcome in market.get("outcomes") or []:
                name = outcome.get("name")
                price = outcome.get("price")
                if name is None or price is None:
                    continue
                if allowed_names and name not in allowed_names:
                    continue
                if point is not None and outcome.get("point") != point:
                    continue
                current = best.get(name)
                if current is None or price > current["price"]:
                    row = {"name": name, "price": price, "bookmaker": title}
                    if outcome.get("point") is not None:
                        row["point"] = outcome["point"]
                    best[name] = row
    return list(best.values())


def map_event_markets(event):
    bookmakers = event.get("bookmakers") or []
    mapped = []
    h2h = best_h2h(event)
    if h2h:
        outcomes = []
        if h2h["home"] is not None:
            outcomes.append({"name": event.get("home_team"), "price": h2h["home"], "bookmaker": h2h["home_bookmaker"]})
        if h2h["draw"] is not None:
            outcomes.append({"name": "Draw", "price": h2h["draw"], "bookmaker": h2h["draw_bookmaker"]})
        if h2h["away"] is not None:
            outcomes.append({"name": event.get("away_team"), "price": h2h["away"], "bookmaker": h2h["away_bookmaker"]})
        mapped.append({"key": "h2h", "outcomes": outcomes})
    point = _closest_totals_point(bookmakers)
    totals = _best_named_outcomes(bookmakers, "totals", {"Over", "Under"}, point=point)
    if totals:
        mapped.append({"key": "totals", "outcomes": totals})
    btts = _best_named_outcomes(bookmakers, "btts", {"Yes", "No"})
    if btts:
        mapped.append({"key": "btts", "outcomes": btts})
    return mapped
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/markusselander/Desktop/App/backend && ./venv/bin/python -m pytest tests/test_odds_logic.py -q`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/odds_logic.py backend/tests/test_odds_logic.py
git commit -m "$(cat <<'EOF'
Map kampkort til 1X2, over/under og BTTS.

EOF
)"
```

---

### Task 3: Dato- og statusfilter for kamplisten

**Files:**
- Modify: `backend/odds_logic.py`
- Modify: `backend/tests/test_odds_logic.py`

- [ ] **Step 1: Write the failing test**

Append:

```python
from odds_logic import filter_matches


def _match(**overrides):
    row = {
        "id": "1",
        "sport_key": "soccer_norway_eliteserien",
        "sport_title": "Eliteserien",
        "commence_time": "2026-09-11T16:00:00Z",
        "home_team": "Brann",
        "away_team": "Molde",
        "completed": False,
        "scores": None,
        "odds_1x2": {"home": 1.7, "draw": 3.8, "away": 4.5},
    }
    row.update(overrides)
    return row


def test_filter_matches_by_local_date():
    rows = [
        _match(id="on", commence_time="2026-09-11T16:00:00Z"),
        _match(id="off", commence_time="2026-09-12T16:00:00Z"),
    ]
    ids = [row["id"] for row in filter_matches(rows, date="2026-09-11", status_filter="all")]
    assert ids == ["on"]


def test_filter_matches_live_finished_scheduled_odds():
    live = _match(id="live", scores=[{"name": "Brann", "score": "1"}, {"name": "Molde", "score": "0"}], completed=False)
    done = _match(id="done", completed=True, scores=[{"name": "Brann", "score": "2"}])
    soon = _match(id="soon", scores=None, completed=False, odds_1x2=None)
    priced = _match(id="priced")
    rows = [live, done, soon, priced]
    assert [row["id"] for row in filter_matches(rows, date="2026-09-11", status_filter="live")] == ["live"]
    assert [row["id"] for row in filter_matches(rows, date="2026-09-11", status_filter="finished")] == ["done"]
    assert [row["id"] for row in filter_matches(rows, date="2026-09-11", status_filter="scheduled")] == ["soon", "priced"]
    assert [row["id"] for row in filter_matches(rows, date="2026-09-11", status_filter="odds")] == ["live", "done", "priced"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/markusselander/Desktop/App/backend && ./venv/bin/python -m pytest tests/test_odds_logic.py::test_filter_matches_by_local_date -q`

Expected: FAIL (`filter_matches` missing)

- [ ] **Step 3: Write minimal implementation**

Append to `backend/odds_logic.py`:

```python
from datetime import datetime, timezone


def match_date(commence_time):
    if not commence_time:
        return None
    text = str(commence_time).replace("Z", "+00:00")
    try:
        value = datetime.fromisoformat(text)
    except ValueError:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.date().isoformat()


def match_status(match):
    if match.get("completed"):
        return "finished"
    if match.get("scores"):
        return "live"
    return "scheduled"


def filter_matches(matches, date, status_filter="all"):
    filtered = [row for row in matches if match_date(row.get("commence_time")) == date]
    if status_filter in {"live", "finished", "scheduled"}:
        filtered = [row for row in filtered if match_status(row) == status_filter]
    if status_filter == "odds":
        filtered = [row for row in filtered if row.get("odds_1x2")]
    return filtered
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/markusselander/Desktop/App/backend && ./venv/bin/python -m pytest tests/test_odds_logic.py -q`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/odds_logic.py backend/tests/test_odds_logic.py
git commit -m "$(cat <<'EOF'
Filtrer kamper på dato, live, ferdig, program og odds.

EOF
)"
```

---

### Task 4: Favoritter-union (liga, lag, event-stjerne)

**Files:**
- Modify: `backend/odds_logic.py`
- Modify: `backend/tests/test_odds_logic.py`

- [ ] **Step 1: Write the failing test**

Append:

```python
from odds_logic import favorite_matches, sport_tab_keys


def test_favorite_matches_is_union_of_league_team_and_event():
    rows = [
        _match(id="league", sport_key="soccer_epl", home_team="Arsenal", away_team="Chelsea"),
        _match(id="team", sport_key="soccer_norway_eliteserien", home_team="Brann", away_team="Molde"),
        _match(id="star", sport_key="soccer_france_ligue_one", home_team="Rennes", away_team="Marseille"),
        _match(id="other", sport_key="soccer_germany_bundesliga", home_team="Schalke", away_team="Union Berlin"),
    ]
    selected = favorite_matches(
        rows,
        league_keys=["soccer_epl"],
        teams=[{"name": "Brann", "sport_key": "soccer_norway_eliteserien"}],
        event_ids=["star"],
    )
    assert [row["id"] for row in selected] == ["league", "team", "star"]


def test_sport_tab_keys_groups_soccer_keys():
    sports = [
        {"key": "soccer_epl", "group": "Soccer", "title": "EPL", "active": True},
        {"key": "basketball_nba", "group": "Basketball", "title": "NBA", "active": True},
        {"key": "soccer_norway_eliteserien", "group": "Soccer", "title": "Eliteserien", "active": True},
    ]
    assert sport_tab_keys(sports, "soccer") == ["soccer_epl", "soccer_norway_eliteserien"]
    assert sport_tab_keys(sports, "basketball") == ["basketball_nba"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/markusselander/Desktop/App/backend && ./venv/bin/python -m pytest tests/test_odds_logic.py::test_favorite_matches_is_union_of_league_team_and_event -q`

Expected: FAIL (`favorite_matches` missing)

- [ ] **Step 3: Write minimal implementation**

Append to `backend/odds_logic.py`:

```python
def _norm(value):
    return " ".join(str(value or "").lower().split())


def favorite_matches(matches, league_keys, teams, event_ids):
    leagues = set(league_keys or [])
    events = set(event_ids or [])
    team_pairs = {(_norm(team.get("name")), team.get("sport_key")) for team in teams or []}
    selected = []
    for match in matches:
        home = _norm(match.get("home_team"))
        away = _norm(match.get("away_team"))
        key = match.get("sport_key")
        if match.get("id") in events or key in leagues:
            selected.append(match)
            continue
        if (home, key) in team_pairs or (away, key) in team_pairs:
            selected.append(match)
    return selected


TAB_GROUPS = {
    "soccer": ("soccer",),
    "tennis": ("tennis",),
    "basketball": ("basketball",),
    "icehockey": ("icehockey", "hockey"),
    "golf": ("golf",),
}


def sport_tab_keys(sports, tab):
    prefixes = TAB_GROUPS.get(tab)
    if not prefixes:
        return []
    keys = []
    for sport in sports:
        if not sport.get("active", True):
            continue
        blob = f"{sport.get('key', '')} {sport.get('group', '')}".lower()
        if any(prefix in blob for prefix in prefixes):
            keys.append(sport["key"])
    return keys
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/markusselander/Desktop/App/backend && ./venv/bin/python -m pytest tests/test_odds_logic.py -q`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/odds_logic.py backend/tests/test_odds_logic.py
git commit -m "$(cat <<'EOF'
Filtrer Favoritter som union av liga, lag og kamp.

EOF
)"
```

---

### Task 5: Søk i ligaer og lagsnavn

**Files:**
- Modify: `backend/odds_logic.py`
- Modify: `backend/tests/test_odds_logic.py`

- [ ] **Step 1: Write the failing test**

Append:

```python
from odds_logic import search_leagues_and_teams


def test_search_finds_leagues_and_teams_by_substring():
    sports = [
        {"key": "soccer_norway_eliteserien", "title": "Eliteserien", "group": "Soccer", "active": True},
        {"key": "soccer_epl", "title": "Premier League", "group": "Soccer", "active": True},
    ]
    events = [
        {"sport_key": "soccer_norway_eliteserien", "home_team": "Brann", "away_team": "Molde"},
        {"sport_key": "soccer_epl", "home_team": "Arsenal", "away_team": "Chelsea"},
    ]
    result = search_leagues_and_teams(sports, events, "bran")
    assert result["leagues"] == []
    assert result["teams"] == [{"name": "Brann", "sport_key": "soccer_norway_eliteserien"}]
    leagues = search_leagues_and_teams(sports, events, "elite")
    assert leagues["leagues"][0]["key"] == "soccer_norway_eliteserien"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/markusselander/Desktop/App/backend && ./venv/bin/python -m pytest tests/test_odds_logic.py::test_search_finds_leagues_and_teams_by_substring -q`

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Append to `backend/odds_logic.py`:

```python
def search_leagues_and_teams(sports, events, query, limit=8):
    needle = _norm(query)
    leagues = []
    if needle:
        for sport in sports:
            hay = _norm(f"{sport.get('title', '')} {sport.get('key', '')}")
            if needle in hay and sport.get("active", True):
                leagues.append({
                    "key": sport["key"],
                    "title": sport.get("title") or sport["key"],
                    "group": sport.get("group") or "",
                })
            if len(leagues) >= limit:
                break
    teams = []
    seen = set()
    if needle:
        for event in events:
            for name in (event.get("home_team"), event.get("away_team")):
                if not name or needle not in _norm(name):
                    continue
                item = (name, event.get("sport_key"))
                if item in seen:
                    continue
                seen.add(item)
                teams.append({"name": name, "sport_key": event.get("sport_key")})
                if len(teams) >= limit:
                    break
    return {"leagues": leagues, "teams": teams}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/markusselander/Desktop/App/backend && ./venv/bin/python -m pytest tests/test_odds_logic.py -q`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/odds_logic.py backend/tests/test_odds_logic.py
git commit -m "$(cat <<'EOF'
Søk i Odds API-ligaer og lagsnavn uten quota-kall.

EOF
)"
```

---

### Task 6: Odds-klient med TTL-cache og uten nøkkel

**Files:**
- Create: `backend/odds_client.py`
- Test: `backend/tests/test_odds_client.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_odds_client.py`:

```python
import asyncio

import pytest

from odds_client import OddsApiError, OddsClient


def test_cache_hit_does_not_call_http_again():
    calls = []

    async def http_get(url, params):
        calls.append((url, params))
        return [{"id": "1"}]

    async def scenario():
        client = OddsClient(api_key="test-key", http_get=http_get, now=lambda: 1_000.0)
        first = await client.get_json("/sports/soccer_epl/odds", {"regions": "eu"}, ttl_seconds=180)
        client.now = lambda: 1_100.0
        second = await client.get_json("/sports/soccer_epl/odds", {"regions": "eu"}, ttl_seconds=180)
        assert first == second == [{"id": "1"}]
        assert len(calls) == 1

    asyncio.run(scenario())


def test_missing_key_raises_503():
    async def scenario():
        client = OddsClient(api_key="", http_get=lambda url, params: None)
        with pytest.raises(OddsApiError) as exc:
            await client.get_json("/sports", {})
        assert exc.value.status_code == 503

    asyncio.run(scenario())


def test_http_error_without_cache_raises_502():
    async def http_get(url, params):
        raise RuntimeError("down")

    async def scenario():
        client = OddsClient(api_key="test-key", http_get=http_get)
        with pytest.raises(OddsApiError) as exc:
            await client.get_json("/sports/soccer_epl/odds", {})
        assert exc.value.status_code == 502

    asyncio.run(scenario())
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/markusselander/Desktop/App/backend && ./venv/bin/python -m pytest tests/test_odds_client.py -q`

Expected: FAIL (`odds_client` missing)

- [ ] **Step 3: Write minimal implementation**

Create `backend/odds_client.py`:

```python
import time
from urllib.parse import urlencode


class OddsApiError(Exception):
    def __init__(self, status_code, detail):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class OddsClient:
    BASE = "https://api.the-odds-api.com/v4"

    def __init__(self, api_key, http_get=None, now=None):
        self.api_key = api_key or ""
        self.http_get = http_get
        self.now = now or time.time
        self._cache = {}

    def _key(self, path, params):
        items = sorted((params or {}).items())
        return path + "?" + urlencode(items)

    async def get_json(self, path, params=None, ttl_seconds=180):
        if not self.api_key:
            raise OddsApiError(503, "Odds API-nøkkel mangler")
        params = dict(params or {})
        params.setdefault("apiKey", self.api_key)
        cache_key = self._key(path, {k: v for k, v in params.items() if k != "apiKey"})
        hit = self._cache.get(cache_key)
        now = self.now()
        if hit and hit["expires_at"] > now:
            return hit["payload"]
        try:
            payload = await self.http_get(f"{self.BASE}{path}", params)
        except OddsApiError:
            raise
        except Exception as exc:
            if hit:
                return hit["payload"]
            raise OddsApiError(502, "Odds API utilgjengelig") from exc
        self._cache[cache_key] = {"payload": payload, "expires_at": now + ttl_seconds}
        return payload
```

Default `http_get` i samme fil, brukt av serveren:

```python
import httpx


async def default_http_get(url, params):
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url, params=params)
        if response.status_code >= 400:
            raise OddsApiError(502, "Odds API utilgjengelig")
        return response.json()
```

TTL-konstanter:

```python
TTL_SPORTS = 12 * 60 * 60
TTL_SCORES = 2 * 60
TTL_ODDS = 3 * 60
TTL_MARKETS = 3 * 60
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/markusselander/Desktop/App/backend && ./venv/bin/python -m pytest tests/test_odds_client.py tests/test_odds_logic.py -q`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/odds_client.py backend/tests/test_odds_client.py
git commit -m "$(cat <<'EOF'
Cache Odds API-svar i minne og feil uten nøkkel.

EOF
)"
```

---

### Task 7: FastAPI-ruter for odds og favoritter

**Files:**
- Modify: `backend/server.py` (legg til import + ruter nederst før `app.include_router`, ikke slett eksisterende bets/analytics)
- Create: `backend/tests/test_odds_routes.py`
- Modify: `README.md` environment-seksjonen med `ODDS_API_KEY=your_odds_api_key_here`

Hjelpefunksjon i `odds_logic.py` (legg til i denne tasken hvis den mangler):

```python
def normalize_event(event, odds_1x2):
    return {
        "id": event.get("id"),
        "sport_key": event.get("sport_key"),
        "sport_title": event.get("sport_title"),
        "commence_time": event.get("commence_time"),
        "home_team": event.get("home_team"),
        "away_team": event.get("away_team"),
        "completed": bool(event.get("completed")),
        "scores": event.get("scores"),
        "odds_1x2": odds_1x2,
    }
```

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_odds_routes.py`:

```python
import os

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "test_odds_routes")

from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from server import app


def test_odds_sports_requires_auth():
    client = TestClient(app)
    with patch("server.get_current_user", new_callable=AsyncMock) as mock_auth:
        from fastapi import HTTPException
        mock_auth.side_effect = HTTPException(status_code=401, detail="Not authenticated")
        response = client.get("/api/odds/sports")
    assert response.status_code == 401


def test_odds_matches_favorites_empty_is_200():
    client = TestClient(app)
    fake_leagues = MagicMock()
    fake_leagues.find = MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))
    fake_teams = MagicMock()
    fake_teams.find = MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))
    fake_events = MagicMock()
    fake_events.find = MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))

    with patch("server.get_current_user", new_callable=AsyncMock, return_value="user-1"), \
         patch("server.odds_client") as odds_client, \
         patch("server.db") as db:
        odds_client.get_json = AsyncMock(return_value=[])
        db.favorite_leagues = fake_leagues
        db.favorite_teams = fake_teams
        db.favorite_events = fake_events
        response = client.get("/api/odds/matches?date=2026-09-11&tab=favorites&filter=all")
    assert response.status_code == 200
    assert response.json() == []
```

Hvis `server.odds_client` ikke finnes ennå, skal testen feile med 404 på `/api/odds/matches`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/markusselander/Desktop/App/backend && ./venv/bin/python -m pytest tests/test_odds_routes.py -q`

Expected: FAIL (404 eller missing `odds_client`)

- [ ] **Step 3: Write minimal implementation**

I `backend/server.py` nær toppen, etter eksisterende imports:

```python
from odds_client import OddsApiError, OddsClient, TTL_ODDS, TTL_SCORES, TTL_SPORTS, TTL_MARKETS, default_http_get
from odds_logic import (
    best_h2h,
    favorite_matches,
    filter_matches,
    map_event_markets,
    normalize_event,
    search_leagues_and_teams,
    sport_tab_keys,
)

odds_client = OddsClient(api_key=os.environ.get("ODDS_API_KEY", ""), http_get=default_http_get)
```

Legg til ruter. Bruk `user_id = await get_current_user(request)` som øvrige endepunkter. Mongo-kolleksjoner: `db.favorite_leagues`, `db.favorite_teams`, `db.favorite_events`.

`GET /api/odds/sports` → `odds_client.get_json("/sports", {"all": "false"}, ttl_seconds=TTL_SPORTS)` og returner listen.

`GET /api/odds/matches`:
1. Hent sports.
2. Hvis `tab=favorites`: les brukerens ligaer/lag/event_ids. `sport_keys = unique(league keys + team sport_keys)`. Hvis tomt: returner `[]` (200).
3. Ellers: `sport_keys = sport_tab_keys(sports, tab)`.
4. For hver key: scores `GET /sports/{key}/scores` med `daysFrom=3` (TTL_SCORES) og odds `GET /sports/{key}/odds` med `regions=eu&markets=h2h&oddsFormat=decimal` (TTL_ODDS). Slå sammen på `id`. `odds_1x2 = best_h2h(odds_event)`.
5. `filter_matches(...)`, og hvis favorites: `favorite_matches(...)`.
6. Catch `OddsApiError` → `HTTPException(status_code=err.status_code, detail=err.detail)`.

`GET /api/odds/matches/{event_id}/markets`: finn `sport_key` via scores/odds-cache ved å søke i samme matches-bygg, eller krev query `sport_key`. Bruk query `sport_key` (påkrevd) og kall `/sports/{sport_key}/events/{event_id}/odds?regions=eu&markets=h2h,totals,btts&oddsFormat=decimal`. Map med `map_event_markets`.

CRUD:
- POST `/api/favorites/leagues` body `{ "key", "title", "group" }` upsert `{user_id, sport_key: key, ...}`
- DELETE `/api/favorites/leagues/{sport_key}`
- GET `/api/favorites/leagues`
- Tilsvarende teams `{ name, sport_key }`
- POST/DELETE `/api/favorites/events` med `{ "event_id" }`

`GET /api/favorites/search?query=`: sports (quota-fritt) + events for inaktive? Bruk `/sports` + for treffende ligaer kall `/sports/{key}/events` (quota-fritt) og `search_leagues_and_teams`. For å unngå å loope alle sports: først filtrer sports på query, deretter events kun for de keys som matcher eller de 8 første aktive soccer-keys hvis query ser ut som lagnavn.

README: under Backend `.env` legg til linjen `ODDS_API_KEY=your_odds_api_key_here`. Ikke lim inn ekte nøkkel. Under implementasjon: sett nøkkelen i lokal `backend/.env` (gitignored).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/markusselander/Desktop/App/backend && ./venv/bin/python -m pytest tests/test_odds_routes.py tests/test_odds_logic.py tests/test_odds_client.py -q`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/server.py backend/odds_logic.py backend/tests/test_odds_routes.py README.md
git commit -m "$(cat <<'EOF'
Eksponer Odds API via backend-ruter med innlogging.

EOF
)"
```

---

### Task 8: Frontend-gruppering per liga

**Files:**
- Create: `frontend/src/lib/oddsFavorites.js`
- Test: `frontend/src/lib/oddsFavorites.test.js`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/oddsFavorites.test.js`:

```javascript
const assert = require('node:assert/strict');
const { before, test } = require('node:test');

let groupByLeague;
let sportTabs;

before(async () => {
  ({ groupByLeague, sportTabs } = await import('./oddsFavorites.js'));
});

test('groupByLeague keeps league order and match order', () => {
  const groups = groupByLeague([
    { id: '1', sport_key: 'soccer_epl', sport_title: 'EPL', home_team: 'Arsenal', away_team: 'Chelsea' },
    { id: '2', sport_key: 'soccer_epl', sport_title: 'EPL', home_team: 'City', away_team: 'Liverpool' },
    { id: '3', sport_key: 'soccer_norway_eliteserien', sport_title: 'Eliteserien', home_team: 'Brann', away_team: 'Molde' },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].sport_key, 'soccer_epl');
  assert.deepEqual(groups[0].matches.map((row) => row.id), ['1', '2']);
  assert.equal(groups[1].title, 'Eliteserien');
});

test('groupByLeague is empty for no matches', () => {
  assert.deepEqual(groupByLeague([]), []);
});

test('sportTabs starts with Favoritter', () => {
  assert.equal(sportTabs[0].id, 'favorites');
  assert.equal(sportTabs[1].id, 'soccer');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/markusselander/Desktop/App/frontend && node --test src/lib/oddsFavorites.test.js`

Expected: FAIL (ERR_MODULE_NOT_FOUND)

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/lib/oddsFavorites.js`:

```javascript
const sportTabs = [
  { id: 'favorites', label: 'Favoritter' },
  { id: 'soccer', label: 'Fotball' },
  { id: 'tennis', label: 'Tennis' },
  { id: 'basketball', label: 'Basketball' },
  { id: 'icehockey', label: 'Hockey' },
  { id: 'golf', label: 'Golf' },
];

const MATCH_FILTERS = [
  { id: 'all', label: 'Alle' },
  { id: 'live', label: 'Live' },
  { id: 'odds', label: 'Odds' },
  { id: 'finished', label: 'Ferdig' },
  { id: 'scheduled', label: 'Program' },
];

function groupByLeague(matches) {
  const groups = [];
  const index = new Map();
  for (const match of matches || []) {
    const key = match.sport_key || 'other';
    if (!index.has(key)) {
      const group = {
        sport_key: key,
        title: match.sport_title || key,
        matches: [],
      };
      index.set(key, group);
      groups.push(group);
    }
    index.get(key).matches.push(match);
  }
  return groups;
}

function formatKickoff(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

export { MATCH_FILTERS, formatKickoff, groupByLeague, sportTabs };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/markusselander/Desktop/App/frontend && node --test src/lib/oddsFavorites.test.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/oddsFavorites.js frontend/src/lib/oddsFavorites.test.js
git commit -m "$(cat <<'EOF'
Grupper Favoritter-kamper per liga i frontend.

EOF
)"
```

---

### Task 9: Flashscore-UI, sidemeny og kampkort

**Files:**
- Create: `frontend/src/components/MatchMarketsDialog.jsx`
- Modify: `frontend/src/pages/FavoritesPage.jsx`

- [ ] **Step 1: Write the failing UI contract test (dialog rendering helpers live in lib if needed)**

Ingen Enzyme. Hold UI uten snapshot-rammeverk. Legg en liten mapper i `oddsFavorites.js`:

```javascript
function marketHeading(key) {
  if (key === 'h2h') return '1X2';
  if (key === 'totals') return 'Over/under';
  if (key === 'btts') return 'Begge lag scorer';
  return key;
}
```

Test i `oddsFavorites.test.js`:

```javascript
test('marketHeading maps known keys', async () => {
  const { marketHeading } = await import('./oddsFavorites.js');
  assert.equal(marketHeading('h2h'), '1X2');
  assert.equal(marketHeading('totals'), 'Over/under');
  assert.equal(marketHeading('btts'), 'Begge lag scorer');
});
```

Kjør testen først (feiler til export finnes), implementer `marketHeading`, kjør grønt.

- [ ] **Step 2: Implement MatchMarketsDialog**

Create `frontend/src/components/MatchMarketsDialog.jsx` etter `BetDetailsDialog`-mønsteret (`Dialog`, `bg-[#18181B]`, `data-testid="match-markets-dialog"`). Props: `match`, `markets`, `open`, `onOpenChange`, `loading`, `error`. Vis hjemme–borte, kickoff, stilling fra `match.scores`. For hvert marked: heading + outcomes med `price.toFixed(2)` og `bookmaker`. Tom markets + !loading: «Odds ble ikke funnet».

- [ ] **Step 3: Implement FavoritesPage**

Erstatt `frontend/src/pages/FavoritesPage.jsx`:

- State: `tab` default `'favorites'`, `filter` `'all'`, `date` (ISO `YYYY-MM-DD` i lokal tid), `matches`, `leagues`, `teams`, `error`, `selectedMatch`, `markets`.
- Fetch `GET /api/odds/sports` (valgfritt, faner er statiske), `GET /api/favorites/leagues`, `GET /api/favorites/teams`, `GET /api/odds/matches?date&tab&filter` med `fetchWithTimeout` + `credentials: 'include'` og `authHeaders()` som øvrige sider. `BACKEND_URL` fra `process.env.REACT_APP_BACKEND_URL`.
- Layout: mørk flate `#0d1419`. Sport-faner. Grid `210px 1fr`. Venstre: «Festede ligaer», «Mine lag», knapp «+ Legg til lag» som åpner søkedialog (`GET /api/favorites/search?query=`). Ingen chips-rad.
- Liga-stjerne kaller POST/DELETE leagues. Lag-rad har fjern. Kamp-stjerne POST/DELETE `/api/favorites/events`.
- Hoved: filter-pills + dato ‹ ›. `groupByLeague(matches)`. Ligahode + rader med tid, to lagnavn, tre odds-celler. `data-testid="favorites-title"` beholdes på en visuell tittel eller første fane.
- Tom favorites: tekst «Fest en liga eller legg til et lag for å se kamper.» + samme «Legg til lag».
- Error-banner øverst ved 502/503. Siden vises likevel.
- Klikk rad → hent markets og åpne dialog.

Ikke kall `api.the-odds-api.com` fra browser.

- [ ] **Step 4: Run frontend lib tests**

Run: `cd /Users/markusselander/Desktop/App/frontend && node --test src/lib/oddsFavorites.test.js src/lib/betsDisplay.test.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/FavoritesPage.jsx frontend/src/components/MatchMarketsDialog.jsx frontend/src/lib/oddsFavorites.js frontend/src/lib/oddsFavorites.test.js
git commit -m "$(cat <<'EOF'
Bygg Favoritter som Flashscore-flate med kampkort.

EOF
)"
```

---

### Task 10: Verifiser ende-til-ende og nøkkel

**Files:**
- Modify: `backend/.env` lokalt (ikke commit)
- Verify only

- [ ] **Step 1: Put key in local env**

Sett `ODDS_API_KEY` i `backend/.env` (filen er gitignored). Aldri commit verdien. Restart uvicorn.

- [ ] **Step 2: Run full backend tests**

Run: `cd /Users/markusselander/Desktop/App/backend && ./venv/bin/python -m pytest -q`

Expected: all previously passing tests still pass, plus new odds tests.

- [ ] **Step 3: Manual browser check**

Start frontend og backend. Logg inn. Åpne `/favorites`.

Sjekkliste:
- Favoritter-fane, sidemeny uten chip-sky, «Legg til lag»
- Fest Eliteserien (søk), følg Brann, se gruppert kamp, 1X2-celler
- Klikk kamp → dialog med markeder, uten «Nytt spill»
- Fotball-fane viser program (quota: kun den fanen)
- Stopp backend Odds-nøkkel midlertidig: banner, ikke krasj
- Network-fanen i DevTools: ingen kall til `api.the-odds-api.com`

- [ ] **Step 4: Commit leftover wiring only if needed**

Ikke commit `.env`. Commit README hvis den ikke ble med i task 7.

---

## Self-review

| Spec-krav | Task |
|-----------|------|
| Flashscore-layout, faner, sidemeny, dato/filter | 9 |
| Ingen chips | 9 |
| Beste EU 1X2 | 1, 7 |
| Kampkort h2h/OU/BTTS | 2, 9 |
| Union liga+lag+event | 4, 7 |
| Søk | 5, 7 |
| Cache TTL / 502 / 503 uten nøkkel | 6, 7 |
| Auth, nøkkel bare backend | 7, 10 |
| Tester mot mock | 1–8 |
| Tom 200-liste | 7, 9 |

Ingen TBD. Navn er stabile: `best_h2h`, `map_event_markets`, `filter_matches`, `favorite_matches`, `OddsClient.get_json`.
