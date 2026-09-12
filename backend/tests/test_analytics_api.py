import os

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "test_analytics")

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from server import app

ANALYTICS_FILTERS = {"date_from", "date_to", "sport", "bookie", "tipster"}
ANALYTICS_PATHS = [
    "/api/analytics/stats",
    "/api/analytics/chart",
    "/api/analytics/calendar",
    "/api/analytics/bookmakers",
    "/api/analytics/tipsters",
    "/api/analytics/sports",
    "/api/analytics/odds-range",
    "/api/analytics/leagues",
    "/api/analytics/ticket-types",
    "/api/analytics/summary",
]


def _query_param_names(path: str):
    def collect(dependant):
        names = {param.name for param in dependant.query_params}
        for child in dependant.dependencies:
            names |= collect(child)
        return names

    for route in app.routes:
        if getattr(route, "path", None) == path and "GET" in getattr(route, "methods", set()):
            return collect(route.dependant)
    raise AssertionError(f"No GET {path}")


@pytest.mark.parametrize("path", ANALYTICS_PATHS)
def test_analytics_endpoints_accept_shared_filters(path):
    assert ANALYTICS_FILTERS <= _query_param_names(path)


def test_bets_list_accepts_analyse_drilldown_filters():
    names = _query_param_names("/api/bets")
    assert {"sport", "league", "ticket_type", "odds_min", "odds_max"} <= names
    assert {"date_from", "date_to", "bookie", "tipster", "status"} <= names


def test_chart_days_all_is_not_unprocessable():
    client = TestClient(app)
    with patch("server.get_current_user", new_callable=AsyncMock) as mock_auth:
        mock_auth.side_effect = HTTPException(status_code=401, detail="Not authenticated")
        response = client.get("/api/analytics/chart?days=all")

    assert response.status_code != 422
    assert response.status_code == 401


def test_leagues_and_ticket_types_endpoints_exist():
    client = TestClient(app)
    with patch("server.get_current_user", new_callable=AsyncMock) as mock_auth:
        mock_auth.side_effect = HTTPException(status_code=401, detail="Not authenticated")
        leagues = client.get("/api/analytics/leagues")
        tickets = client.get("/api/analytics/ticket-types")

    assert leagues.status_code != 404
    assert tickets.status_code != 404
    assert leagues.status_code == 401
    assert tickets.status_code == 401


class _FakeCursor:
    def __init__(self, docs, projection=None):
        self.docs = list(docs)
        self.projection = projection or {}
        self.sort_args = []

    def sort(self, *args, **kwargs):
        self.sort_args.append((args, kwargs))
        return self

    def limit(self, n):
        self.docs = self.docs[:n]
        return self

    def _project(self, doc):
        projection = self.projection
        if not projection:
            return dict(doc)
        excluded = {key for key, value in projection.items() if key != "_id" and value == 0}
        included = {key for key, value in projection.items() if key != "_id" and value}
        data = {key: value for key, value in doc.items() if key != "_id"}
        if excluded:
            return {key: value for key, value in data.items() if key not in excluded}
        if included:
            return {key: value for key, value in data.items() if key in included}
        return data

    async def to_list(self, n):
        return [self._project(doc) for doc in self.docs]


def _auth_and_bets(bets):
    mock_db = MagicMock()

    def find(*args, **kwargs):
        projection = args[1] if len(args) > 1 else kwargs.get("projection")
        return _FakeCursor(bets, projection)

    mock_db.bets.find.side_effect = find
    return (
        patch("server.get_current_user", new_callable=AsyncMock, return_value="user_1"),
        patch("server.db", mock_db),
    )


def test_stats_and_leagues_apply_shared_filters():
    bets = [
        {
            "date": "2026-03-01",
            "status": "won",
            "stake": 100,
            "result": 80,
            "odds": 1.8,
            "sport": "Football",
            "bookie": "Coolbet",
            "tipster": "Anna",
            "league": "Eliteserien",
            "ticket_type": "single",
        },
        {
            "date": "2026-03-02",
            "status": "lost",
            "stake": 50,
            "result": -50,
            "odds": 2.1,
            "sport": "Tennis",
            "bookie": "Unibet",
            "tipster": "Bo",
            "league": "ATP",
            "ticket_type": "combo",
        },
    ]
    auth, db_find = _auth_and_bets(bets)
    client = TestClient(app)
    with auth, db_find:
        stats = client.get("/api/analytics/stats?sport=Football")
        leagues = client.get("/api/analytics/leagues?sport=Football")
        tickets = client.get("/api/analytics/ticket-types?date_from=2026-03-02&date_to=2026-03-02")

    assert stats.status_code == 200
    assert stats.json()["total_bets"] == 1
    assert stats.json()["won_count"] == 1
    assert leagues.status_code == 200
    assert [row["name"] for row in leagues.json()] == ["Eliteserien"]
    assert tickets.status_code == 200
    assert [row["name"] for row in tickets.json()] == ["combo"]


