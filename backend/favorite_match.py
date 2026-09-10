import re
from typing import Any, Dict, Iterable, List


def normalize_name(value: Any) -> str:
    text = str(value or "").lower()
    text = text.replace("–", " ").replace("-", " ").replace("vs", " ")
    text = re.sub(r"[^a-z0-9æøåäöüéèê]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _bet_text(bet: Dict[str, Any]) -> str:
    parts = [bet.get("game") or ""]
    for leg in bet.get("legs") or []:
        if isinstance(leg, dict):
            parts.append(leg.get("match") or "")
    return normalize_name(" ".join(parts))


def fixture_matches_bet(fixture: Dict[str, Any], bet: Dict[str, Any]) -> bool:
    home = normalize_name(fixture.get("home_team_name"))
    away = normalize_name(fixture.get("away_team_name"))
    if not home or not away:
        return False
    blob = _bet_text(bet)
    return home in blob and away in blob


def attach_linked_bets(fixtures: Iterable[Dict[str, Any]], bets: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    bet_list = [bet for bet in bets or [] if isinstance(bet, dict)]
    attached = []
    for fixture in fixtures or []:
        if not isinstance(fixture, dict):
            continue
        hits = []
        for bet in bet_list:
            if fixture_matches_bet(fixture, bet):
                hits.append(
                    {
                        "bet_id": bet.get("bet_id"),
                        "status": bet.get("status"),
                        "odds": bet.get("odds"),
                    }
                )
        attached.append({**fixture, "linked_bets": hits, "has_bet": bool(hits)})
    return attached
