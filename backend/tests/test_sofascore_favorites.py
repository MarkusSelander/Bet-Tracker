from datetime import datetime

from sofascore_favorites import normalize_favorite, search_hits, today_matches


TODAY = datetime(2026, 10, 11, 12, 0).date()


def _ts(day, hour=18):
    return datetime(day.year, day.month, day.day, hour).timestamp()


def _event(event_id, home_id, away_id, day, sport="football", score=None, status="notstarted"):
    home_score = {} if score is None else {"current": score[0]}
    away_score = {} if score is None else {"current": score[1]}
    return {
        "id": event_id,
        "startTimestamp": _ts(day),
        "status": {"type": status, "description": status},
        "homeTeam": {"id": home_id, "name": "Hjemme", "sport": {"slug": sport}},
        "awayTeam": {"id": away_id, "name": "Borte", "sport": {"slug": sport}},
        "homeScore": home_score,
        "awayScore": away_score,
        "tournament": {
            "name": "Cup",
            "uniqueTournament": {"name": "Eliteserien" if sport == "football" else "ATP"},
            "category": {"sport": {"slug": sport}},
        },
    }


def test_search_hits_keep_football_teams_and_tennis_players_only():
    payload = {
        "results": [
            {"type": "team", "entity": {"id": 11, "name": "Brann", "sport": {"slug": "football"}}},
            {"type": "player", "entity": {"id": 22, "name": "Spiss", "sport": {"slug": "football"}, "team": {"id": 11, "sport": {"slug": "football"}}}},
            {"type": "team", "entity": {"id": 33, "name": "Lakers", "sport": {"slug": "basketball"}}},
            {
                "type": "player",
                "entity": {
                    "id": 44,
                    "name": "Sinner",
                    "team": {"id": 440, "sport": {"slug": "tennis"}},
                },
            },
            {"type": "uniqueTournament", "entity": {"id": 55, "name": "Premier League", "category": {"sport": {"slug": "football"}}}},
        ]
    }
    hits = search_hits(payload)
    assert hits == [
        {"sofascore_id": 11, "kind": "team", "name": "Brann", "sport": "football", "team_id": 11},
        {"sofascore_id": 44, "kind": "player", "name": "Sinner", "sport": "tennis", "team_id": 440},
    ]


def test_normalize_favorite_rejects_football_players():
    try:
        normalize_favorite({"sofascore_id": 1, "kind": "player", "name": "Spiss", "sport": "football"})
    except ValueError as err:
        assert "lag" in str(err)
    else:
        raise AssertionError("football player should be rejected")


def test_today_matches_merges_next_and_live_for_favorite_ids():
    favorites = [
        {"sofascore_id": 11, "kind": "team", "name": "Brann", "sport": "football", "team_id": 11},
        {"sofascore_id": 44, "kind": "player", "name": "Sinner", "sport": "tennis", "team_id": 440},
    ]
    next_payloads = [
        {"events": [
            _event(1, 11, 99, TODAY, score=(1, 0), status="inprogress"),
            _event(2, 11, 98, datetime(2026, 10, 12).date()),
            _event(3, 50, 51, TODAY),
        ]},
        {"events": [_event(4, 440, 441, TODAY, sport="tennis")]},
    ]
    live_payloads = [
        {"events": [_event(1, 11, 99, TODAY, score=(2, 0), status="inprogress")]},
        {"events": []},
    ]
    matches = today_matches(favorites, next_payloads, live_payloads, TODAY)
    assert [row["id"] for row in matches] == [1, 4]
    brann = matches[0]
    assert brann["home_score"] == 2
    assert brann["away_score"] == 0
    assert brann["sport"] == "football"
    assert brann["tournament"] == "Eliteserien"
    assert matches[1]["sport"] == "tennis"
    assert matches[1]["home_score"] is None


def test_today_matches_includes_doubles_partner_id():
    favorites = [{"sofascore_id": 77, "kind": "player", "name": "Spiller", "sport": "tennis"}]
    event = _event(9, 10, 11, TODAY, sport="tennis")
    event["homeTeam"]["subTeams"] = [{"id": 77, "name": "Spiller"}]
    matches = today_matches(favorites, [{"events": [event]}], [], TODAY)
    assert [row["id"] for row in matches] == [9]
