from coolbet import extract_legs, map_coolbet_ticket
from coolbet_sync import merge_ticket_details, ticket_detail_paths

CHELSEA_HULL_UUID = "26091204-3cbd-47e8-8111-e3517af40f5d"


def _chelsea_hull_history_list_ticket(**overrides):
    data = {
        "id": CHELSEA_HULL_UUID,
        "display_id": 2006,
        "created_at": "2026-09-12T00:05:00.000Z",
        "status": "PENDING",
        "ticket_type": "combo",
        "total_matches": 2,
        "total_stake": 500,
        "first_bet_odds": 1.8848,
        "max_win": 942.4,
        "remaining_max_win": 942.4,
        "product": "PREMATCH",
        "first_match": {
            "sport_name": "Football",
            "match_name": "Chelsea - Hull",
            "league_name": "Premier League",
            "market_name": "Match Result (1X2)",
            "outcome_name": "Chelsea",
        },
    }
    data.update(overrides)
    return data


def _chelsea_hull_ticket_detail():
    return {
        "bets": [
            {
                "id": "BET-UUID",
                "stake": 500,
                "initial_stake": 500,
                "created_at": "2026-09-12T00:05:00.000Z",
                "expected_result_date": "2026-09-12T22:25:00.000Z",
                "leg_count": 2,
                "max_win": 942.4,
                "outcome_ids": [1702568001, 1712054802],
                "status": "PENDING",
                "total_odds": 1.8848,
            }
        ],
        "systemsMeta": None,
        "ticket": {
            "id": CHELSEA_HULL_UUID,
            "ticket_type": "combo",
            "currency": "NOK",
            "display_id": 2006,
            "first_bet_odds": 1.8848,
            "status": "PENDING",
            "total_matches": 2,
            "total_stake": 500,
            "cashout_amount": None,
            "expected_result_date": "2026-09-12T22:25:00.000Z",
        },
        "uniqueSelections": [
            {
                "outcome_id": 1702568001,
                "outcome_name": "Chelsea",
                "market_name": "Match Result (1X2)",
                "league_name": "Premier League",
                "sport_name": "Football",
                "sportName": "Football",
                "match_name": "Chelsea - Hull",
                "odds": 1.24,
                "display_odds": "1.24",
                "product": "PREMATCH",
                "status": "PENDING",
            },
            {
                "outcome_id": 1712054802,
                "outcome_name": "Fukuoka SoftBank Hawks",
                "market_name": "Money Line (Action)",
                "league_name": "Professional Baseball",
                "sport_name": "Baseball",
                "sportName": "Baseball",
                "match_name": "Fukuoka SoftBank Hawks - Chiba Lotte Marines",
                "odds": 1.52,
                "display_odds": "1.52",
                "product": "PREMATCH",
                "status": "PENDING",
            },
        ],
    }


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


def _combo_ticket_detail_payload():
    return {
        "bets": [
            {
                "id": "BET-UUID",
                "stake": 1000,
                "initial_stake": 1000,
                "created_at": "2026-09-12T03:36:17.959Z",
                "expected_result_date": "2026-09-12T22:25:00.000Z",
                "leg_count": 2,
                "max_win": 2590,
                "outcome_ids": [1702567143, 1712054724],
                "status": "PENDING",
                "total_odds": 2.59,
            }
        ],
        "systemsMeta": None,
        "ticket": {
            "id": "TICKET-UUID",
            "ticket_type": "combo",
            "currency": "NOK",
            "display_id": 2004,
            "first_bet_odds": 2.59,
            "status": "PENDING",
            "total_matches": 2,
            "total_stake": 1000,
            "cashout_amount": None,
            "expected_result_date": "2026-09-12T22:25:00.000Z",
        },
        "uniqueSelections": [
            {
                "outcome_id": 1702567143,
                "outcome_name": "Liverpool",
                "market_name": "Match Result (1X2)",
                "league_name": "Premier League",
                "sport_name": "Football",
                "sportName": "Football",
                "match_name": "Some Home - Liverpool",
                "odds": 1.48,
                "display_odds": "1.48",
                "product": "PREMATCH",
                "status": "PENDING",
            },
            {
                "outcome_id": 1712054724,
                "outcome_name": "Sabalenka, A",
                "market_name": "Match Result",
                "marketTypeName": "Match Result",
                "categoryName": "WTA US Open",
                "league_name": "WTA US Open",
                "sport_name": "Tennis",
                "sportName": "Tennis",
                "match_name": "Sabalenka, A - Rybakina, E",
                "match_start": "2026-09-12T20:05:00.000Z",
                "odds": 1.75,
                "display_odds": "1.75",
                "product": "PREMATCH",
                "status": "PENDING",
            },
        ],
    }


