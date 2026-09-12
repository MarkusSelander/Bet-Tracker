from odds_logic import (
    best_h2h,
    favorite_matches,
    favorite_sport_keys,
    filter_matches,
    map_event_markets,
    merge_sport_fetch_results,
    search_event_sport_keys,
    search_leagues_and_teams,
    sport_tab_keys,
)


def test_best_h2h_picks_highest_price_per_outcome_and_bookmaker():
    event = {
        "home_team": "Brann",
        "away_team": "Molde",
        "bookmakers": [
            {
                "title": "Unibet",
                "markets": [{
                    "key": "h2h",
                    "outcomes": [
                        {"name": "Brann", "price": 1.70},
                        {"name": "Draw", "price": 3.80},
                        {"name": "Molde", "price": 4.50},
                    ],
                }],
            },
            {
                "title": "Bet365",
                "markets": [{
                    "key": "h2h",
                    "outcomes": [
                        {"name": "Brann", "price": 1.72},
                        {"name": "Draw", "price": 3.75},
                        {"name": "Molde", "price": 4.40},
                    ],
                }],
            },
            {
                "title": "Coolbet",
                "markets": [{
                    "key": "h2h",
                    "outcomes": [
                        {"name": "Brann", "price": 1.68},
                        {"name": "Draw", "price": 3.90},
                        {"name": "Molde", "price": 4.60},
                    ],
                }],
            },
        ],
    }

    best = best_h2h(event)
    assert best["home"] == 1.72
    assert best["home_bookmaker"] == "Bet365"
    assert best["draw"] == 3.90
    assert best["draw_bookmaker"] == "Coolbet"
    assert best["away"] == 4.60
    assert best["away_bookmaker"] == "Coolbet"


def test_best_h2h_returns_none_without_h2h_market():
    assert best_h2h({"home_team": "A", "away_team": "B", "bookmakers": []}) is None


def test_best_h2h_returns_none_when_outcome_names_do_not_match_teams():
    event = {
        "home_team": "Brann",
        "away_team": "Molde",
        "bookmakers": [{
            "title": "Unibet",
            "markets": [{
                "key": "h2h",
                "outcomes": [
                    {"name": "Team A", "price": 1.70},
                    {"name": "Team B", "price": 3.80},
                    {"name": "Team C", "price": 4.50},
                ],
            }],
        }],
    }
    assert best_h2h(event) is None


def test_best_h2h_allows_missing_draw_for_two_way_markets():
    event = {
        "home_team": "Djokovic",
        "away_team": "Sinner",
        "bookmakers": [{
            "title": "Unibet",
            "markets": [{
                "key": "h2h",
                "outcomes": [
                    {"name": "Djokovic", "price": 2.10},
                    {"name": "Sinner", "price": 1.75},
                ],
            }],
        }],
    }
    best = best_h2h(event)
    assert best["home"] == 2.10
    assert best["away"] == 1.75
    assert best["draw"] is None
    assert best["draw_bookmaker"] is None


def test_map_event_markets_keeps_h2h_totals_near_25_and_btts():
    payload = {
        "home_team": "Brann",
        "away_team": "Molde",
        "bookmakers": [
            {
                "title": "Unibet",
                "markets": [
                    {
                        "key": "h2h",
                        "outcomes": [
                            {"name": "Brann", "price": 1.70},
                            {"name": "Draw", "price": 3.80},
                            {"name": "Molde", "price": 4.50},
                        ],
                    },
                    {
                        "key": "totals",
                        "outcomes": [
                            {"name": "Over", "price": 1.85, "point": 2.5},
                            {"name": "Under", "price": 1.95, "point": 2.5},
                            {"name": "Over", "price": 1.50, "point": 1.5},
                            {"name": "Under", "price": 2.40, "point": 1.5},
                        ],
                    },
                    {
                        "key": "btts",
                        "outcomes": [
                            {"name": "Yes", "price": 1.80},
                            {"name": "No", "price": 2.00},
                        ],
                    },
                    {
                        "key": "spreads",
                        "outcomes": [{"name": "Brann", "price": 1.90, "point": -1}],
                    },
                ],
            },
            {
                "title": "Coolbet",
                "markets": [
                    {
                        "key": "totals",
                        "outcomes": [
                            {"name": "Over", "price": 1.92, "point": 2.5},
                            {"name": "Under", "price": 1.88, "point": 2.5},
                        ],
                    },
                ],
            },
        ],
    }

    markets = {item["key"]: item for item in map_event_markets(payload)}
    assert set(markets) == {"h2h", "totals", "btts"}
    h2h_names = {row["name"]: row for row in markets["h2h"]["outcomes"]}
    assert h2h_names["Brann"]["price"] == 1.70
    totals = {row["name"]: row for row in markets["totals"]["outcomes"]}
    assert totals["Over"]["price"] == 1.92
    assert totals["Over"]["bookmaker"] == "Coolbet"
    assert totals["Over"]["point"] == 2.5
    assert "spreads" not in markets


