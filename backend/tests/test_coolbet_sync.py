import re

from datetime import datetime, timezone

from coolbet_sync import (
    CHROME_EXTENSION_ORIGIN_RE,
    auth_headers,
    history_query,
    import_url,
    login_payload,
    merge_ticket_details,
    needs_ticket_details,
    resolve_last_coolbet_sync_at,
    should_stop_pagination,
    ticket_detail_paths,
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


def test_should_continue_when_unknown_or_open_tickets_remain():
    known = {"a"}
    assert not should_stop_pagination(
        tickets=[{"id": "a", "status": "WON"}, {"id": "new", "status": "WON"}],
        has_next_page=True,
        known_ids=known,
    )
    assert not should_stop_pagination(
        tickets=[{"id": "a", "status": "PENDING"}],
        has_next_page=True,
        known_ids=known,
    )


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
    paths = ticket_detail_paths("26090221-4ce1-4145-b10d-387fb0146ecd", display_id=1949)
    assert paths[0].startswith("/s/sbgate/bets/26090221-4ce1-4145-b10d-387fb0146ecd")
    assert "language=eu" in paths[0]
    assert any("/s/sbgate/bets/ticket/" in path for path in paths)
    assert any(path.startswith("/s/sbgate/bets/1949?") for path in paths)


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
