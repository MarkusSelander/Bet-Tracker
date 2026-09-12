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


def _favorites_db(teams, leagues=None, events=None):
    fake_leagues = MagicMock()
    fake_leagues.find = MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=leagues or [])))
    fake_teams = MagicMock()
    fake_teams.find = MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=teams)))
    fake_events = MagicMock()
    fake_events.find = MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=events or [])))
    db = MagicMock()
    db.favorite_leagues = fake_leagues
    db.favorite_teams = fake_teams
    db.favorite_events = fake_events
    return db


def test_odds_matches_favorites_partial_failure_still_returns_matches():
    from odds_client import OddsApiError

    sports = [
        {"key": "soccer_epl", "group": "Soccer", "title": "Premier League", "active": True},
        {"key": "soccer_norway_eliteserien", "group": "Soccer", "title": "Eliteserien", "active": True},
        {"key": "tennis_atp", "group": "Tennis", "title": "ATP", "active": True},
    ]
    called = []

    async def fake_get_json(path, params=None, ttl_seconds=180):
        called.append(path)
        if path == "/sports":
            return sports
        if path == "/sports/soccer_epl/odds":
            return [{
                "id": "city",
                "sport_key": "soccer_epl",
                "sport_title": "Premier League",
                "home_team": "Manchester City",
                "away_team": "Arsenal",
                "commence_time": "2026-09-11T16:00:00Z",
                "bookmakers": [],
            }]
        if "soccer_norway_eliteserien" in path:
            raise OddsApiError(502, "Odds API utilgjengelig (500)")
        if "tennis" in path:
            raise AssertionError("favorites tab must not fetch tennis")
        return []

    client = TestClient(app)
    with patch("server.get_current_user", new_callable=AsyncMock, return_value="user-1"), \
         patch("server.odds_client") as odds_client, \
         patch("server.db", _favorites_db([
             {"name": "Brann", "sport_key": "soccer_norway_eliteserien"},
             {"name": "Manchester City", "sport_key": "soccer_epl"},
         ])):
        odds_client.get_json = AsyncMock(side_effect=fake_get_json)
        response = client.get("/api/odds/matches?date=2026-09-11&tab=favorites&filter=scheduled")

    assert response.status_code == 200
    ids = [row["id"] for row in response.json()]
    assert ids == ["city"]
    assert not any("tennis" in path for path in called)
    assert any(path.endswith("/soccer_epl/odds") or path.endswith("/soccer_epl/scores") for path in called)


def test_odds_matches_favorites_does_not_fetch_unrelated_sports():
    sports = [
        {"key": "soccer_epl", "group": "Soccer", "title": "Premier League", "active": True},
        {"key": "soccer_norway_eliteserien", "group": "Soccer", "title": "Eliteserien", "active": True},
        {"key": "tennis_atp", "group": "Tennis", "title": "ATP", "active": True},
        {"key": "soccer_france_ligue_one", "group": "Soccer", "title": "Ligue 1", "active": True},
    ]
    called = []

    async def fake_get_json(path, params=None, ttl_seconds=180):
        called.append(path)
        if path == "/sports":
            return sports
        return []

    client = TestClient(app)
    with patch("server.get_current_user", new_callable=AsyncMock, return_value="user-1"), \
         patch("server.odds_client") as odds_client, \
         patch("server.db", _favorites_db(
             teams=[{"name": "Brann", "sport_key": "soccer_norway_eliteserien"}],
             leagues=[{"sport_key": "soccer_epl"}],
         )):
        odds_client.get_json = AsyncMock(side_effect=fake_get_json)
        response = client.get("/api/odds/matches?date=2026-09-11&tab=favorites&filter=all")

    assert response.status_code == 200
    sport_paths = [path for path in called if path != "/sports"]
    assert sport_paths
    assert all(
        "/soccer_epl/" in path or "/soccer_norway_eliteserien/" in path
        for path in sport_paths
    )
    assert not any("tennis" in path or "ligue_one" in path for path in called)


def test_odds_matches_all_keys_failing_with_quota_returns_429():
    from odds_client import OddsApiError

    async def fake_get_json(path, params=None, ttl_seconds=180):
        if path == "/sports":
            return [{"key": "soccer_epl", "group": "Soccer", "title": "EPL", "active": True}]
        raise OddsApiError(429, "Odds API-kvote brukt opp (429)")

    client = TestClient(app)
    with patch("server.get_current_user", new_callable=AsyncMock, return_value="user-1"), \
         patch("server.odds_client") as odds_client, \
         patch("server.db", _favorites_db([{"name": "Manchester City", "sport_key": "soccer_epl"}])):
        odds_client.get_json = AsyncMock(side_effect=fake_get_json)
        response = client.get("/api/odds/matches?date=2026-09-11&tab=favorites&filter=all")

    assert response.status_code == 429
    assert "429" in response.json()["detail"]
