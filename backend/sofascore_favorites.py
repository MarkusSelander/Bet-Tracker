"""Favoritter mot SofaScore: søk og dagens kamper, uten å laste ned historikk."""

from __future__ import annotations

import asyncio
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Optional

from ttl_cache import TtlLruCache

_VENDOR = Path(__file__).resolve().parent / "vendor" / "sofascore_scraper"
if _VENDOR.is_dir() and str(_VENDOR) not in sys.path:
    sys.path.insert(0, str(_VENDOR))

DATA_DIR = Path(__file__).resolve().parent / "sofascore-data"
ALLOWED_SPORTS = ("football", "tennis")
ALLOWED_KINDS = ("team", "player")
SEARCH_LIMIT = 20
CACHE_TTL_SECONDS = 180


class SofaScoreError(Exception):
    def __init__(self, message: str = "SofaScore utilgjengelig"):
        super().__init__(message)
        self.message = message


def normalize_favorite(body: dict) -> dict:
    try:
        sofascore_id = int(body.get("sofascore_id"))
    except (TypeError, ValueError):
        raise ValueError("Ugyldig id") from None
    if sofascore_id <= 0:
        raise ValueError("Ugyldig id")

    kind = body.get("kind")
    sport = body.get("sport")
    name = (body.get("name") or "").strip()
    if sport not in ALLOWED_SPORTS:
        raise ValueError("Ugyldig sport")
    if kind not in ALLOWED_KINDS:
        raise ValueError("Ugyldig type")
    if sport == "football" and kind != "team":
        raise ValueError("Fotballfavoritter må være lag")
    if not name:
        raise ValueError("Navn mangler")

    doc = {
        "sofascore_id": sofascore_id,
        "kind": kind,
        "name": name,
        "sport": sport,
    }
    team_id = body.get("team_id")
    if team_id is not None and team_id != "":
        try:
            team_id = int(team_id)
        except (TypeError, ValueError):
            raise ValueError("Ugyldig id") from None
        if team_id <= 0:
            raise ValueError("Ugyldig id")
        doc["team_id"] = team_id
    elif kind == "team":
        doc["team_id"] = sofascore_id
    return doc


def public_team(row: dict) -> dict:
    team = {
        "sofascore_id": int(row["sofascore_id"]),
        "kind": row.get("kind") or "team",
        "name": row.get("name") or "",
        "sport": row.get("sport") or "",
    }
    if row.get("team_id") is not None:
        team["team_id"] = int(row["team_id"])
    return team


def _sport_slug(entity: dict, kind: str) -> Optional[str]:
    if kind == "player":
        team = entity.get("team") or {}
        return ((team.get("sport") or {}).get("slug")) or ((entity.get("sport") or {}).get("slug"))
    return (entity.get("sport") or {}).get("slug")


def search_hits(payload: Any) -> list[dict]:
    hits = []
    seen = set()
    results = payload.get("results") if isinstance(payload, dict) else None
    for row in results or []:
        if not isinstance(row, dict):
            continue
        kind = row.get("type")
        entity = row.get("entity") or {}
        if kind not in ALLOWED_KINDS or not isinstance(entity, dict):
            continue
        sport = _sport_slug(entity, kind)
        if sport not in ALLOWED_SPORTS:
            continue
        if sport == "football" and kind != "team":
            continue
        if kind == "player" and sport != "tennis":
            continue
        try:
            sofascore_id = int(entity["id"])
        except (KeyError, TypeError, ValueError):
            continue
        name = (entity.get("name") or "").strip()
        if not name or sofascore_id <= 0:
            continue
        team_id = sofascore_id if kind == "team" else None
        if kind == "player":
            raw_team = (entity.get("team") or {}).get("id")
            try:
                parsed = int(raw_team)
            except (TypeError, ValueError):
                parsed = None
            if parsed and parsed > 0:
                team_id = parsed
        key = (sofascore_id, kind)
        if key in seen:
            continue
        seen.add(key)
        hit = {
            "sofascore_id": sofascore_id,
            "kind": kind,
            "name": name,
            "sport": sport,
        }
        if team_id is not None:
            hit["team_id"] = team_id
        hits.append(hit)
        if len(hits) >= SEARCH_LIMIT:
            break
    return hits


def _int_id(value: Any) -> Optional[int]:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def _events(payload: Any) -> list:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get("events"), list):
        return payload["events"]
    return []


def _participant_ids(event: dict) -> set[int]:
    ids = set()
    for side in ("homeTeam", "awayTeam"):
        team = event.get(side) or {}
        if not isinstance(team, dict):
            continue
        parsed = _int_id(team.get("id"))
        if parsed is not None:
            ids.add(parsed)
        for sub in team.get("subTeams") or []:
            if isinstance(sub, dict):
                sub_id = _int_id(sub.get("id"))
                if sub_id is not None:
                    ids.add(sub_id)
    return ids


def _favorite_ids(favorites: list[dict]) -> set[int]:
    ids = set()
    for favorite in favorites:
        for key in ("team_id", "sofascore_id"):
            parsed = _int_id(favorite.get(key))
            if parsed is not None:
                ids.add(parsed)
    return ids


