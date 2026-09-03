import re

from coolbet_sync import (
    CHROME_EXTENSION_ORIGIN_RE,
    auth_headers,
    history_query,
    import_url,
    login_payload,
    should_stop_pagination,
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
