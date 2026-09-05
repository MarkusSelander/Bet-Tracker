from favorites_live import match_markets, search_teams, upcoming_matches_grouped


def test_team_search_has_no_live_source():
    assert search_teams("Brann") == []
    assert search_teams("Brann", sport="Soccer") == []


def test_upcoming_matches_have_no_live_source():
    assert upcoming_matches_grouped(["133604"], days=7) == {}
    assert upcoming_matches_grouped([], days=14) == {}


def test_match_markets_have_no_live_source():
    assert match_markets("123") == {"markets": [], "missing": True}