def test_map_event_markets_omits_missing_btts():
    payload = {
        "home_team": "A",
        "away_team": "B",
        "bookmakers": [{
            "title": "Unibet",
            "markets": [{
                "key": "h2h",
                "outcomes": [{"name": "A", "price": 1.5}, {"name": "B", "price": 2.5}],
            }],
        }],
    }
    keys = [item["key"] for item in map_event_markets(payload)]
    assert keys == ["h2h"]


def _match(**overrides):
    row = {
        "id": "1",
        "sport_key": "soccer_norway_eliteserien",
        "sport_title": "Eliteserien",
        "commence_time": "2026-09-11T16:00:00Z",
        "home_team": "Brann",
        "away_team": "Molde",
        "completed": False,
        "scores": None,
        "odds_1x2": {"home": 1.7, "draw": 3.8, "away": 4.5},
    }
    row.update(overrides)
    return row


def test_filter_matches_by_local_date():
    rows = [
        _match(id="on", commence_time="2026-09-11T16:00:00Z"),
        _match(id="off", commence_time="2026-09-12T16:00:00Z"),
    ]
    ids = [row["id"] for row in filter_matches(rows, date="2026-09-11", status_filter="all")]
    assert ids == ["on"]


def test_filter_matches_live_finished_scheduled_odds():
    live = _match(id="live", scores=[{"name": "Brann", "score": "1"}, {"name": "Molde", "score": "0"}], completed=False)
    done = _match(id="done", completed=True, scores=[{"name": "Brann", "score": "2"}])
    soon = _match(id="soon", scores=None, completed=False, odds_1x2=None)
    priced = _match(id="priced")
    rows = [live, done, soon, priced]
    assert [row["id"] for row in filter_matches(rows, date="2026-09-11", status_filter="live")] == ["live"]
    assert [row["id"] for row in filter_matches(rows, date="2026-09-11", status_filter="finished")] == ["done"]
    assert [row["id"] for row in filter_matches(rows, date="2026-09-11", status_filter="scheduled")] == ["soon", "priced"]
    assert [row["id"] for row in filter_matches(rows, date="2026-09-11", status_filter="odds")] == ["live", "done", "priced"]


def test_filter_matches_uses_oslo_calendar_date():
    late = _match(id="late", commence_time="2026-09-11T22:30:00Z")
    assert [row["id"] for row in filter_matches([late], date="2026-09-12", status_filter="all")] == ["late"]
    assert [row["id"] for row in filter_matches([late], date="2026-09-11", status_filter="all")] == []


def test_favorite_sport_keys_only_from_pins_teams_and_starred_events():
    keys = favorite_sport_keys(
        league_keys=["soccer_epl", "", None],
        teams=[
            {"name": "Brann", "sport_key": "soccer_norway_eliteserien"},
            {"name": "Ghost", "sport_key": ""},
        ],
        events=[
            {"event_id": "star-1", "sport_key": "soccer_epl"},
            {"event_id": "star-2", "sport_key": None},
        ],
    )
    assert keys == ["soccer_epl", "soccer_norway_eliteserien"]
    assert "tennis_atp" not in keys
    assert "" not in keys


def test_favorite_matches_ignores_empty_sport_key_and_unrelated_sports():
    rows = [
        _match(
            id="tennis",
            sport_key="tennis_atp",
            sport_title="ATP US Open",
            home_team="Frances Tiafoe",
            away_team="Ben Shelton",
        ),
        _match(id="brann", sport_key="soccer_norway_eliteserien", home_team="Brann", away_team="Molde"),
        _match(id="city", sport_key="soccer_epl", home_team="Manchester City", away_team="Arsenal"),
    ]
    selected = favorite_matches(
        rows,
        league_keys=["", None],
        teams=[
            {"name": "Brann", "sport_key": "soccer_norway_eliteserien"},
            {"name": "Manchester City", "sport_key": "soccer_epl"},
            {"name": "Frances Tiafoe", "sport_key": ""},
        ],
        event_ids=[],
    )
    assert [row["id"] for row in selected] == ["brann", "city"]


