from coolbet_odds import attach_odds, extract_1x2, flatten_search_payload, match_event


def test_flatten_reads_matches_or_events_lists():
    nested = flatten_search_payload({"matches": [{"id": "1", "name": "Brann - Viking"}]})
    assert nested[0]["id"] == "1"
    direct = flatten_search_payload([{"id": "2"}])
    assert direct[0]["id"] == "2"


def test_match_event_pairs_same_day_and_both_team_names():
    fixture = {
        "home_team_name": "SK Brann",
        "away_team_name": "Viking FK",
        "event_date": "2026-09-06",
    }
    events = [
        {"id": "wrong", "name": "Rosenborg - Molde", "start_date": "2026-09-06T16:00:00Z"},
        {"id": "hit", "name": "Brann - Viking", "startTime": "2026-09-06T16:00:00.000Z"},
    ]
    assert match_event(fixture, events)["id"] == "hit"


def test_match_event_returns_none_when_date_or_names_differ():
    fixture = {
        "home_team_name": "Brann",
        "away_team_name": "Viking",
        "event_date": "2026-09-06",
    }
    assert match_event(fixture, [{"id": "a", "name": "Brann - Viking", "start_date": "2026-09-07T16:00:00Z"}]) is None
    assert match_event(fixture, [{"id": "b", "name": "Brann - Molde", "start_date": "2026-09-06T16:00:00Z"}]) is None


def test_extract_1x2_from_named_market():
    odds = extract_1x2(
        {
            "markets": [
                {
                    "name": "Match Result (1X2)",
                    "outcomes": [
                        {"name": "1", "odds": 1.85},
                        {"name": "X", "odds": 3.4},
                        {"name": "2", "odds": 4.2},
                    ],
                }
            ]
        }
    )
    assert odds == {"home": 1.85, "draw": 3.4, "away": 4.2}


def test_attach_odds_sets_nulls_when_no_event():
    fixture = {
        "fixture_id": "e1",
        "home_team_name": "Brann",
        "away_team_name": "Viking",
        "event_date": "2026-09-06",
    }
    out = attach_odds(fixture, [])
    assert out["odds_1x2"] is None
    assert out["coolbet_event_id"] is None
    assert out["fixture_id"] == "e1"
