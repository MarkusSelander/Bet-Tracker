from datetime import datetime, timezone
from typing import Any, Optional


def as_utc(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, str):
        text = value.replace("Z", "+00:00")
        value = datetime.fromisoformat(text)
    if not isinstance(value, datetime):
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def is_cache_fresh(expires_at: Any, now: Optional[datetime] = None) -> bool:
    expires = as_utc(expires_at)
    if expires is None:
        return False
    current = as_utc(now) or datetime.now(timezone.utc)
    return expires > current
