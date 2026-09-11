import time
from urllib.parse import urlencode

import httpx


TTL_SPORTS = 12 * 60 * 60
TTL_SCORES = 2 * 60
TTL_ODDS = 3 * 60
TTL_MARKETS = 3 * 60
HTTP_TIMEOUT = httpx.Timeout(8.0, connect=5.0)


class OddsApiError(Exception):
    def __init__(self, status_code, detail):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def odds_error_from_http_status(status_code):
    if status_code == 429:
        return OddsApiError(429, "Odds API-kvote brukt opp (429)")
    if status_code in (401, 403):
        return OddsApiError(502, f"Odds API avvist ({status_code})")
    return OddsApiError(502, f"Odds API utilgjengelig ({status_code})")


def preferred_odds_fetch_error(errors):
    if not errors:
        return OddsApiError(502, "Odds API utilgjengelig")
    for err in errors:
        if err.status_code == 429:
            return err
    for err in errors:
        if err.status_code in (401, 403):
            return err
    err = errors[0]
    if err.status_code in (401, 403, 429, 502, 503) and err.detail:
        return err
    return OddsApiError(502, err.detail or "Odds API utilgjengelig")


async def default_http_get(url, params):
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            response = await client.get(url, params=params)
    except httpx.TimeoutException as exc:
        raise OddsApiError(502, "Odds API utilgjengelig (timeout)") from exc
    except httpx.HTTPError as exc:
        raise OddsApiError(502, "Odds API utilgjengelig") from exc
    if response.status_code >= 400:
        raise odds_error_from_http_status(response.status_code)
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
