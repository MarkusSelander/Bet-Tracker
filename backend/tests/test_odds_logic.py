from odds_logic import best_h2h, filter_matches, map_event_markets


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
