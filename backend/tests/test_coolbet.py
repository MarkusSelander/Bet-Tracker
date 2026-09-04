from coolbet import extract_legs, map_coolbet_ticket


def _ticket(**overrides):
    data = {
        "id": "ticket-abc",
        "display_id": 1949,
        "created_at": "2026-09-02T17:12:17.012Z",
        "status": "WON",
        "total_stake": 700,
        "max_win": 1274,
        "remaining_max_win": 1274,
        "product": "PREMATCH",
        "currency": "NOK",
        "ticket_type": "single",
        "total_matches": 1,
        "first_bet_odds": 1.82,
        "first_match": {
            "sport_name": "Fotball",
            "match_name": "Brann - Rosenborg",
            "league_name": "Eliteserien",
            "market_name": "Match Result (1X2)",
            "outcome_name": "Brann",
        },
    }
    data.update(overrides)
    return data


def test_won_ticket_uses_payout_minus_stake_and_normalizes_sport():
    bet = map_coolbet_ticket(_ticket())

    assert bet["source_id"] == "ticket-abc"
    assert bet["date"] == "2026-09-02"
    assert bet["time"] == "17:12:17"
    assert bet["game"] == "Brann - Rosenborg"
    assert bet["bet"] == "Match Result (1X2) · Brann"
    assert bet["stake"] == 700
    assert bet["odds"] == 1.82
    assert bet["status"] == "won"
    assert bet["result"] == 574
    assert bet["bookie"] == "Coolbet"
    assert bet["sport"] == "Football"
    assert bet["league"] == "Eliteserien"
    assert bet["ticket_type"] == "single"
    assert bet["product"] == "PREMATCH"
    assert bet["total_matches"] == 1


def test_lost_ticket_is_negative_stake():
    bet = map_coolbet_ticket(_ticket(status="LOST", max_win=0, remaining_max_win=0))

    assert bet["status"] == "lost"
    assert bet["result"] == -700


def test_combo_appends_extra_match_count_to_game():
    bet = map_coolbet_ticket(
        _ticket(
            ticket_type="combo",
            total_matches=3,
            first_match={
                "sport_name": "Tennis",
                "match_name": "Alcaraz, C - Faria, J",
                "league_name": "ATP US Open",
                "market_name": "Match Result",
                "outcome_name": "Alcaraz, C",
            },
        )
    )

    assert bet["game"] == "Alcaraz, C - Faria, J (+2)"
    assert bet["ticket_type"] == "combo"
    assert bet["sport"] == "Tennis"
    assert len(bet["legs"]) == 1
    assert bet["legs"][0]["match"] == "Alcaraz, C - Faria, J"


def test_pending_ticket_has_zero_result_and_keeps_expected_date():
    bet = map_coolbet_ticket(
        _ticket(
            status="PENDING",
            expected_result_date="2026-09-03T01:00:00.000Z",
        )
    )

    assert bet["status"] == "pending"
    assert bet["result"] == 0
    assert bet["expected_result_date"] == "2026-09-03T01:00:00.000Z"


def test_confirmed_cashout_is_own_status_with_cashout_minus_stake():
    bet = map_coolbet_ticket(
        _ticket(
            status="LOST",
            cashout_status="CONFIRMED",
            cashout_amount=458.52,
            max_win=0,
        )
    )

    assert bet["status"] == "cashed"
    assert bet["result"] == round(458.52 - 700, 2)
    assert bet["cashout_amount"] == 458.52


def test_pushed_and_cancelled_return_stake():
    pushed = map_coolbet_ticket(_ticket(status="PUSHED"))
    cancelled = map_coolbet_ticket(_ticket(status="CANCELLED"))

    assert pushed["status"] == "push"
    assert pushed["result"] == 0
    assert cancelled["status"] == "push"
    assert cancelled["result"] == 0


def test_extract_legs_from_nested_bets_matches():
    legs = extract_legs(
        {
            "bets": [
                {
                    "matches": [
                        {
                            "match_name": "Brann - Molde",
                            "market_name": "Match Result (1X2)",
                            "outcome_name": "Brann",
                            "sport_name": "Fotball",
                            "league_name": "Eliteserien",
                            "odds": 1.85,
                            "status": "WON",
                        },
                        {
                            "match_name": "Lakers vs Celtics",
                            "market_name": "Money Line",
                            "outcome_name": "Lakers",
                            "sport_name": "Basketball",
                            "odds": 1.7,
                            "status": "LOST",
                        },
                    ]
                }
            ]
        }
    )

    assert len(legs) == 2
    assert legs[0]["match"] == "Brann - Molde"
    assert legs[0]["market"] == "Match Result (1X2)"
    assert legs[0]["outcome"] == "Brann"
    assert legs[0]["sport"] == "Football"
    assert legs[1]["match"] == "Lakers vs Celtics"
    assert legs[1]["status"] == "lost"


def test_map_combo_stores_legs_from_details():
    bet = map_coolbet_ticket(
        _ticket(
            ticket_type="combo",
            total_matches=2,
            matches=[
                {
                    "match_name": "Brann - Molde",
                    "market_name": "1X2",
                    "outcome_name": "Brann",
                    "sport_name": "Fotball",
                },
                {
                    "match_name": "Rosenborg - Viking",
                    "market_name": "Over/Under 2.5",
                    "outcome_name": "Over",
                    "sport_name": "Fotball",
                },
            ],
        )
    )

    assert len(bet["legs"]) == 2
    assert bet["legs"][1]["match"] == "Rosenborg - Viking"
    assert bet["total_matches"] == 2