def test_chart_filters_by_date_range_when_days_omitted():
    bets = [
        {"date": "2026-01-10", "status": "won", "stake": 10, "result": 5, "odds": 1.5, "sport": "Football", "bookie": "Coolbet", "tipster": None},
        {"date": "2026-02-10", "status": "lost", "stake": 10, "result": -10, "odds": 1.5, "sport": "Football", "bookie": "Coolbet", "tipster": None},
        {"date": "2026-03-10", "status": "won", "stake": 10, "result": 8, "odds": 1.5, "sport": "Football", "bookie": "Coolbet", "tipster": None},
    ]
    auth, db_find = _auth_and_bets(bets)
    client = TestClient(app)
    with auth, db_find:
        response = client.get("/api/analytics/chart?date_from=2026-02-01&date_to=2026-02-28")

    assert response.status_code == 200
    assert [row["date"] for row in response.json()] == ["2026-02-10"]
    assert response.json()[0]["daily_stake"] == 10
    assert response.json()[0]["cumulative_stake"] == 10


def test_bets_list_filters_sport_league_ticket_and_odds():
    bets = [
        {
            "bet_id": "1",
            "user_id": "user_1",
            "date": "2026-03-01",
            "game": "A - B",
            "bet": "1",
            "status": "won",
            "stake": 100,
            "result": 80,
            "odds": 1.8,
            "sport": "Football",
            "bookie": "Coolbet",
            "tipster": "Anna",
            "league": "Eliteserien",
            "ticket_type": "single",
            "created_at": "2026-03-01T12:00:00+00:00",
        },
        {
            "bet_id": "2",
            "user_id": "user_1",
            "date": "2026-03-02",
            "game": "C - D",
            "bet": "2",
            "status": "lost",
            "stake": 50,
            "result": -50,
            "odds": 3.2,
            "sport": "Football",
            "bookie": "Coolbet",
            "tipster": "Anna",
            "league": "Eliteserien",
            "ticket_type": "combo",
            "created_at": "2026-03-02T12:00:00+00:00",
        },
    ]
    auth, db_find = _auth_and_bets(bets)
    client = TestClient(app)
    with auth, db_find:
        response = client.get(
            "/api/bets?sport=Football&league=Eliteserien&ticket_type=single&odds_min=1.5&odds_max=2.0"
        )

    assert response.status_code == 200
    assert [bet["bet_id"] for bet in response.json()] == ["1"]


def test_summary_endpoint_matches_filtered_stats():
    bets = [
        {
            "date": "2026-03-01",
            "status": "won",
            "stake": 100,
            "result": 80,
            "odds": 1.8,
            "sport": "Football",
            "bookie": "Coolbet",
            "tipster": "Anna",
            "league": "Eliteserien",
            "ticket_type": "single",
        },
        {
            "date": "2026-03-02",
            "status": "lost",
            "stake": 50,
            "result": -50,
            "odds": 2.1,
            "sport": "Tennis",
            "bookie": "Unibet",
            "tipster": "Bo",
            "league": "ATP",
            "ticket_type": "combo",
        },
    ]
    auth, db_find = _auth_and_bets(bets)
    client = TestClient(app)
    with auth, db_find:
        summary = client.get("/api/analytics/summary?sport=Football")
        stats = client.get("/api/analytics/stats?sport=Football")

    assert summary.status_code == 200
    body = summary.json()
    assert body["stats"]["total_bets"] == 1
    assert body["stats"] == stats.json()
    assert [row["name"] for row in body["leagues"]] == ["Eliteserien"]
    assert "Football" in body["sport_options"]
    assert "Tennis" in body["sport_options"]


def test_bets_list_omits_legs_by_default():
    bets = [
        {
            "bet_id": "1",
            "user_id": "user_1",
            "date": "2026-03-01",
            "game": "A - B",
            "bet": "1",
            "status": "pending",
            "stake": 100,
            "result": 0,
            "odds": 1.8,
            "sport": "Football",
            "bookie": "Coolbet",
            "tipster": "Anna",
            "league": "Eliteserien",
            "ticket_type": "combo",
            "created_at": "2026-03-01T12:00:00+00:00",
            "legs": [{"match": "A - B", "outcome": "1"}],
        }
    ]
    auth, db_find = _auth_and_bets(bets)
    client = TestClient(app)
    with auth, db_find:
        hidden = client.get("/api/bets?status=pending")
        shown = client.get("/api/bets?status=pending&include_legs=true")

    assert hidden.status_code == 200
    assert "legs" not in hidden.json()[0] or hidden.json()[0]["legs"] is None
    assert shown.status_code == 200
    assert shown.json()[0]["legs"][0]["match"] == "A - B"


