from coolbet_odds import attach_odds, extract_1x2, flatten_search_payload, match_event


def test_flatten_reads_matches_or_events_lists():
    nested = flatten_search_payload({"matches": [{"id": "1", "name": "Brann - Viking"}]})
    assert nested[0]["id"] == "1"
    direct = flatten_search_payload([{"id": "2"}])
    assert direct[0]["id"] == "2"


def test_flatten_skips_empty_list_and_reads_next_key():
    events = flatten_search_payload(
        {"matches": [], "events": [{"id": "1", "name": "Brann - Viking"}]}
    )
    assert events[0]["id"] == "1"


def test_match_event_pairs_same_day_and_both_team_names():
    fixture = {
        "home_team_name": "SK Brann",
        "away_team_name": "Viking FK",
        "event_date": "2026-09-06",
    }
    events = [
        {"id": "wrong", "name": "Rosenborg - Molde", "start_date": "2026-09-06T16:00:00Z"},
        {"id": "hit", "name": "Brann - Viking", "startTime": "2026-09-06T16:00:00.000Z"},
    ]
    assert match_event(fixture, events)["id"] == "hit"


def test_match_event_returns_none_when_date_or_names_differ():
    fixture = {
        "home_team_name": "Brann",
        "away_team_name": "Viking",
        "event_date": "2026-09-06",
    }
    assert match_event(fixture, [{"id": "a", "name": "Brann - Viking", "start_date": "2026-09-07T16:00:00Z"}]) is None
    assert match_event(fixture, [{"id": "b", "name": "Brann - Molde", "start_date": "2026-09-06T16:00:00Z"}]) is None


def test_extract_1x2_from_named_market():
    odds = extract_1x2(
        {
            "markets": [
                {
                    "name": "Match Result (1X2)",
                    "outcomes": [
                        {"name": "1", "odds": 1.85},
                        {"name": "X", "odds": 3.4},
                        {"name": "2", "odds": 4.2},
                    ],
                }
            ]
        }
    )
    assert odds == {"home": 1.85, "draw": 3.4, "away": 4.2}


def test_attach_odds_sets_nulls_when_no_event():
    fixture = {
        "fixture_id": "e1",
        "home_team_name": "Brann",
        "away_team_name": "Viking",
        "event_date": "2026-09-06",
    }
    out = attach_odds(fixture, [])
    assert out["odds_1x2"] is None
    assert out["coolbet_event_id"] is None
    assert out["fixture_id"] == "e1"


def test_attach_odds_sets_1x2_and_event_id_on_hit():
    fixture = {
        "fixture_id": "e1",
        "home_team_name": "Brann",
        "away_team_name": "Viking",
        "event_date": "2026-09-06",
    }
    events = [
        {
            "id": "hit",
            "name": "Brann - Viking",
            "start_date": "2026-09-06T16:00:00Z",
            "markets": [
                {
                    "name": "Match Result (1X2)",
                    "outcomes": [
                        {"name": "1", "odds": 1.85},
                        {"name": "X", "odds": 3.4},
                        {"name": "2", "odds": 4.2},
                    ],
                }
            ],
        }
    ]
    out = attach_odds(fixture, events)
    assert out["odds_1x2"] == {"home": 1.85, "draw": 3.4, "away": 4.2}
    assert out["coolbet_event_id"] == "hit"


from coolbet_odds import extract_main_markets


def test_extract_main_markets_keeps_1x2_ou_btts_only():
    markets = extract_main_markets(
        {
            "id": "hit",
            "markets": [
                {
                    "name": "Match Result (1X2)",
                    "outcomes": [
                        {"name": "1", "odds": 1.85},
                        {"name": "X", "odds": 3.4},
                        {"name": "2", "odds": 4.2},
                    ],
                },
                {
                    "name": "Total Goals Over/Under 2.5",
                    "outcomes": [
                        {"name": "Over", "odds": 1.72},
                        {"name": "Under", "odds": 2.05},
                    ],
                },
                {
                    "name": "Both Teams to Score",
                    "outcomes": [
                        {"name": "Yes", "odds": 1.8},
                        {"name": "No", "odds": 1.95},
                    ],
                },
                {
                    "name": "Correct Score",
                    "outcomes": [{"name": "1-0", "odds": 8.0}],
                },
            ],
        }
    )
    names = [market["key"] for market in markets]
    assert names == ["1x2", "over_under", "btts"]
    assert markets[1]["line"] == 2.5
    assert markets[2]["outcomes"][0]["odds"] == 1.8


def test_extract_main_markets_empty_without_event():
    assert extract_main_markets(None) == []
    assert extract_main_markets({}) == []


from coolbet_odds import search_query, fetch_coolbet_events


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def json(self):
        return self._payload


class FakeClient:
    def __init__(self, payload):
        self.payload = payload
        self.urls = []

    def get(self, url, timeout=10.0, headers=None):
        self.urls.append(url)
        return FakeResponse(self.payload)


def test_search_query_joins_team_names():
    assert search_query("Brann", "Viking") == "Brann Viking"


def test_fetch_coolbet_events_uses_search_url_and_flattens():
    client = FakeClient({"matches": [{"id": "9", "name": "Brann - Viking"}]})
    events = fetch_coolbet_events("Brann", "Viking", client=client)
    assert events[0]["id"] == "9"
    assert "s/sbgate/sports/search" in client.urls[0]
    assert "Brann" in client.urls[0]


def test_fetch_coolbet_events_returns_empty_on_http_error():
    class Boom:
        def get(self, url, timeout=10.0, headers=None):
            raise RuntimeError("network")

    assert fetch_coolbet_events("Brann", "Viking", client=Boom()) == []


from coolbet_odds import enrich_fixtures, markets_payload


def test_enrich_fixtures_calls_search_once_per_fixture():
    fixture = {
        "fixture_id": "fix-1",
        "home_team_name": "Brann",
        "away_team_name": "Viking",
        "event_date": "2026-09-06",
    }
    event = {
        "id": "cb-1",
        "name": "Brann - Viking",
        "start_date": "2026-09-06T16:00:00Z",
        "markets": [
            {
                "name": "Match Result (1X2)",
                "outcomes": [
                    {"name": "1", "odds": 1.9},
                    {"name": "X", "odds": 3.5},
                    {"name": "2", "odds": 4.0},
                ],
            }
        ],
    }

    def fake_fetch(home, away, client=None):
        assert home == "Brann"
        return [event]

    out = enrich_fixtures([fixture], fetch_events=fake_fetch)
    assert out[0]["coolbet_event_id"] == "cb-1"
    assert out[0]["odds_1x2"]["home"] == 1.9


def test_markets_payload_uses_cached_event_or_empty():
    event = {
        "id": "cb-1",
        "markets": [
            {
                "name": "Both Teams to Score",
                "outcomes": [{"name": "Yes", "odds": 1.8}, {"name": "No", "odds": 1.95}],
            }
        ],
    }
    payload = markets_payload({"coolbet_event_id": "cb-1"}, event)
    assert payload["missing"] is False
    assert payload["markets"][0]["key"] == "btts"
    empty = markets_payload({"coolbet_event_id": None}, None)
    assert empty["missing"] is True
    assert empty["markets"] == []
