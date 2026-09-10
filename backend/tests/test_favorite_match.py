from favorite_match import attach_linked_bets, fixture_matches_bet, normalize_name


def test_normalize_name_strips_noise():
    assert normalize_name("SK Brann") == "sk brann"
    assert normalize_name("Brann – Viking (+2)") == "brann viking 2"


def test_fixture_matches_bet_requires_both_team_names():
    fixture = {"home_team_name": "Brann", "away_team_name": "Viking"}
    assert fixture_matches_bet(fixture, {"game": "Brann - Viking", "legs": []})
    assert fixture_matches_bet(
        fixture,
        {"game": "Kombi", "legs": [{"match": "Brann vs Viking"}]},
    )
    assert not fixture_matches_bet(fixture, {"game": "Brann - Molde", "legs": []})
    assert not fixture_matches_bet(fixture, {"game": "Viking", "legs": []})


def test_attach_linked_bets_adds_reliable_hits_only():
    fixtures = [
        {"fixture_id": "1", "home_team_name": "Brann", "away_team_name": "Viking"},
        {"fixture_id": "2", "home_team_name": "Arsenal", "away_team_name": "Chelsea"},
    ]
    bets = [
        {"bet_id": "bet_a", "status": "pending", "odds": 1.9, "game": "Brann - Viking", "legs": []},
        {"bet_id": "bet_b", "status": "won", "odds": 2.1, "game": "Arsenal", "legs": []},
    ]
    out = attach_linked_bets(fixtures, bets)
    assert out[0]["linked_bets"][0]["bet_id"] == "bet_a"
    assert out[0]["has_bet"] is True
    assert out[1]["linked_bets"] == []
    assert out[1]["has_bet"] is False
