import asyncio
import os

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "test_startup")

from unittest.mock import patch

import server


def test_startup_does_not_wait_for_index_build(monkeypatch):
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
    started = asyncio.Event()

    async def slow_indexes():
        started.set()
        await asyncio.sleep(60)

    async def run():
        with patch("server.ensure_indexes", slow_indexes):
            await asyncio.wait_for(server.start_index_build(), timeout=1)
            await asyncio.wait_for(started.wait(), timeout=1)
            task = server.app.state.index_task
            assert not task.done()
            task.cancel()

    asyncio.run(run())
