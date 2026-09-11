import asyncio

import pytest

from odds_client import OddsApiError, OddsClient


def test_cache_hit_does_not_call_http_again():
    calls = []

    async def http_get(url, params):
        calls.append((url, params))
        return [{"id": "1"}]

    async def scenario():
        client = OddsClient(api_key="test-key", http_get=http_get, now=lambda: 1_000.0)
        first = await client.get_json("/sports/soccer_epl/odds", {"regions": "eu"}, ttl_seconds=180)
        client.now = lambda: 1_100.0
        second = await client.get_json("/sports/soccer_epl/odds", {"regions": "eu"}, ttl_seconds=180)
        assert first == second == [{"id": "1"}]
        assert len(calls) == 1

    asyncio.run(scenario())


def test_missing_key_raises_503():
    async def scenario():
        client = OddsClient(api_key="", http_get=lambda url, params: None)
        with pytest.raises(OddsApiError) as exc:
            await client.get_json("/sports", {})
        assert exc.value.status_code == 503

    asyncio.run(scenario())


def test_http_error_without_cache_raises_502():
    async def http_get(url, params):
        raise RuntimeError("down")

    async def scenario():
        client = OddsClient(api_key="test-key", http_get=http_get)
        with pytest.raises(OddsApiError) as exc:
            await client.get_json("/sports/soccer_epl/odds", {})
        assert exc.value.status_code == 502

    asyncio.run(scenario())


def test_odds_error_from_http_status_maps_quota_and_auth():
    from odds_client import odds_error_from_http_status

    quota = odds_error_from_http_status(429)
    assert quota.status_code == 429
    assert "429" in quota.detail

    auth = odds_error_from_http_status(401)
    assert "401" in auth.detail

    down = odds_error_from_http_status(500)
    assert down.status_code == 502
    assert "500" in down.detail


def test_preferred_odds_fetch_error_prefers_429():
    from odds_client import preferred_odds_fetch_error

    err = preferred_odds_fetch_error([
        OddsApiError(502, "Odds API utilgjengelig (500)"),
        OddsApiError(429, "Odds API-kvote brukt opp (429)"),
    ])
    assert err.status_code == 429
    assert "429" in err.detail


def test_cache_hit_survives_later_http_failure():
    calls = []

    async def http_get(url, params):
        calls.append(url)
        if len(calls) == 1:
            return [{"id": "1"}]
        raise OddsApiError(429, "Odds API-kvote brukt opp (429)")

    async def scenario():
        client = OddsClient(api_key="test-key", http_get=http_get, now=lambda: 1_000.0)
        first = await client.get_json("/sports/soccer_epl/odds", {"regions": "eu"}, ttl_seconds=180)
        client.now = lambda: 1_100.0
        second = await client.get_json("/sports/soccer_epl/odds", {"regions": "eu"}, ttl_seconds=180)
        assert first == second == [{"id": "1"}]
        assert len(calls) == 1

    asyncio.run(scenario())


def test_http_429_without_cache_keeps_429():
    async def http_get(url, params):
        raise OddsApiError(429, "Odds API-kvote brukt opp (429)")

    async def scenario():
        client = OddsClient(api_key="test-key", http_get=http_get)
        with pytest.raises(OddsApiError) as exc:
            await client.get_json("/sports/soccer_epl/odds", {})
        assert exc.value.status_code == 429
        assert "429" in exc.value.detail

    asyncio.run(scenario())