def _event_sport(event: dict) -> Optional[str]:
    tournament = event.get("tournament") or {}
    category = tournament.get("category") if isinstance(tournament, dict) else {}
    slug = ((category or {}).get("sport") or {}).get("slug")
    if slug:
        return slug
    for side in ("homeTeam", "awayTeam"):
        team = event.get(side) or {}
        if isinstance(team, dict):
            side_slug = (team.get("sport") or {}).get("slug")
            if side_slug:
                return side_slug
    return None


def _score(block: Any):
    if not isinstance(block, dict) or block.get("current") is None:
        return None
    return block["current"]


def _view(event: dict, today: date, favorite_ids: set[int]) -> Optional[dict]:
    event_id = _int_id(event.get("id"))
    if event_id is None:
        return None
    sport = _event_sport(event)
    if sport not in ALLOWED_SPORTS:
        return None
    timestamp = event.get("startTimestamp")
    if not isinstance(timestamp, (int, float)):
        return None
    if datetime.fromtimestamp(timestamp).date() != today:
        return None
    if not (_participant_ids(event) & favorite_ids):
        return None
    status = event.get("status") or {}
    tournament = event.get("tournament") if isinstance(event.get("tournament"), dict) else {}
    unique = tournament.get("uniqueTournament") if isinstance(tournament.get("uniqueTournament"), dict) else {}
    return {
        "id": event_id,
        "sport": sport,
        "start": datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat(),
        "home": (event.get("homeTeam") or {}).get("name") or "",
        "away": (event.get("awayTeam") or {}).get("name") or "",
        "tournament": (unique or {}).get("name") or tournament.get("name") or "",
        "status": status.get("type") or "",
        "status_label": status.get("description") or "",
        "home_score": _score(event.get("homeScore")),
        "away_score": _score(event.get("awayScore")),
    }


def today_matches(favorites: list[dict], next_payloads, live_payloads, today: date) -> list[dict]:
    favorite_ids = _favorite_ids(favorites)
    merged = {}
    for payload in list(next_payloads or []) + list(live_payloads or []):
        for event in _events(payload):
            if not isinstance(event, dict):
                continue
            view = _view(event, today, favorite_ids)
            if view:
                merged[view["id"]] = view
    return sorted(merged.values(), key=lambda row: (row["start"], row["id"]))


def _schedule_id(favorite: dict) -> Optional[int]:
    return _int_id(favorite.get("team_id")) or _int_id(favorite.get("sofascore_id"))


class SofaScoreGateway:
    """Én gjenbrukt klient. Tester sender inn en klient og unngår nettleseren."""

    def __init__(self, client=None, cache: Optional[TtlLruCache] = None):
        self._client = client
        self.cache = cache or TtlLruCache(maxsize=256, ttl_seconds=CACHE_TTL_SECONDS)

    def _ensure_client(self):
        if self._client is None:
            os.environ.setdefault("SOFASCORE_CLIENT__BROWSER_PROFILE", str(DATA_DIR / "chrome_profile"))
            os.environ.setdefault("SOFASCORE_STORAGE__DATA_DIR", str(DATA_DIR))
            from sofascore_scraper.client import Client

            self._client = Client()
        return self._client

    async def get(self, path: str):
        cached, hit = self.cache.get(path)
        if hit:
            return cached
        from sofascore_scraper.slices import SLICE_EMPTY, SLICE_OK

        outcome = await self._ensure_client().get(path)
        if outcome.status == SLICE_OK:
            data = outcome.data if outcome.data is not None else {}
            self.cache.set(path, data)
            return data
        if outcome.status == SLICE_EMPTY:
            self.cache.set(path, {})
            return {}
        raise SofaScoreError("SofaScore utilgjengelig")


async def search_favorites(gateway: SofaScoreGateway, query: str) -> list[dict]:
    needle = (query or "").strip()
    if not needle:
        return []
    from sofascore_scraper.client.endpoints import search_all

    payload = await gateway.get(search_all(needle, 0))
    return search_hits(payload)


async def load_today(gateway: SofaScoreGateway, favorites: list[dict], today: Optional[date] = None) -> list[dict]:
    favorites = [row for row in favorites if _int_id(row.get("sofascore_id"))]
    if not favorites:
        return []
    today = today or datetime.now().astimezone().date()
    from sofascore_scraper.client import endpoints

    team_ids = []
    seen_teams = set()
    sports = []
    seen_sports = set()
    for favorite in favorites:
        schedule_id = _schedule_id(favorite)
        if schedule_id is not None and schedule_id not in seen_teams:
            seen_teams.add(schedule_id)
            team_ids.append(schedule_id)
        sport = favorite.get("sport")
        if sport in ALLOWED_SPORTS and sport not in seen_sports:
            seen_sports.add(sport)
            sports.append(sport)

    next_payloads = await asyncio.gather(
        *[gateway.get(endpoints.team_events_page(team_id, "next", 0)) for team_id in team_ids]
    )
    live_payloads = await asyncio.gather(
        *[gateway.get(endpoints.live_events(sport)) for sport in sports]
    )
    return today_matches(favorites, next_payloads, live_payloads, today)
