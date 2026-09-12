import re

from datetime import datetime, timezone

from coolbet_sync import (
    CHROME_EXTENSION_ORIGIN_RE,
    auth_headers,
    collect_incomplete_ids_from_bets,
    history_query,
    import_url,
    login_payload,
    merge_ticket_details,
    needs_ticket_details,
    resolve_last_coolbet_sync_at,
    should_fetch_ticket_details,
    should_stop_pagination,
    ticket_detail_paths,
    tickets_to_import,
)


def test_history_query_matches_coolbet_api_contract():
    query = history_query(page_number=2)

    assert query["isCampaign"] == "false"
    assert query["isCashout"] == "true"
    assert query["language"] == "eu"
    assert query["layout"] == "EUROPEAN"
    assert query["pageNumber"] == 2
    assert query["pageSize"] == 50
    assert "WON" in query["ticketStatus"]
    assert "PENDING" in query["ticketStatus"]
    assert query["ticketStatus"].startswith("all,")


def test_import_url_strips_trailing_slash():
    assert import_url("https://api.example.com/") == "https://api.example.com/api/bets/import/coolbet"
    assert import_url("https://api.example.com") == "https://api.example.com/api/bets/import/coolbet"


def test_auth_headers_use_bearer_token():
    headers = auth_headers("session_abc")

    assert headers["Authorization"] == "Bearer session_abc"
    assert headers["Content-Type"] == "application/json"


def test_login_payload_includes_session_token_without_dropping_user_fields():
    payload = login_payload({"user_id": "u1", "email": "a@b.c"}, "session_xyz")

    assert payload["session_token"] == "session_xyz"
    assert payload["email"] == "a@b.c"
    assert payload["user_id"] == "u1"


def test_should_stop_when_no_next_page_or_empty():
    assert should_stop_pagination(tickets=[{"id": "1"}], has_next_page=False, known_ids=set())
    assert should_stop_pagination(tickets=[], has_next_page=True, known_ids=set())


def test_should_stop_when_page_is_all_known_settled_tickets():
    tickets = [
        {"id": "a", "status": "WON"},
        {"id": "b", "status": "LOST"},
    ]
    assert should_stop_pagination(
        tickets=tickets,
        has_next_page=True,
        known_ids={"a", "b"},
    )


def test_should_continue_while_oldest_ticket_on_page_is_unknown():
    known = {"a"}
    assert not should_stop_pagination(
        tickets=[{"id": "a", "status": "WON"}, {"id": "new", "status": "WON"}],
        has_next_page=True,
        known_ids=known,
    )


def test_should_stop_once_newest_first_page_reaches_known_ticket():
    assert should_stop_pagination(
        tickets=[{"id": "new", "status": "WON"}, {"id": "a", "status": "LOST"}],
        has_next_page=True,
        known_ids={"a"},
    )
    assert should_stop_pagination(
        tickets=[{"id": "a", "status": "PENDING"}],
        has_next_page=True,
        known_ids={"a"},
    )


def test_should_not_walk_older_pages_for_pending_or_incomplete_ids():
    assert should_stop_pagination(
        tickets=[{"id": "a", "status": "LOST"}, {"id": "b", "status": "LOST"}],
        has_next_page=True,
        known_ids={"a", "b"},
        pending_ids={"older-open"},
        incomplete_ids={"older-combo"},
    )


def test_first_sync_without_known_ids_keeps_paging():
    assert not should_stop_pagination(
        tickets=[{"id": "a", "status": "WON"}, {"id": "b", "status": "LOST"}],
        has_next_page=True,
        known_ids=set(),
    )


def test_collect_incomplete_ids_from_bets_keeps_combos_missing_legs():
    assert collect_incomplete_ids_from_bets(
        [
            {
                "source_id": "incomplete-settled",
                "status": "won",
                "ticket_type": "combo",
                "total_matches": 5,
                "legs_count": 1,
            },
            {
                "source_id": "complete-settled",
                "status": "lost",
                "ticket_type": "combo",
                "total_matches": 2,
                "legs_count": 2,
            },
            {
                "source_id": "single",
                "status": "won",
                "ticket_type": "single",
                "total_matches": 1,
                "legs_count": 1,
            },
            {
                "source_id": "incomplete-pending",
                "status": "pending",
                "ticket_type": "combo",
                "total_matches": 3,
                "legs": [{"match": "A - B"}],
            },
        ]
    ) == ["incomplete-settled", "incomplete-pending"]


def test_tickets_to_import_reimports_incomplete_settled_combos():
    tickets = [
        {"id": "complete-won", "status": "WON"},
        {"id": "incomplete-combo", "status": "WON"},
    ]
    imported = tickets_to_import(
        tickets,
        known_ids={"complete-won", "incomplete-combo"},
        pending_ids=set(),
        incomplete_ids={"incomplete-combo"},
    )
    assert [ticket["id"] for ticket in imported] == ["incomplete-combo"]


def test_tickets_to_import_skips_known_complete_combo_even_with_detail_legs():
    uuid = "26091204-3cbd-47e8-8111-e3517af40f5d"
    ticket = {
        "id": uuid,
        "status": "WON",
        "ticket_type": "combo",
        "total_matches": 2,
        "uniqueSelections": [
            {"match_name": "Chelsea - Hull"},
            {"match_name": "Fukuoka SoftBank Hawks - Chiba Lotte Marines"},
        ],
    }
    imported = tickets_to_import([ticket], known_ids={uuid}, pending_ids=set(), incomplete_ids=set())
    assert imported == []


