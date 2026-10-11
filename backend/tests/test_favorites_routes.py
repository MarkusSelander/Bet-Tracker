import os

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "test_favorites_routes")

from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

from server import app
from sofascore_favorites import SofaScoreError


def _teams_collection(rows):
    collection = MagicMock()
    collection.find = MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=rows)))
    collection.update_one = AsyncMock()
    collection.delete_one = AsyncMock()
    return collection


def test_favorites_today_requires_auth():
    client = TestClient(app)
    with patch("server.get_current_user", new_callable=AsyncMock) as mock_auth:
        mock_auth.side_effect = HTTPException(status_code=401, detail="Not authenticated")
        response = client.get("/api/favorites/today")
    assert response.status_code == 401


def test_favorites_today_empty_does_not_call_sofascore():
    client = TestClient(app)
    with patch("server.get_current_user", new_callable=AsyncMock, return_value="user-1"), \
         patch("server.db") as db, \
         patch("server.sofascore_gateway") as gateway:
        db.favorite_teams = _teams_collection([])
        gateway.get = AsyncMock(side_effect=AssertionError("SofaScore skal ikke kalles"))
        response = client.get("/api/favorites/today")
    assert response.status_code == 200
    assert response.json() == []
    gateway.get.assert_not_called()


def test_favorites_search_uses_gateway_and_filters():
    client = TestClient(app)

    async def fake_get(path):
        assert "Brann" in path
        return {
            "results": [
                {"type": "team", "entity": {"id": 200, "name": "Brann", "sport": {"slug": "football"}}},
                {"type": "player", "entity": {"id": 9, "name": "Keeper", "sport": {"slug": "football"}}},
            ]
        }

    with patch("server.get_current_user", new_callable=AsyncMock, return_value="user-1"), \
         patch("server.sofascore_gateway") as gateway:
        gateway.get = AsyncMock(side_effect=fake_get)
        response = client.get("/api/favorites/search?query=Brann")
    assert response.status_code == 200
    assert response.json() == {
        "teams": [
            {"sofascore_id": 200, "kind": "team", "name": "Brann", "sport": "football", "team_id": 200}
        ]
    }


def test_favorites_today_returns_gateway_matches_and_502_on_failure():
    client = TestClient(app)
    stored = [{
        "user_id": "user-1",
        "sofascore_id": 200,
        "kind": "team",
        "name": "Brann",
        "sport": "football",
        "team_id": 200,
    }]

    async def fake_get(path):
        if path.endswith("/events/next/0"):
            return {"events": []}
        if path.endswith("/events/live"):
            raise SofaScoreError("SofaScore utilgjengelig")
        raise AssertionError(path)

    with patch("server.get_current_user", new_callable=AsyncMock, return_value="user-1"), \
         patch("server.db") as db, \
         patch("server.sofascore_gateway") as gateway:
        db.favorite_teams = _teams_collection(stored)
        gateway.get = AsyncMock(side_effect=fake_get)
        response = client.get("/api/favorites/today")
    assert response.status_code == 502
    assert response.json()["detail"] == "SofaScore utilgjengelig"


def test_follow_team_stores_sofascore_identity():
    client = TestClient(app)
    collection = _teams_collection([])
    with patch("server.get_current_user", new_callable=AsyncMock, return_value="user-1"), \
         patch("server.db") as db:
        db.favorite_teams = collection
        response = client.post("/api/favorites/teams", json={
            "sofascore_id": 200,
            "kind": "team",
            "name": "Brann",
            "sport": "football",
        })
    assert response.status_code == 200
    assert response.json()["team_id"] == 200
    stored = collection.update_one.await_args.args[1]["$set"]
    assert stored["user_id"] == "user-1"
    assert stored["sofascore_id"] == 200
    assert stored["sport"] == "football"
