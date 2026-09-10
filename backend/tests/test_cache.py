from datetime import datetime, timedelta, timezone

from dates import is_cache_fresh


def test_cache_is_fresh_when_mongo_returns_naive_utc():
    now = datetime(2026, 9, 5, 12, 0, tzinfo=timezone.utc)
    expires = datetime(2026, 9, 6, 12, 0)

    assert is_cache_fresh(expires, now) is True


def test_cache_is_stale_when_naive_expiry_is_in_the_past():
    now = datetime(2026, 9, 5, 12, 0, tzinfo=timezone.utc)
    expires = datetime(2026, 9, 4, 12, 0)

    assert is_cache_fresh(expires, now) is False


def test_cache_is_fresh_for_aware_expiry():
    now = datetime(2026, 9, 5, 12, 0, tzinfo=timezone.utc)
    expires = now + timedelta(hours=1)

    assert is_cache_fresh(expires, now) is True
