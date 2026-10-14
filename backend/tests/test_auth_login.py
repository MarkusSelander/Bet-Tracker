import os

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "test_auth_login")

from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from passwords import hash_password, verify_password
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


HASH = hash_password("correct-horse")


def _users(found=None):
    users = MagicMock()
    users.find_one = AsyncMock(return_value=dict(found) if found else None)
    users.insert_one = AsyncMock(side_effect=AssertionError("login must not create users"))
    users.update_one = AsyncMock(side_effect=AssertionError("login must not write user"))
    return users


def _login(users, sessions=None, **json):
    sessions = sessions or MagicMock()
    sessions.insert_one = AsyncMock()
    client = TestClient(app)
    with patch("server.db", _db(users=users, sessions=sessions)):
        return client.post("/api/auth/login", json=json), sessions


def test_login_existing_user_does_not_scan_bets():
    user = {"user_id": "user_1", "email": "a@b.c", "name": "A", "currency": "NOK", "password_hash": HASH}
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
    assert "password_hash" not in body
    assert "session_token=" in response.headers["set-cookie"]
    users.find_one.assert_awaited_once_with({"email": {"$in": ["a@b.c"]}}, {"_id": 0})
    sessions.insert_one.assert_awaited_once()
    bets.find_one.assert_not_called()
    bets.find.assert_not_called()
    users.update_one.assert_not_called()


def test_login_wrong_password_is_rejected_without_session():
    user = {"user_id": "user_1", "email": "a@b.c", "password_hash": HASH}
    response, sessions = _login(_users(user), email="a@b.c", password="wrong-horse")

    assert response.status_code == 401
    assert response.json()["detail"] == "Feil e-post eller passord"
    assert "set-cookie" not in response.headers
    sessions.insert_one.assert_not_called()


def test_login_unknown_email_no_longer_creates_account():
    users = _users(None)
    response, sessions = _login(users, email="ny@example.com", password="correct-horse")

    assert response.status_code == 401
    assert response.json()["detail"] == "Feil e-post eller passord"
    users.insert_one.assert_not_called()
    sessions.insert_one.assert_not_called()


def test_login_matches_legacy_mixed_case_email():
    user = {"user_id": "user_1", "email": "Ola@Example.com", "password_hash": HASH}
    users = _users(user)
    response, _ = _login(users, email=" Ola@Example.com ", password="correct-horse")

    assert response.status_code == 200
    users.find_one.assert_awaited_once_with(
        {"email": {"$in": ["ola@example.com", "Ola@Example.com"]}}, {"_id": 0}
    )


def test_legacy_user_without_hash_sets_password_on_first_login():
    user = {"user_id": "user_1", "email": "a@b.c", "name": "A"}
    users = _users(user)
    users.update_one = AsyncMock(return_value=MagicMock(modified_count=1))

    response, sessions = _login(users, email="a@b.c", password="nytt-passord")

    assert response.status_code == 200
    assert response.json()["user_id"] == "user_1"
    assert "password_hash" not in response.json()
    query, update = users.update_one.await_args.args
    assert query == {"user_id": "user_1", "password_hash": {"$exists": False}}
    stored = update["$set"]["password_hash"]
    assert stored != "nytt-passord"
    assert verify_password("nytt-passord", stored)
    sessions.insert_one.assert_awaited_once()


def test_legacy_user_cannot_claim_with_weak_password():
    users = _users({"user_id": "user_1", "email": "a@b.c"})
    response, sessions = _login(users, email="a@b.c", password="kort")

    assert response.status_code == 400
    assert "minst 8 tegn" in response.json()["detail"]
    users.update_one.assert_not_called()
    sessions.insert_one.assert_not_called()


def test_legacy_claim_race_loser_must_match_winner_password():
    users = _users({"user_id": "user_1", "email": "a@b.c"})
    users.find_one = AsyncMock(side_effect=[
        {"user_id": "user_1", "email": "a@b.c"},
        {"password_hash": HASH},
    ])
    users.update_one = AsyncMock(return_value=MagicMock(modified_count=0))

    response, sessions = _login(users, email="a@b.c", password="annet-passord")

    assert response.status_code == 401
    sessions.insert_one.assert_not_called()


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
    users.find_one.assert_awaited_once_with({"user_id": "user_1"}, {"_id": 0, "password_hash": 0})
    bets.find_one.assert_not_called()
