import os

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "test_auth_google")

from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient
from pymongo.errors import DuplicateKeyError, ServerSelectionTimeoutError

from firebase_auth import InvalidFirebaseToken
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


def _identity(**overrides):
    identity = {
        "uid": "google-1",
        "email": "ola@example.com",
        "name": "Ola",
        "picture": "https://lh3.googleusercontent.com/a/photo",
    }
    identity.update(overrides)
    return identity


def _google(users, sessions=None, identity=None, token_error=None, **json):
    sessions = sessions or MagicMock()
    sessions.insert_one = AsyncMock()
    client = TestClient(app)
    if token_error:
        verifier = MagicMock(side_effect=token_error)
    else:
        verifier = MagicMock(return_value=identity or _identity())
    with (
        patch("server.db", _db(users=users, sessions=sessions)),
        patch("server.verify_id_token", verifier),
    ):
        return client.post("/api/auth/google", json=json or {"id_token": "a.b.c"}), sessions, users


def test_google_login_creates_user_and_session_without_scanning_bets():
    users = MagicMock()
    users.find_one = AsyncMock(return_value=None)
    users.insert_one = AsyncMock()
    sessions = MagicMock()
    sessions.insert_one = AsyncMock()
    bets = MagicMock()
    bets.find = MagicMock(side_effect=AssertionError("auth must not read bets"))
    bets.find_one = AsyncMock(side_effect=AssertionError("auth must not read bets"))

    client = TestClient(app)
    with (
        patch("server.db", _db(users=users, sessions=sessions, bets=bets)),
        patch("server.verify_id_token", return_value=_identity()),
    ):
        response = client.post("/api/auth/google", json={"id_token": "a.b.c"})

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "ola@example.com"
    assert body["name"] == "Ola"
    assert body["firebase_uid"] == "google-1"
    assert body["session_token"].startswith("session_")
    assert "password" not in body
    assert "password_hash" not in body
    assert "session_token=" in response.headers["set-cookie"]
    stored = users.insert_one.await_args.args[0]
    assert stored["currency"] == "NOK"
    assert stored["picture"] == "https://lh3.googleusercontent.com/a/photo"
    assert "password_hash" not in stored
    sessions.insert_one.assert_awaited_once()
    bets.find.assert_not_called()
    bets.find_one.assert_not_called()


def test_google_login_links_existing_email_and_keeps_the_account():
    existing = {
        "user_id": "user_1",
        "email": "Ola@Example.com",
        "name": "Ola",
        "currency": "NOK",
        "password_hash": "old-hash",
    }
    users = MagicMock()
    users.find_one = AsyncMock(side_effect=[None, dict(existing)])
    users.insert_one = AsyncMock(side_effect=AssertionError("must link, not create"))
    users.update_one = AsyncMock()

    response, sessions, users = _google(users, identity=_identity(email=" Ola@Example.com "))

    assert response.status_code == 200
    body = response.json()
    assert body["user_id"] == "user_1"
    assert body["email"] == "ola@example.com"
    assert "password_hash" not in body
    query, update = users.update_one.await_args.args
    assert query == {"user_id": "user_1"}
    assert update["$set"]["firebase_uid"] == "google-1"
    assert update["$set"]["email"] == "ola@example.com"
    assert "password_hash" not in update["$set"]
    sessions.insert_one.assert_awaited_once()
    users.insert_one.assert_not_called()


def test_known_firebase_user_does_not_create_another_account():
    existing = {
        "user_id": "user_1",
        "email": "ola@example.com",
        "name": "Ola",
        "firebase_uid": "google-1",
        "picture": "https://lh3.googleusercontent.com/a/photo",
    }
    users = MagicMock()
    users.find_one = AsyncMock(return_value=dict(existing))
    users.insert_one = AsyncMock(side_effect=AssertionError("existing user"))
    users.update_one = AsyncMock(side_effect=AssertionError("unchanged profile"))

    response, sessions, users = _google(users)

    assert response.status_code == 200
    assert response.json()["user_id"] == "user_1"
    users.find_one.assert_awaited_once()
    users.insert_one.assert_not_called()
    sessions.insert_one.assert_awaited_once()


def test_email_owned_by_another_google_account_is_rejected():
    existing = {"user_id": "user_1", "email": "ola@example.com", "firebase_uid": "other"}
    users = MagicMock()
    users.find_one = AsyncMock(side_effect=[None, dict(existing)])
    users.insert_one = AsyncMock()
    users.update_one = AsyncMock()

    response, sessions, users = _google(users)

    assert response.status_code == 409
    assert "annen Google-konto" in response.json()["detail"]
    assert "set-cookie" not in response.headers
    users.insert_one.assert_not_called()
    users.update_one.assert_not_called()
    sessions.insert_one.assert_not_called()


def test_display_name_and_https_picture_can_come_from_the_client():
    users = MagicMock()
    users.find_one = AsyncMock(return_value=None)
    users.insert_one = AsyncMock()

    response, _, users = _google(
        users,
        identity=_identity(name="", picture=""),
        id_token="a.b.c",
        name="  Kari   Nordmann ",
        picture="http://example.test/a.png",
    )

    assert response.status_code == 200
    stored = users.insert_one.await_args.args[0]
    assert stored["name"] == "Kari Nordmann"
    assert stored["picture"] is None


def test_duplicate_insert_uses_the_user_that_won_the_race():
    winner = {"user_id": "user_1", "email": "ola@example.com", "firebase_uid": "google-1", "name": "Ola"}
    users = MagicMock()
    users.find_one = AsyncMock(side_effect=[None, None, dict(winner)])
    users.insert_one = AsyncMock(side_effect=DuplicateKeyError("dup"))

    response, sessions, _ = _google(users)

    assert response.status_code == 200
    assert response.json()["user_id"] == "user_1"
    sessions.insert_one.assert_awaited_once()


def test_missing_token_does_not_verify_or_touch_the_database():
    users = MagicMock()
    users.find_one = AsyncMock(side_effect=AssertionError("no lookup"))
    client = TestClient(app)
    verifier = MagicMock(side_effect=AssertionError("no verify"))
    with patch("server.db", _db(users=users)), patch("server.verify_id_token", verifier):
        response = client.post("/api/auth/google", json={})

    assert response.status_code == 400
    verifier.assert_not_called()
    users.find_one.assert_not_called()


def test_invalid_token_is_rejected_without_a_session():
    users = MagicMock()
    users.find_one = AsyncMock(side_effect=AssertionError("no lookup"))
    response, sessions, _ = _google(users, token_error=InvalidFirebaseToken("Ugyldig token"))

    assert response.status_code == 401
    assert response.json()["detail"] == "Ugyldig token"
    assert "set-cookie" not in response.headers
    sessions.insert_one.assert_not_called()


def test_google_login_without_firebase_project_returns_503(monkeypatch):
    monkeypatch.delenv("FIREBASE_PROJECT_ID", raising=False)
    users = MagicMock()
    users.find_one = AsyncMock(side_effect=AssertionError("no lookup"))
    client = TestClient(app)
    with patch("server.db", _db(users=users)):
        response = client.post("/api/auth/google", json={"id_token": "a.b.c"})

    assert response.status_code == 503
    assert "Firebase" in response.json()["detail"]
    users.find_one.assert_not_called()


def test_google_login_reports_unavailable_database():
    users = MagicMock()
    users.find_one = AsyncMock(side_effect=ServerSelectionTimeoutError("down"))
    response, sessions, _ = _google(users)

    assert response.status_code == 503
    sessions.insert_one.assert_not_called()


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
