from collections import OrderedDict
import time
from typing import Any, Optional, Tuple


class TtlLruCache:
    def __init__(self, maxsize: int = 512, ttl_seconds: float = 86_400):
        self.maxsize = maxsize
        self.ttl_seconds = ttl_seconds
        self._data: OrderedDict[str, Tuple[Any, float]] = OrderedDict()

    def get(self, key: str) -> Tuple[Any, bool]:
        item = self._data.get(key)
        if item is None:
            return None, False
        value, expires_at = item
        if expires_at < time.monotonic():
            self._data.pop(key, None)
            return None, False
        self._data.move_to_end(key)
        return value, True

    def set(self, key: str, value: Any) -> None:
        self._data[key] = (value, time.monotonic() + self.ttl_seconds)
        self._data.move_to_end(key)
        while len(self._data) > self.maxsize:
            self._data.popitem(last=False)

    def pop(self, key: str) -> None:
        self._data.pop(key, None)

    def clear(self) -> None:
        self._data.clear()


class SessionCache:
    def __init__(self, ttl_seconds: float = 15):
        self.ttl_seconds = ttl_seconds
        self._data: dict[str, Tuple[str, float]] = {}

    def get(self, token: str) -> Optional[str]:
        item = self._data.get(token)
        if item is None:
            return None
        user_id, expires_at = item
        if expires_at < time.monotonic():
            self._data.pop(token, None)
            return None
        return user_id

    def set(self, token: str, user_id: str) -> None:
        self._data[token] = (user_id, time.monotonic() + self.ttl_seconds)

    def pop(self, token: str) -> None:
        self._data.pop(token, None)