def test_map_combo_stores_all_unique_selections_as_legs():
    history_ticket = _ticket(
        id="TICKET-UUID",
        display_id=2004,
        created_at="2026-09-12T03:36:17.959Z",
        status="PENDING",
        total_stake=1000,
        max_win=2590,
        remaining_max_win=2590,
        ticket_type="combo",
        total_matches=2,
        first_bet_odds=2.59,
        first_match={
            "sport_name": "Football",
            "match_name": "Some Home - Liverpool",
            "league_name": "Premier League",
            "market_name": "Match Result (1X2)",
            "outcome_name": "Liverpool",
        },
        uniqueSelections=_combo_ticket_detail_payload()["uniqueSelections"],
        bets=_combo_ticket_detail_payload()["bets"],
    )

    bet = map_coolbet_ticket(history_ticket)

    assert bet["game"] == "Some Home - Liverpool (+1)"
    assert bet["ticket_type"] == "combo"
    assert bet["total_matches"] == 2
    assert len(bet["legs"]) == 2
    assert bet["legs"][0] == {
        "match": "Some Home - Liverpool",
        "market": "Match Result (1X2)",
        "outcome": "Liverpool",
        "sport": "Football",
        "league": "Premier League",
        "odds": 1.48,
        "status": "pending",
        "product": "PREMATCH",
        "start_time": None,
    }
    assert bet["legs"][1] == {
        "match": "Sabalenka, A - Rybakina, E",
        "market": "Match Result",
        "outcome": "Sabalenka, A",
        "sport": "Tennis",
        "league": "WTA US Open",
        "odds": 1.75,
        "status": "pending",
        "product": "PREMATCH",
        "start_time": "2026-09-12T20:05:00.000Z",
    }


def test_extract_legs_prefers_unique_selections_over_first_match():
    legs = extract_legs(
        {
            "first_match": {
                "match_name": "Some Home - Liverpool",
                "market_name": "Match Result (1X2)",
                "outcome_name": "Liverpool",
            },
            **_combo_ticket_detail_payload(),
        }
    )

    assert len(legs) == 2
    assert legs[0]["match"] == "Some Home - Liverpool"
    assert legs[1]["match"] == "Sabalenka, A - Rybakina, E"
    assert legs[1]["product"] == "PREMATCH"


def test_extract_legs_copies_match_start():
    legs = extract_legs(_combo_ticket_detail_payload())
    assert legs[0].get("start_time") is None
    assert legs[1]["start_time"] == "2026-09-12T20:05:00.000Z"


def test_merged_ticket_detail_import_stores_all_legs():
    from coolbet_sync import merge_ticket_details

    history = _ticket(
        id="TICKET-UUID",
        display_id=2004,
        created_at="2026-09-12T03:36:17.959Z",
        status="PENDING",
        total_stake=1000,
        max_win=2590,
        remaining_max_win=2590,
        ticket_type="combo",
        total_matches=2,
        first_bet_odds=2.59,
        first_match={
            "sport_name": "Football",
            "match_name": "Some Home - Liverpool",
            "league_name": "Premier League",
            "market_name": "Match Result (1X2)",
            "outcome_name": "Liverpool",
        },
    )
    merged = merge_ticket_details(history, _combo_ticket_detail_payload())
    bet = map_coolbet_ticket(merged)

    assert len(merged["uniqueSelections"]) == 2
    assert len(bet["legs"]) == 2
    assert bet["legs"][1]["match"] == "Sabalenka, A - Rybakina, E"
    assert bet["total_matches"] == 2


