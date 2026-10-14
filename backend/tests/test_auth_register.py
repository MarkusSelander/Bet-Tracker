import os

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "test_auth_register")

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from passwords import verify_password
from server import app


def _register(existing=None, **json):
    users = MagicMock()
    users.find_one = AsyncMock(return_value=existing)
    users.insert_one = AsyncMock()
    sessions = MagicMock()
    sessions.insert_one = AsyncMock()
    mock_db = MagicMock(users=users, user_sessions=sessions)
    client = TestClient(app)
    with patch("server.db", mock_db):
        response = client.post("/api/auth/register", json=json)
    return response, users, sessions


def test_register_creates_hashed_user_and_session():
    response, users, sessions = _register(
        email=" Ola@Example.com ", password="sterkt-passord", name="Ola"
    )

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "ola@example.com"
    assert body["name"] == "Ola"
    assert body["session_token"].startswith("session_")
    assert "password_hash" not in body
    assert "session_token=" in response.headers["set-cookie"]

    stored = users.insert_one.await_args.args[0]
    assert stored["email"] == "ola@example.com"
    assert stored["password_hash"] != "sterkt-passord"
    assert verify_password("sterkt-passord", stored["password_hash"])
    assert sessions.insert_one.await_args.args[0]["user_id"] == stored["user_id"]


def test_register_defaults_name_to_email_prefix():
    response, _, _ = _register(email="kari@example.com", password="sterkt-passord")

    assert response.status_code == 201
    assert response.json()["name"] == "Kari"


def test_register_duplicate_email_returns_409():
    response, users, sessions = _register(
        existing={"user_id": "user_1", "email": "ola@example.com"},
        email="OLA@example.com",
        password="sterkt-passord",
    )

    assert response.status_code == 409
    assert "allerede registrert" in response.json()["detail"]
    users.insert_one.assert_not_called()
    sessions.insert_one.assert_not_called()


@pytest.mark.parametrize(
    ("payload", "detail"),
    [
        ({"email": "ola@example.com"}, "Skriv inn passord"),
        ({"email": "ola@example.com", "password": "kort"}, "minst 8 tegn"),
        ({"email": "ola@example.com", "password": "        "}, "mellomrom"),
        ({"email": "ola@example.com", "password": "x" * 73}, "maks 72"),
        ({"email": "ikke-epost", "password": "sterkt-passord"}, "Ugyldig e-post"),
        ({"password": "sterkt-passord"}, "Skriv inn e-post"),
    ],
)
def test_register_rejects_invalid_input_without_touching_database(payload, detail):
    response, users, sessions = _register(**payload)

    assert response.status_code == 400
    assert detail in response.json()["detail"]
    users.find_one.assert_not_called()
    users.insert_one.assert_not_called()
    sessions.insert_one.assert_not_called()


def test_register_reports_unavailable_database():
    from pymongo.errors import ServerSelectionTimeoutError

    users = MagicMock()
    users.find_one = AsyncMock(side_effect=ServerSelectionTimeoutError("down"))
    client = TestClient(app)
    with patch("server.db", MagicMock(users=users)):
        response = client.post(
            "/api/auth/register", json={"email": "ola@example.com", "password": "sterkt-passord"}
        )

    assert response.status_code == 503
