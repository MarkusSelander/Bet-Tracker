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
    def __init__(self, docs):
        self.docs = docs

    def sort(self, *args, **kwargs):
        return self

    async def to_list(self, n):
        return list(self.docs)


def _auth_and_bets(bets):
    mock_db = MagicMock()
    mock_db.bets.find.return_value = _FakeCursor(bets)
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
