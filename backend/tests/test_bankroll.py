import os

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "test_analytics")

from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from bankroll import compute_bankroll, movement_from_set
from server import app


class _FakeCursor:
    def __init__(self, docs):
        self.docs = list(docs)

    def sort(self, *args, **kwargs):
        return self

    async def to_list(self, n):
        return list(self.docs)


def test_empty_bankroll_is_zero():
    summary = compute_bankroll([])
    assert summary["balance"] == 0
    assert summary["deposited"] == 0
    assert summary["withdrawn"] == 0
    assert summary["movements"] == []


def test_deposits_minus_withdrawals():
    summary = compute_bankroll(
        [
            {"type": "deposit", "amount": 10000, "date": "2026-01-01"},
            {"type": "withdrawal", "amount": 2500, "date": "2026-02-01"},
            {"type": "deposit", "amount": 500, "date": "2026-03-01"},
        ]
    )
    assert summary["deposited"] == 10500
    assert summary["withdrawn"] == 2500
    assert summary["balance"] == 8000
    assert [row["date"] for row in summary["movements"]] == ["2026-03-01", "2026-02-01", "2026-01-01"]


def test_set_balance_becomes_deposit_or_withdrawal():
    assert movement_from_set(0, 5000) == {"type": "deposit", "amount": 5000}
    assert movement_from_set(5000, 2000) == {"type": "withdrawal", "amount": 3000}
    assert movement_from_set(1000, 1000) is None


def _auth_and_movements(docs):
    store = list(docs)
    mock_db = MagicMock()

    async def insert_one(doc):
        store.append(doc)

    async def delete_one(query):
        movement_id = query.get("movement_id")
        before = len(store)
        store[:] = [row for row in store if row.get("movement_id") != movement_id]
        result = MagicMock()
        result.deleted_count = before - len(store)
        return result

    mock_db.bankroll_movements.find.side_effect = lambda *args, **kwargs: _FakeCursor(store)
    mock_db.bankroll_movements.insert_one = insert_one
    mock_db.bankroll_movements.delete_one = delete_one
    return (
        patch("server.get_current_user", new_callable=AsyncMock, return_value="user_1"),
        patch("server.db", mock_db),
        store,
    )


def test_bankroll_get_is_empty_for_new_user():
    auth, db_patch, _store = _auth_and_movements([])
    client = TestClient(app)
    with auth, db_patch:
        response = client.get("/api/bankroll")
    assert response.status_code == 200
    assert response.json()["balance"] == 0
    assert response.json()["movements"] == []


def test_bankroll_deposit_updates_balance():
    auth, db_patch, _store = _auth_and_movements([])
    client = TestClient(app)
    with auth, db_patch:
        created = client.post(
            "/api/bankroll/movements",
            json={"type": "deposit", "amount": 10000, "date": "2026-10-01", "note": "Start"},
        )
        summary = client.get("/api/bankroll")
    assert created.status_code == 200
    assert created.json()["balance"] == 10000
    assert summary.json()["deposited"] == 10000
    assert summary.json()["movements"][0]["note"] == "Start"


def test_bankroll_set_records_delta():
    auth, db_patch, _store = _auth_and_movements(
        [{"type": "deposit", "amount": 1000, "date": "2026-09-01", "movement_id": "old"}]
    )
    client = TestClient(app)
    with auth, db_patch:
        response = client.post("/api/bankroll/movements", json={"type": "set", "amount": 4000})
    assert response.status_code == 200
    assert response.json()["balance"] == 4000
    assert response.json()["deposited"] == 4000
    assert response.json()["withdrawn"] == 0


def test_bankroll_rejects_invalid_amount():
    auth, db_patch, _store = _auth_and_movements([])
    client = TestClient(app)
    with auth, db_patch:
        response = client.post("/api/bankroll/movements", json={"type": "deposit", "amount": 0})
    assert response.status_code == 400


def test_bankroll_withdrawal_lowers_balance():
    auth, db_patch, _store = _auth_and_movements(
        [{"type": "deposit", "amount": 5000, "date": "2026-09-01", "movement_id": "old"}]
    )
    client = TestClient(app)
    with auth, db_patch:
        response = client.post(
            "/api/bankroll/movements",
            json={"type": "withdrawal", "amount": 1200, "date": "2026-10-01", "note": "Uttak"},
        )
    assert response.status_code == 200
    assert response.json()["balance"] == 3800
    assert response.json()["withdrawn"] == 1200
    assert response.json()["movements"][0]["type"] == "withdrawal"


def test_bankroll_delete_recomputes_balance():
    auth, db_patch, _store = _auth_and_movements(
        [
            {"type": "deposit", "amount": 2000, "date": "2026-09-01", "movement_id": "keep"},
            {"type": "withdrawal", "amount": 500, "date": "2026-09-02", "movement_id": "gone"},
        ]
    )
    client = TestClient(app)
    with auth, db_patch:
        missing = client.delete("/api/bankroll/movements/missing")
        deleted = client.delete("/api/bankroll/movements/gone")
    assert missing.status_code == 404
    assert deleted.status_code == 200
    assert deleted.json()["balance"] == 2000
    assert deleted.json()["withdrawn"] == 0
