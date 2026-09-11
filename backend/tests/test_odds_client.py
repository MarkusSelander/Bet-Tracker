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
