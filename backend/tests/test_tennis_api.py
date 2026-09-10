from tennis_api import (
    encode_tennis_id,
    normalize_search_items,
    parse_tennis_fixtures,
    parse_tennis_id,
    tennis_sport,
)


def test_tennis_sport_is_listed_separately():
    sport = tennis_sport()
    assert sport["id"] == "tennis"
    assert sport["label"] == "Tennis"
    assert "rapidapi.com" in sport["host"]


def test_tennis_ids_round_trip():
    player_id = encode_tennis_id("player", "atp", 68074)
    assert player_id == "tn:tennis:player:atp_68074"
    assert parse_tennis_id(player_id) == {
        "sport": "tennis",
        "kind": "player",
        "tour": "atp",
        "provider_id": "68074",
    }
    assert parse_tennis_id("as:football:player:276") is None


def test_normalize_search_maps_players_and_tournaments():
    items = normalize_search_items(
        [
            {
                "category": "player_atp",
                "result": [
                    {"id": 68074, "name": "Carlos Alcaraz", "countryAcr": "ESP", "image": "https://p.png"},
                ],
            },
            {
                "category": "tournament_wta",
                "result": [{"id": 20340, "name": "Wimbledon", "seasonId": 20340}],
            },
        ]
    )
    assert items[0]["kind"] == "player"
    assert items[0]["player_id"] == "tn:tennis:player:atp_68074"
    assert items[0]["player_name"] == "Carlos Alcaraz"
    assert items[0]["league"] == "ATP"
    assert items[0]["source"] == "tennis-api"
    assert items[1]["kind"] == "team"
    assert items[1]["team_id"] == "tn:tennis:tournament:wta_20340"
    assert items[1]["team_name"] == "Wimbledon"
    assert items[1]["sport"] == "tennis"


def test_parse_tennis_fixtures_uses_player_names_as_home_away():
    fixtures = parse_tennis_fixtures(
        "atp",
        [
            {
                "id": 99,
                "date": "2026-09-12T14:00:00",
                "player1": {"id": 1, "name": "Jannik Sinner"},
                "player2": {"id": 2, "name": "Carlos Alcaraz"},
                "tournament": {"name": "US Open"},
            }
        ],
    )
    assert fixtures[0]["fixture_id"] == "tn:tennis:fixture:atp_99"
    assert fixtures[0]["home_team_name"] == "Jannik Sinner"
    assert fixtures[0]["away_team_name"] == "Carlos Alcaraz"
    assert fixtures[0]["league"] == "US Open"
    assert fixtures[0]["sport"] == "tennis"
    assert fixtures[0]["event_date"] == "2026-09-12"
    assert fixtures[0]["source"] == "tennis-api"