def test_merged_settled_combo_detail_overwrites_single_stored_leg():
    from coolbet_sync import merge_ticket_details

    history = _ticket(
        id="TICKET-UUID",
        display_id=2004,
        created_at="2026-09-12T03:36:17.959Z",
        status="WON",
        total_stake=1000,
        max_win=2590,
        remaining_max_win=2590,
        ticket_type="combo",
        total_matches=5,
        first_bet_odds=2.59,
        first_match={
            "sport_name": "Football",
            "match_name": "Some Home - Liverpool",
            "league_name": "Premier League",
            "market_name": "Match Result (1X2)",
            "outcome_name": "Liverpool",
        },
        legs=[{"match": "Some Home - Liverpool"}],
    )
    payload = _combo_ticket_detail_payload()
    payload["bets"][0]["status"] = "WON"
    payload["ticket"]["status"] = "WON"
    payload["uniqueSelections"][0]["status"] = "WON"
    payload["uniqueSelections"][1]["status"] = "WON"
    merged = merge_ticket_details(history, payload)
    bet = map_coolbet_ticket(merged)

    assert history["status"] == "WON"
    assert len(merged["uniqueSelections"]) == 2
    assert len(bet["legs"]) == 2
    assert bet["legs"][1]["match"] == "Sabalenka, A - Rybakina, E"
    assert bet["status"] == "won"


def test_chelsea_hull_list_has_only_first_match():
    history = _chelsea_hull_history_list_ticket()
    assert "uniqueSelections" not in history
    bet = map_coolbet_ticket(history)
    assert bet["source_id"] == CHELSEA_HULL_UUID
    assert bet["display_id"] == 2006
    assert bet["ticket_type"] == "combo"
    assert bet["total_matches"] == 2
    assert len(bet["legs"]) == 1
    assert bet["legs"][0]["match"] == "Chelsea - Hull"


def test_chelsea_hull_detail_url_uses_list_uuid_never_display_id():
    paths = ticket_detail_paths(CHELSEA_HULL_UUID, display_id=2006)
    assert paths == [
        f"/s/sbgate/bets/tickets/{CHELSEA_HULL_UUID}?language=eu&layout=EUROPEAN&ticketId={CHELSEA_HULL_UUID}"
    ]
    for path in paths:
        assert "/tickets/2006" not in path
        assert "2006" not in path


def test_chelsea_hull_merged_detail_maps_both_list_legs():
    merged = merge_ticket_details(_chelsea_hull_history_list_ticket(), _chelsea_hull_ticket_detail())
    bet = map_coolbet_ticket(merged)

    assert merged["id"] == CHELSEA_HULL_UUID
    assert len(merged["uniqueSelections"]) == 2
    assert merged["uniqueSelections"][1]["match_name"] == (
        "Fukuoka SoftBank Hawks - Chiba Lotte Marines"
    )
    assert bet["source_id"] == CHELSEA_HULL_UUID
    assert len(bet["legs"]) == 2
    assert bet["legs"][0]["match"] == "Chelsea - Hull"
    assert bet["legs"][0]["outcome"] == "Chelsea"
    assert bet["legs"][0]["odds"] == 1.24
    assert bet["legs"][1]["match"] == "Fukuoka SoftBank Hawks - Chiba Lotte Marines"
    assert bet["legs"][1]["market"] == "Money Line (Action)"
    assert bet["legs"][1]["outcome"] == "Fukuoka SoftBank Hawks"
    assert bet["legs"][1]["sport"] == "Baseball"
    assert bet["legs"][1]["odds"] == 1.52


def test_chelsea_hull_existing_settled_combo_with_one_leg_gets_both_after_merge():
    history = _chelsea_hull_history_list_ticket(
        status="WON",
        legs=[{"match": "Chelsea - Hull"}],
    )
    merged = merge_ticket_details(history, _chelsea_hull_ticket_detail())
    bet = map_coolbet_ticket(merged)

    assert len(bet["legs"]) == 2
    assert bet["legs"][1]["match"] == "Fukuoka SoftBank Hawks - Chiba Lotte Marines"
