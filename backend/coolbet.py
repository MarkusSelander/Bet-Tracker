from datetime import datetime, timezone
from typing import Any, Dict, Optional

SPORT_ALIASES = {
    "fotball": "Football",
    "soccer": "Football",
    "ishockey": "Ice Hockey",
    "esport": "Esports",
    "håndball": "Handball",
    "handball": "Handball",
    "amerikansk fotball": "American Football",
}


def normalize_sport(name: Optional[str]) -> Optional[str]:
    if not name:
        return None
    return SPORT_ALIASES.get(name.strip().lower(), name.strip())


def _parse_created_at(value: Optional[str]) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    return datetime.fromisoformat(value)


def _cashout_amount(ticket: Dict[str, Any]) -> Optional[float]:
    amount = ticket.get("cashout_amount")
    if amount is None:
        amount = ticket.get("cashoutAmount")
    return float(amount) if amount is not None else None


def map_status(ticket: Dict[str, Any]) -> str:
    if ticket.get("cashout_status") == "CONFIRMED" or ticket.get("status") == "CASHED":
        return "cashed"

    status = (ticket.get("status") or "").upper()
    mapping = {
        "WON": "won",
        "LOST": "lost",
        "PENDING": "pending",
        "PUSHED": "push",
        "CANCELLED": "push",
        "VOIDED": "push",
        "PARTIALLY_WON": "won",
    }
    return mapping.get(status, "pending")


def calculate_result(ticket: Dict[str, Any], status: str) -> float:
    stake = float(ticket.get("total_stake") or 0)
    if status == "lost":
        return round(-stake, 2)
    if status in ("pending", "push"):
        return 0.0
    if status == "cashed":
        cashout = _cashout_amount(ticket) or 0
        return round(cashout - stake, 2)

    payout = ticket.get("remaining_max_win")
    if payout is None:
        payout = ticket.get("max_win") or 0
    return round(float(payout) - stake, 2)


def map_coolbet_ticket(ticket: Dict[str, Any]) -> Dict[str, Any]:
    first_match = ticket.get("first_match") or {}
    created = _parse_created_at(ticket.get("created_at"))
    status = map_status(ticket)
    total_matches = int(ticket.get("total_matches") or 1)
    game = first_match.get("match_name") or "Unknown"
    if total_matches > 1:
        extra = total_matches - 1
        game = f"{game} (+{extra})"

    market = first_match.get("market_name") or ""
    outcome = first_match.get("outcome_name") or ""
    bet_label = " · ".join(part for part in (market, outcome) if part) or "Unknown"

    odds = ticket.get("first_bet_odds")
    if not odds:
        stake = float(ticket.get("total_stake") or 0)
        max_win = float(ticket.get("max_win") or 0)
        odds = (max_win / stake) if stake and max_win else 1.0

    return {
        "source_id": ticket.get("id"),
        "display_id": ticket.get("display_id"),
        "date": created.strftime("%Y-%m-%d"),
        "time": created.strftime("%H:%M:%S"),
        "game": game,
        "bet": bet_label,
        "stake": float(ticket.get("total_stake") or 0),
        "odds": round(float(odds), 4),
        "status": status,
        "result": calculate_result(ticket, status),
        "bookie": "Coolbet",
        "sport": normalize_sport(first_match.get("sport_name")),
        "league": first_match.get("league_name"),
        "ticket_type": ticket.get("ticket_type"),
        "product": ticket.get("product"),
        "total_matches": total_matches,
        "expected_result_date": ticket.get("expected_result_date"),
        "cashout_amount": _cashout_amount(ticket),
    }
