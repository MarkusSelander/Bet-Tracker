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


def test_favorites_search_finds_team_outside_first_eight_soccer_keys():
    sports = [
        {"key": f"soccer_league_{index}", "group": "Soccer", "title": f"League {index}", "active": True}
        for index in range(8)
    ] + [
        {"key": "soccer_norway_eliteserien", "group": "Soccer", "title": "Eliteserien", "active": True},
        {"key": "soccer_epl", "group": "Soccer", "title": "Premier League", "active": True},
    ]

    async def fake_get_json(path, params=None, ttl_seconds=180):
        if path == "/sports":
            return sports
        if path == "/sports/soccer_norway_eliteserien/events":
            return [{"sport_key": "soccer_norway_eliteserien", "home_team": "Brann", "away_team": "Molde"}]
        if path == "/sports/soccer_epl/events":
            return [{"sport_key": "soccer_epl", "home_team": "Manchester City", "away_team": "Arsenal"}]
        return []

    client = TestClient(app)
    with patch("server.get_current_user", new_callable=AsyncMock, return_value="user-1"), \
         patch("server.odds_client") as odds_client:
        odds_client.get_json = AsyncMock(side_effect=fake_get_json)
        brann = client.get("/api/favorites/search?query=Brann")
        city = client.get("/api/favorites/search?query=Man City")

    assert brann.status_code == 200
    assert {"name": "Brann", "sport_key": "soccer_norway_eliteserien"} in brann.json()["teams"]
    assert city.status_code == 200
    assert {"name": "Manchester City", "sport_key": "soccer_epl"} in city.json()["teams"]
