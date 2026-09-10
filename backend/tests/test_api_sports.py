from api_sports import (
    current_team_from_history,
    encode_entity_id,
    football_season,
    list_sports,
    normalize_player,
    normalize_team,
    parse_entity_id,
    parse_fixtures,
    players_search_path,
    upcoming_path,
)


def test_list_sports_is_extensible_and_includes_football():
    sports = {item["id"]: item for item in list_sports()}
    assert "football" in sports
    assert sports["football"]["label"]
    assert sports["football"]["host"].startswith("https://")


def test_entity_ids_round_trip():
    team_id = encode_entity_id("football", "team", 33)
    player_id = encode_entity_id("football", "player", 276)
    assert team_id == "as:football:team:33"
    assert parse_entity_id(team_id) == {"sport": "football", "kind": "team", "provider_id": "33"}
    assert parse_entity_id(player_id)["kind"] == "player"
    assert parse_entity_id("12345") is None


def test_normalize_team_from_football_v3():
    teams = normalize_team(
        "football",
        {"team": {"id": 33, "name": "Manchester United", "logo": "https://logo/utd.png", "country": "England"}},
    )
    assert teams["team_id"] == "as:football:team:33"
    assert teams["team_name"] == "Manchester United"
    assert teams["team_badge"] == "https://logo/utd.png"
    assert teams["sport"] == "football"
    assert teams["kind"] == "team"


def test_normalize_team_from_game_v1():
    teams = normalize_team("basketball", {"id": 145, "name": "Los Angeles Lakers", "logo": "https://logo/lal.png"})
    assert teams["team_id"] == "as:basketball:team:145"
    assert teams["team_name"] == "Los Angeles Lakers"


def test_normalize_player_uses_current_team():
    player = normalize_player(
        "football",
        {
            "player": {"id": 276, "name": "E. Haaland", "photo": "https://p/276.png"},
            "statistics": [
                {"team": {"id": 50, "name": "Manchester City", "logo": "https://logo/city.png"}, "league": {"name": "Premier League"}},
            ],
        },
    )
    assert player["player_id"] == "as:football:player:276"
    assert player["player_name"] == "E. Haaland"
    assert player["team_id"] == "as:football:team:50"
    assert player["team_name"] == "Manchester City"
    assert player["kind"] == "player"


def test_parse_football_fixtures():
    fixtures = parse_fixtures(
        "football",
        [
            {
                "fixture": {"id": 868078, "date": "2026-09-12T16:00:00+02:00", "status": {"short": "NS"}},
                "league": {"name": "Eliteserien", "country": "Norway"},
                "teams": {
                    "home": {"id": 327, "name": "Brann", "logo": "https://h.png"},
                    "away": {"id": 328, "name": "Viking", "logo": "https://a.png"},
                },
            }
        ],
    )
    assert fixtures[0]["fixture_id"] == "as:football:fixture:868078"
    assert fixtures[0]["event_date"] == "2026-09-12"
    assert fixtures[0]["event_time"] == "16:00:00"
    assert fixtures[0]["home_team_name"] == "Brann"
    assert fixtures[0]["away_team_name"] == "Viking"
    assert fixtures[0]["source"] == "api-sports"


def test_parse_basketball_games():
    fixtures = parse_fixtures(
        "basketball",
        [
            {
                "id": 99,
                "date": {"start": "2026-10-20T02:00:00+00:00"},
                "league": {"name": "NBA"},
                "teams": {
                    "home": {"id": 1, "name": "Boston Celtics", "logo": "https://bos.png"},
                    "visitors": {"id": 2, "name": "Lakers", "logo": "https://lal.png"},
                },
            }
        ],
    )
    assert fixtures[0]["fixture_id"] == "as:basketball:fixture:99"
    assert fixtures[0]["away_team_name"] == "Lakers"


def test_upcoming_path_uses_next_for_football():
    assert upcoming_path("football") == "/fixtures"
    assert upcoming_path("basketball") == "/games"


def test_football_player_search_uses_profiles():
    assert players_search_path("football") == "/players/profiles"
    assert players_search_path("basketball") == "/players"


def test_current_team_from_history_picks_latest_season():
    team = current_team_from_history(
        "football",
        [
            {"team": {"id": 165, "name": "Molde", "logo": "https://molde.png"}, "seasons": [2015, 2016]},
            {"team": {"id": 50, "name": "Manchester City", "logo": "https://city.png"}, "seasons": [2022, 2023, 2024]},
        ],
    )
    assert team["team_id"] == "as:football:team:50"
    assert team["team_name"] == "Manchester City"
    assert team["team_badge"] == "https://city.png"


def test_football_season_uses_starting_year():
    assert football_season(month=8, year=2026) == 2026
    assert football_season(month=3, year=2026) == 2025
