import asyncio
import os
import time

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "test_login_speed")

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

import server
from server import app
from stats import bet_cash_pipeline, compute_cash_position, sum_bet_cash


class _FakeCursor:
    def __init__(self, docs, projection=None):
        self.docs = [dict(doc) for doc in docs]
        self.projection = projection or {}

    def sort(self, *args, **kwargs):
        return self

    def limit(self, n):
        self.docs = self.docs[:n]
        return self

    def _project(self, doc):
        projection = self.projection
        excluded = {key for key, value in projection.items() if key != "_id" and value == 0}
        included = {key for key, value in projection.items() if key != "_id" and value}
        data = {key: value for key, value in doc.items() if key != "_id"}
        if excluded:
            return {key: value for key, value in data.items() if key not in excluded}
        if included:
            return {key: value for key, value in data.items() if key in included}
        return data

    async def to_list(self, n):
        take = self.docs if n is None else self.docs[:n]
        return [self._project(doc) for doc in take]


class _AggCursor:
    def __init__(self, rows):
        self.rows = rows

    async def to_list(self, n):
        return self.rows[:n]


class _HangingFxClient:
    constructed = 0

    def __init__(self, *args, **kwargs):
        type(self).constructed += 1

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def get(self, *args, **kwargs):
        await asyncio.Event().wait()


@pytest.fixture(autouse=True)
def _reset_fx_memory():
    server._fx_memory["nok_per_usd"] = None
    server._fx_memory["as_of"] = None
    server.app.state.fx_kick_task = None
    _HangingFxClient.constructed = 0
    yield
    task = getattr(server.app.state, "fx_kick_task", None)
    if task and not task.done():
        task.cancel()
    server._fx_memory["nok_per_usd"] = None
    server._fx_memory["as_of"] = None


def test_lifespan_starts_index_and_fx_tasks_without_waiting(monkeypatch):
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
    indexes_started = asyncio.Event()
    fx_started = asyncio.Event()

    async def slow_indexes():
        indexes_started.set()
        await asyncio.sleep(60)

    async def slow_fx():
        fx_started.set()
        await asyncio.sleep(60)

    async def run():
        with (
            patch("server.ensure_indexes", slow_indexes),
            patch("server.fx_refresh_loop", slow_fx),
            patch("server.shutdown_db_client", new_callable=AsyncMock),
        ):
            try:
                async with server.app_lifespan(server.app):
                    await asyncio.wait_for(indexes_started.wait(), timeout=1)
                    await asyncio.wait_for(fx_started.wait(), timeout=1)
                    assert not server.app.state.index_task.done()
                    assert not server.app.state.fx_task.done()
            finally:
                for name in ("index_task", "fx_task"):
                    task = getattr(server.app.state, name, None)
                    if task and not task.done():
                        task.cancel()

    asyncio.run(run())


def test_dashboard_returns_summary_recent_and_pending_in_one_auth():
    bets = [
        {
            "bet_id": "inside",
            "date": "2026-09-01",
            "time": "12:00",
            "status": "won",
            "stake": 100,
            "result": 80,
            "odds": 1.8,
            "sport": "Football",
            "bookie": "Coolbet",
            "tipster": "Ada",
            "league": "Eliteserien",
            "ticket_type": "single",
            "legs": [{"game": "A"}],
        },
        {
            "bet_id": "outside",
            "date": "2026-01-01",
            "time": "12:00",
            "status": "lost",
            "stake": 50,
            "result": -50,
            "odds": 2.0,
            "sport": "Football",
            "bookie": "Coolbet",
            "tipster": "Ada",
            "league": "Eliteserien",
            "ticket_type": "single",
            "legs": [{"game": "B"}],
        },
        {
            "bet_id": "open",
            "date": "2026-01-02",
            "time": "09:00",
            "status": "pending",
            "stake": 30,
            "result": 0,
            "odds": 2.1,
            "sport": "Football",
            "bookie": "Coolbet",
            "tipster": "Ada",
            "league": "Eliteserien",
            "ticket_type": "single",
            "legs": [{"game": "P"}],
        },
    ]
    mock_db = MagicMock()

    def find(*args, **kwargs):
        projection = args[1] if len(args) > 1 else kwargs.get("projection")
        return _FakeCursor(bets, projection)

    mock_db.bets.find.side_effect = find
    auth = AsyncMock(return_value="user_1")
    client = TestClient(app)
    with patch("server.get_current_user", auth), patch("server.db", mock_db):
        response = client.get("/api/dashboard?date_from=2026-08-11&date_to=2026-09-10")

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"summary", "recent", "pending"}
    assert body["summary"]["stats"]["total_bets"] == 1
    assert body["summary"]["stats"]["total_profit_loss"] == 80
    assert [bet["bet_id"] for bet in body["pending"]] == ["open"]
    assert body["pending"][0]["legs"] == [{"game": "P"}]
    assert {bet["bet_id"] for bet in body["recent"]} == {"inside", "outside", "open"}
    assert all("legs" in bet for bet in body["recent"])
    assert auth.await_count == 1


