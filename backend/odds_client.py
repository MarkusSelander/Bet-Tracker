import time
from urllib.parse import urlencode

import httpx


TTL_SPORTS = 12 * 60 * 60
TTL_SCORES = 2 * 60
TTL_ODDS = 3 * 60
TTL_MARKETS = 3 * 60


class OddsApiError(Exception):
    def __init__(self, status_code, detail):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


async def default_http_get(url, params):
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url, params=params)
        if response.status_code >= 400:
            raise OddsApiError(502, "Odds API utilgjengelig")
        return response.json()


class OddsClient:
    BASE = "https://api.the-odds-api.com/v4"

    def __init__(self, api_key, http_get=None, now=None):
        self.api_key = api_key or ""
        self.http_get = http_get or default_http_get
        self.now = now or time.time
        self._cache = {}

    def _key(self, path, params):
        items = sorted((params or {}).items())
        return path + "?" + urlencode(items)

    async def get_json(self, path, params=None, ttl_seconds=180):
        if not self.api_key:
            raise OddsApiError(503, "Odds API-nøkkel mangler")
        params = dict(params or {})
        params.setdefault("apiKey", self.api_key)
        cache_key = self._key(path, {k: v for k, v in params.items() if k != "apiKey"})
        hit = self._cache.get(cache_key)
        now = self.now()
        if hit and hit["expires_at"] > now:
            return hit["payload"]
        try:
            payload = await self.http_get(f"{self.BASE}{path}", params)
        except OddsApiError:
            raise
        except Exception as exc:
            if hit:
                return hit["payload"]
            raise OddsApiError(502, "Odds API utilgjengelig") from exc
        self._cache[cache_key] = {"payload": payload, "expires_at": now + ttl_seconds}
        return payload