def test_merge_sport_fetch_results_returns_partial_matches():
    from odds_client import OddsApiError

    ok = [_match(id="city", sport_key="soccer_epl", home_team="Manchester City", away_team="Arsenal")]
    merged = merge_sport_fetch_results([
        ok,
        OddsApiError(502, "Odds API utilgjengelig (500)"),
    ])
    assert [row["id"] for row in merged] == ["city"]


def test_merge_sport_fetch_results_raises_429_when_nothing_loaded():
    from odds_client import OddsApiError

    try:
        merge_sport_fetch_results([
            OddsApiError(502, "Odds API utilgjengelig (timeout)"),
            OddsApiError(429, "Odds API-kvote brukt opp (429)"),
        ])
    except OddsApiError as err:
        assert err.status_code == 429
        assert "429" in err.detail
    else:
        raise AssertionError("expected OddsApiError")


def test_favorite_matches_is_union_of_league_team_and_event():
    rows = [
        _match(id="league", sport_key="soccer_epl", home_team="Arsenal", away_team="Chelsea"),
        _match(id="team", sport_key="soccer_norway_eliteserien", home_team="Brann", away_team="Molde"),
        _match(id="star", sport_key="soccer_france_ligue_one", home_team="Rennes", away_team="Marseille"),
        _match(id="other", sport_key="soccer_germany_bundesliga", home_team="Schalke", away_team="Union Berlin"),
    ]
    selected = favorite_matches(
        rows,
        league_keys=["soccer_epl"],
        teams=[{"name": "Brann", "sport_key": "soccer_norway_eliteserien"}],
        event_ids=["star"],
    )
    assert [row["id"] for row in selected] == ["league", "team", "star"]


def test_sport_tab_keys_groups_soccer_keys():
    sports = [
        {"key": "soccer_epl", "group": "Soccer", "title": "EPL", "active": True},
        {"key": "basketball_nba", "group": "Basketball", "title": "NBA", "active": True},
        {"key": "soccer_norway_eliteserien", "group": "Soccer", "title": "Eliteserien", "active": True},
    ]
    assert sport_tab_keys(sports, "soccer") == ["soccer_epl", "soccer_norway_eliteserien"]
    assert sport_tab_keys(sports, "basketball") == ["basketball_nba"]


def test_search_finds_leagues_and_teams_by_substring():
    sports = [
        {"key": "soccer_norway_eliteserien", "title": "Eliteserien", "group": "Soccer", "active": True},
        {"key": "soccer_epl", "title": "Premier League", "group": "Soccer", "active": True},
    ]
    events = [
        {"sport_key": "soccer_norway_eliteserien", "home_team": "Brann", "away_team": "Molde"},
        {"sport_key": "soccer_epl", "home_team": "Arsenal", "away_team": "Chelsea"},
    ]
    result = search_leagues_and_teams(sports, events, "bran")
    assert result["leagues"] == []
    assert result["teams"] == [{"name": "Brann", "sport_key": "soccer_norway_eliteserien"}]
    leagues = search_leagues_and_teams(sports, events, "elite")
    assert leagues["leagues"][0]["key"] == "soccer_norway_eliteserien"


def _soccer_sports_with_eliteserien_last(count=10):
    sports = [
        {"key": f"soccer_league_{index}", "group": "Soccer", "title": f"League {index}", "active": True}
        for index in range(count)
    ]
    sports.append({
        "key": "soccer_norway_eliteserien",
        "group": "Soccer",
        "title": "Eliteserien",
        "active": True,
    })
    sports.append({
        "key": "soccer_epl",
        "group": "Soccer",
        "title": "Premier League",
        "active": True,
    })
    return sports


def test_search_event_sport_keys_uses_all_soccer_when_query_is_team_name():
    sports = _soccer_sports_with_eliteserien_last()
    keys = search_event_sport_keys(sports, "Brann")
    assert "soccer_norway_eliteserien" in keys
    assert "soccer_epl" in keys
    assert len(keys) == len(sports)
    assert keys == sport_tab_keys(sports, "soccer")


def test_search_event_sport_keys_keeps_matched_league_when_query_hits_title():
    sports = _soccer_sports_with_eliteserien_last()
    assert search_event_sport_keys(sports, "elite") == ["soccer_norway_eliteserien"]
    assert search_event_sport_keys(sports, "premier") == ["soccer_epl"]


def test_search_finds_team_when_query_tokens_match_name():
    sports = [{"key": "soccer_epl", "title": "Premier League", "group": "Soccer", "active": True}]
    events = [{"sport_key": "soccer_epl", "home_team": "Manchester City", "away_team": "Arsenal"}]
    result = search_leagues_and_teams(sports, events, "Man City")
    assert result["teams"] == [{"name": "Manchester City", "sport_key": "soccer_epl"}]
