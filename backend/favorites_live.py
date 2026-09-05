"""Disconnected live feed for Favoritter. Team CRUD stays in server.py."""


def search_teams(_query: str, sport=None):
    return []


def upcoming_matches_grouped(_team_ids=None, days=7):
    return {}


def match_markets(_fixture_id: str):
    return {"markets": [], "missing": True}