def test_bankroll_aggregation_matches_python_cash_position():
    bets = [
        {"status": "lost", "result": -1000, "stake": 1000},
        {"status": "won", "result": 400, "stake": 200},
        {"status": "pending", "result": 0, "stake": 300},
        {"status": "void", "result": 999, "stake": 999},
        {"status": "cashed", "result": 25, "stake": 40},
        {"status": "push", "result": 0, "stake": 10},
    ]
    entries = [{"type": "set", "amount": 74337, "at": "2026-01-01T00:00:00"}]
    mock_db = MagicMock()
    mock_db.users.find_one = AsyncMock(
        return_value={"unit_size": 500, "cash_entries": entries, "starting_bankroll": 74337}
    )
    seen = {}

    def aggregate(pipeline):
        seen["pipeline"] = pipeline
        return _AggCursor([sum_bet_cash(bets)])

    mock_db.bets.aggregate.side_effect = aggregate
    client = TestClient(app)
    with (
        patch("server.get_current_user", new_callable=AsyncMock, return_value="user_1"),
        patch("server.db", mock_db),
    ):
        response = client.get("/api/bankroll")

    expected = compute_cash_position(entries, 500, bets)
    assert response.status_code == 200
    body = response.json()
    assert body["current"] == expected["current"] == 73462
    assert body["bet_result"] == expected["bet_result"] == -575
    assert body["pending_stake"] == expected["pending_stake"] == 300
    assert seen["pipeline"] == bet_cash_pipeline("user_1")
    mock_db.bets.find.assert_not_called()


def test_fx_returns_stored_rate_without_network():
    mock_db = MagicMock()
    mock_db.fx_rates.find_one = AsyncMock(return_value={"nok_per_usd": 10.5, "as_of": "2026-10-01"})
    client = TestClient(app)
    with (
        patch("server.get_current_user", new_callable=AsyncMock, return_value="user_1"),
        patch("server.db", mock_db),
        patch("server.httpx.AsyncClient", side_effect=AssertionError("fx network")),
    ):
        response = client.get("/api/fx/usd")

    assert response.status_code == 200
    assert response.json() == {"nok_per_usd": 10.5, "as_of": "2026-10-01"}
    assert server.app.state.fx_kick_task is None


def test_fx_missing_cache_does_not_block_on_httpx():
    mock_db = MagicMock()
    mock_db.fx_rates.find_one = AsyncMock(return_value=None)
    client = TestClient(app)
    started = time.monotonic()
    with (
        patch("server.get_current_user", new_callable=AsyncMock, return_value="user_1"),
        patch("server.db", mock_db),
        patch("server.httpx.AsyncClient", _HangingFxClient),
    ):
        response = client.get("/api/fx/usd")
    elapsed = time.monotonic() - started

    assert elapsed < 1
    assert response.status_code == 200
    assert response.json() == {"nok_per_usd": None, "as_of": None}
    assert server.app.state.fx_kick_task is not None
    assert _HangingFxClient.constructed >= 1