def test_should_not_fetch_details_for_known_complete_pending_combo():
    ticket = {
        "id": "was-open",
        "total_matches": 2,
        "ticket_type": "combo",
        "status": "PENDING",
    }
    assert should_fetch_ticket_details(ticket, {"was-open"}, {"was-open"}, set()) is False


def test_should_fetch_ticket_details_skips_complete_and_keeps_incomplete_settled():
    uuid = "26091204-3cbd-47e8-8111-e3517af40f5d"
    complete = {
        "id": uuid,
        "status": "WON",
        "ticket_type": "combo",
        "total_matches": 2,
        "uniqueSelections": [
            {"match_name": "Chelsea - Hull"},
            {"match_name": "Fukuoka SoftBank Hawks - Chiba Lotte Marines"},
        ],
    }
    incomplete_list = {
        "id": uuid,
        "status": "WON",
        "ticket_type": "combo",
        "total_matches": 2,
    }
    known = {uuid}
    assert should_fetch_ticket_details(complete, known, set(), set()) is False
    assert should_fetch_ticket_details(incomplete_list, known, set(), {uuid}) is True
    assert should_fetch_ticket_details(incomplete_list, known, set(), set()) is False
    assert tickets_to_import([complete], known_ids=known, pending_ids=set(), incomplete_ids=set()) == []
    assert [
        ticket["id"]
        for ticket in tickets_to_import(
            [incomplete_list], known_ids=known, pending_ids=set(), incomplete_ids={uuid}
        )
    ] == [uuid]


def test_chrome_extension_origin_regex_allows_unpacked_ids():
    origin = "chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef"
    assert re.match(CHROME_EXTENSION_ORIGIN_RE, origin)
    assert not re.match(CHROME_EXTENSION_ORIGIN_RE, "https://evil.example")
    assert not re.match(CHROME_EXTENSION_ORIGIN_RE, "chrome-extension://../")


def test_combo_tickets_need_details_until_matches_exist():
    assert needs_ticket_details({"id": "a", "total_matches": 2, "ticket_type": "combo"})
    assert needs_ticket_details({"id": "b", "ticket_type": "system"})
    assert not needs_ticket_details({"id": "c", "total_matches": 1, "ticket_type": "single"})
    assert needs_ticket_details(
        {"id": "d", "total_matches": 2, "matches": [{"match_name": "A - B"}]}
    )
    assert not needs_ticket_details(
        {
            "id": "e",
            "total_matches": 2,
            "matches": [{"match_name": "A - B"}, {"match_name": "C - D"}],
        }
    )


def test_ticket_detail_paths_include_id():
    uuid = "26090221-4ce1-4145-b10d-387fb0146ecd"
    paths = ticket_detail_paths(uuid, display_id=1949)
    assert paths == [
        f"/s/sbgate/bets/tickets/{uuid}?language=eu&layout=EUROPEAN&ticketId={uuid}"
    ]
    assert "1949" not in "".join(paths)


def test_ticket_detail_paths_never_fetch_display_id_2006():
    uuid = "26091204-3cbd-47e8-8111-e3517af40f5d"
    paths = ticket_detail_paths(uuid, display_id=2006)
    assert paths == [
        f"/s/sbgate/bets/tickets/{uuid}?language=eu&layout=EUROPEAN&ticketId={uuid}"
    ]
    for path in paths:
        assert "/tickets/2006" not in path
        assert "2006" not in path
        assert f"ticketId={uuid}" in path


def test_resolve_last_coolbet_sync_at_uses_user_field_then_latest_bet():
    stored = datetime(2026, 9, 4, 12, 0, tzinfo=timezone.utc)
    fallback = datetime(2026, 8, 1, 9, 0, tzinfo=timezone.utc)
    assert resolve_last_coolbet_sync_at({"last_coolbet_sync_at": stored}, fallback) == stored
    assert resolve_last_coolbet_sync_at({}, fallback) == fallback
    assert resolve_last_coolbet_sync_at({"last_coolbet_sync_at": None}, None) is None


def test_merge_unwraps_nested_ticket_payload():
    merged = merge_ticket_details(
        {"id": "a", "total_matches": 2, "ticket_type": "combo"},
        {"ticket": {"matches": [{"match_name": "A - B"}, {"match_name": "C - D"}]}},
    )
    assert merged["matches"][1]["match_name"] == "C - D"
    assert not needs_ticket_details(merged)


def test_merge_copies_unique_selections_from_ticket_detail():
    merged = merge_ticket_details(
        {
            "id": "TICKET-UUID",
            "total_matches": 2,
            "ticket_type": "combo",
            "first_match": {"match_name": "Some Home - Liverpool"},
        },
        {
            "bets": [{"leg_count": 2, "outcome_ids": [1, 2], "status": "PENDING"}],
            "ticket": {"id": "TICKET-UUID", "ticket_type": "combo", "total_matches": 2},
            "uniqueSelections": [
                {"match_name": "Some Home - Liverpool", "outcome_name": "Liverpool"},
                {"match_name": "Sabalenka, A - Rybakina, E", "outcome_name": "Sabalenka, A"},
            ],
        },
    )
    assert len(merged["uniqueSelections"]) == 2
    assert merged["uniqueSelections"][1]["match_name"] == "Sabalenka, A - Rybakina, E"
    assert not needs_ticket_details(merged)
    assert needs_ticket_details(
        {
            "id": "TICKET-UUID",
            "total_matches": 2,
            "ticket_type": "combo",
            "bets": [{"leg_count": 2, "outcome_ids": [1, 2]}],
        }
    )
