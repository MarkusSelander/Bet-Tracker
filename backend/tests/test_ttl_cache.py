import time

from ttl_cache import SessionCache, TtlLruCache


def test_ttl_lru_evicts_oldest_and_expired_entries():
    cache = TtlLruCache(maxsize=2, ttl_seconds=10)
    cache.set("a", 1)
    cache.set("b", 2)
    cache.set("c", 3)

    value, hit = cache.get("a")
    assert hit is False
    assert cache.get("b") == (2, True)
    assert cache.get("c") == (3, True)

    cache._data["b"] = (2, time.monotonic() - 1)
    value, hit = cache.get("b")
    assert hit is False
    assert value is None


def test_session_cache_expires_and_can_be_popped():
    cache = SessionCache(ttl_seconds=10)
    cache.set("token", "user_1")
    assert cache.get("token") == "user_1"
    cache.pop("token")
    assert cache.get("token") is None

    cache.set("token", "user_1")
    cache._data["token"] = ("user_1", time.monotonic() - 1)
    assert cache.get("token") is None