def test_recent_bets_include_legs_when_requested():
    bets = [
        {
            "bet_id": "1",
            "user_id": "user_1",
            "date": "2026-09-12",
            "time": "20:00:00",
            "game": "David Martinez - Den lange (+3)",
            "bet": "Over 2.5",
            "status": "lost",
            "stake": 700,
            "result": -700,
            "odds": 2.18,
            "sport": "Football",
            "bookie": "Coolbet",
            "ticket_type": "combo",
            "total_matches": 4,
            "legs": [
                {"match": "David Martinez - Den lange", "outcome": "Over 2.5"},
                {"match": "A - B", "outcome": "1"},
            ],
        }
    ]
    auth, db_find = _auth_and_bets(bets)
    client = TestClient(app)
    with auth, db_find:
        hidden = client.get("/api/bets/recent?limit=8")
        shown = client.get("/api/bets/recent?limit=8&include_legs=true")

    assert hidden.status_code == 200
    assert "legs" not in hidden.json()[0] or hidden.json()[0]["legs"] is None
    assert shown.status_code == 200
    assert shown.json()[0]["legs"][0]["match"] == "David Martinez - Den lange"
    assert shown.json()[0]["total_matches"] == 4


def test_pending_list_does_not_return_settled_bets():
    bets = [
        {
            "bet_id": "won",
            "user_id": "user_1",
            "date": "2026-03-01",
            "game": "A - B",
            "bet": "1",
            "status": "won",
            "stake": 100,
            "result": 80,
            "odds": 1.8,
            "sport": "Football",
            "bookie": "Coolbet",
            "created_at": "2026-03-01T12:00:00+00:00",
        },
        {
            "bet_id": "open",
            "user_id": "user_1",
            "date": "2026-03-02",
            "game": "C - D",
            "bet": "2",
            "status": "pending",
            "stake": 50,
            "result": 0,
            "odds": 2.0,
            "sport": "Football",
            "bookie": "Coolbet",
            "created_at": "2026-03-02T12:00:00+00:00",
        },
    ]
    auth, db_find = _auth_and_bets(bets)
    client = TestClient(app)
    with auth, db_find:
        response = client.get("/api/bets?status=pending&limit=20")

    assert response.status_code == 200
    assert [bet["bet_id"] for bet in response.json()] == ["open"]


def test_source_ids_returns_compact_rows():
    bets = [
        {
            "source_id": "ticket-a",
            "status": "pending",
            "bookie": "Coolbet",
            "ticket_type": "combo",
            "total_matches": 3,
            "legs": [{"x": 1}],
        },
        {"source_id": "ticket-b", "status": "won", "bookie": "Coolbet"},
    ]
    auth, db_find = _auth_and_bets(bets)
    client = TestClient(app)
    with auth, db_find:
        response = client.get("/api/bets/source-ids?bookie=Coolbet")

    assert response.status_code == 200
    assert response.json() == [
        {
            "source_id": "ticket-a",
            "status": "pending",
            "ticket_type": "combo",
            "total_matches": 3,
            "legs_count": 1,
        },
        {
            "source_id": "ticket-b",
            "status": "won",
            "ticket_type": None,
            "total_matches": None,
            "legs_count": 0,
        },
    ]


def test_coolbet_import_uses_bulk_write():
    mock_db = MagicMock()
    mock_db.bets.find.side_effect = lambda *args, **kwargs: _FakeCursor([])
    mock_db.bets.bulk_write = AsyncMock()
    mock_db.users.update_one = AsyncMock()
    ticket = {
        "id": "ticket-abc",
        "display_id": 1949,
        "created_at": "2026-09-02T17:12:17.012Z",
        "status": "WON",
        "total_stake": 700,
        "max_win": 1274,
        "remaining_max_win": 1274,
        "product": "PREMATCH",
        "currency": "NOK",
        "ticket_type": "single",
        "total_matches": 1,
        "first_bet_odds": 1.82,
        "first_match": {
            "sport_name": "Fotball",
            "match_name": "Brann - Rosenborg",
            "league_name": "Eliteserien",
            "market_name": "Match Result (1X2)",
            "outcome_name": "Brann",
        },
    }
    client = TestClient(app)
    with (
        patch("server.get_current_user", new_callable=AsyncMock, return_value="user_1"),
        patch("server.db", mock_db),
    ):
        response = client.post("/api/bets/import/coolbet", json={"tickets": [ticket]})

    assert response.status_code == 200
    assert response.json()["imported"] == 1
    mock_db.bets.bulk_write.assert_awaited_once()
    assert len(mock_db.bets.bulk_write.await_args.args[0]) == 1


def test_stats_query_sorts_by_date_then_time():
    cursor = _FakeCursor([])
    mock_db = MagicMock()
    mock_db.bets.find.return_value = cursor
    client = TestClient(app)
    with patch("server.get_current_user", new_callable=AsyncMock, return_value="user_1"), patch(
        "server.db", mock_db
    ):
        response = client.get("/api/analytics/stats")

    assert response.status_code == 200
    assert cursor.sort_args == [(([("date", 1), ("time", 1)],), {})]
