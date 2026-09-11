from odds_logic import best_h2h


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
