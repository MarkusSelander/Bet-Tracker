import os

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "test_auth_login")

from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from server import app


def _db(*, users=None, sessions=None, bets=None):
    mock_db = MagicMock()
    mock_db.users = users or MagicMock()
    mock_db.user_sessions = sessions or MagicMock()
    mock_db.bets = bets or MagicMock()
    mock_db.bets.find = MagicMock(side_effect=AssertionError("auth must not read bets"))
    mock_db.bets.find_one = AsyncMock(side_effect=AssertionError("auth must not read bets"))
    if bets is not None:
        mock_db.bets = bets
    return mock_db


def test_login_existing_user_does_not_scan_bets():
    user = {"user_id": "user_1", "email": "a@b.c", "name": "A", "currency": "NOK"}
    users = MagicMock()
    users.find_one = AsyncMock(return_value=dict(user))
    users.insert_one = AsyncMock(side_effect=AssertionError("existing user"))
    users.update_one = AsyncMock(side_effect=AssertionError("auth must not write user"))
    sessions = MagicMock()
    sessions.insert_one = AsyncMock()
    bets = MagicMock()
    bets.find_one = AsyncMock(side_effect=AssertionError("auth must not read bets"))
    bets.find = MagicMock(side_effect=AssertionError("auth must not read bets"))

    client = TestClient(app)
    with patch("server.db", _db(users=users, sessions=sessions, bets=bets)):
        response = client.post(
            "/api/auth/login",
            json={"email": "a@b.c", "password": "correct-horse"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["user_id"] == "user_1"
    assert body["email"] == "a@b.c"
    assert body["session_token"].startswith("session_")
    assert "password" not in body
    users.find_one.assert_awaited_once_with({"email": "a@b.c"}, {"_id": 0})
    sessions.insert_one.assert_awaited_once()
    bets.find_one.assert_not_called()
    bets.find.assert_not_called()
    users.update_one.assert_not_called()


def test_login_new_user_does_not_scan_bets():
    users = MagicMock()
    users.find_one = AsyncMock(return_value=None)
    users.insert_one = AsyncMock()
    users.update_one = AsyncMock(side_effect=AssertionError("auth must not backfill"))
    sessions = MagicMock()
    sessions.insert_one = AsyncMock()
    bets = MagicMock()
    bets.find_one = AsyncMock(side_effect=AssertionError("auth must not read bets"))

    client = TestClient(app)
    with patch("server.db", _db(users=users, sessions=sessions, bets=bets)):
        response = client.post(
            "/api/auth/login",
            json={"email": "ny@example.com", "password": "correct-horse"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "ny@example.com"
    assert body["user_id"].startswith("user_")
    assert body["session_token"].startswith("session_")
    assert "last_coolbet_sync_at" not in body
    users.insert_one.assert_awaited_once()
    bets.find_one.assert_not_called()
    users.update_one.assert_not_called()


def test_login_missing_password_does_not_touch_database():
    users = MagicMock()
    users.find_one = AsyncMock(side_effect=AssertionError("no lookup"))
    client = TestClient(app)
    with patch("server.db", _db(users=users)):
        response = client.post("/api/auth/login", json={"email": "a@b.c"})

    assert response.status_code == 400
    users.find_one.assert_not_called()


def test_me_without_session_does_not_touch_database():
    users = MagicMock()
    users.find_one = AsyncMock(side_effect=AssertionError("no user lookup"))
    sessions = MagicMock()
    sessions.find_one = AsyncMock(side_effect=AssertionError("no session lookup"))
    bets = MagicMock()
    bets.find_one = AsyncMock(side_effect=AssertionError("auth must not read bets"))

    client = TestClient(app)
    with patch("server.db", _db(users=users, sessions=sessions, bets=bets)):
        response = client.get("/api/auth/me")

    assert response.status_code == 401
    users.find_one.assert_not_called()
    sessions.find_one.assert_not_called()
    bets.find_one.assert_not_called()


def test_me_returns_stored_user_without_scanning_bets():
    user = {
        "user_id": "user_1",
        "email": "a@b.c",
        "name": "A",
        "last_coolbet_sync_at": "2026-09-04T12:00:00+00:00",
    }
    users = MagicMock()
    users.find_one = AsyncMock(return_value=dict(user))
    bets = MagicMock()
    bets.find_one = AsyncMock(side_effect=AssertionError("auth must not read bets"))

    client = TestClient(app)
    with (
        patch("server.db", _db(users=users, bets=bets)),
        patch("server.get_current_user", new_callable=AsyncMock, return_value="user_1"),
    ):
        response = client.get("/api/auth/me", headers={"Authorization": "Bearer session_abc"})

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "a@b.c"
    assert body["last_coolbet_sync_at"] == "2026-09-04T12:00:00+00:00"
    assert "session_token" not in body
    users.find_one.assert_awaited_once_with({"user_id": "user_1"}, {"_id": 0})
    bets.find_one.assert_not_called()
