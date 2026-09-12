import re
from typing import Any, Dict, Iterable, Optional, Set

CHROME_EXTENSION_ORIGIN_RE = r"^chrome-extension://[a-z]{32}$"

HISTORY_PATH = "/s/sbgate/bets/history"
TICKET_STATUS = "all,WON,LOST,CONFIRMED,CANCELLED,PUSHED,PARTIALLY_WON,VOIDED,CASHED,PENDING"
PAGE_SIZE = 50
OPEN_STATUSES = {"PENDING", "CONFIRMED"}
COMBO_TYPES = {"combo", "system", "betbuilder"}


def history_query(page_number: int = 1) -> Dict[str, Any]:
    return {
        "isCampaign": "false",
        "isCashout": "true",
        "language": "eu",
        "layout": "EUROPEAN",
        "pageNumber": page_number,
        "pageSize": PAGE_SIZE,
        "ticketStatus": TICKET_STATUS,
    }


def ticket_detail_paths(ticket_id: str, display_id: Optional[Any] = None) -> list:
    query = "language=eu&layout=EUROPEAN"
    ids = [str(ticket_id)]
    if display_id is not None and str(display_id) not in ids:
        ids.append(str(display_id))
    paths = []
    for tid in ids:
        paths.extend(
            [
                f"/s/sbgate/bets/tickets/{tid}?{query}&ticketId={tid}",
                f"/s/sbgate/bets/{tid}?{query}",
                f"/s/sbgate/bets/ticket/{tid}?{query}",
            ]
        )
    return paths


def _stored_leg_count(ticket: Dict[str, Any]) -> int:
    for key in ("uniqueSelections", "unique_selections", "matches", "legs"):
        value = ticket.get(key)
        if isinstance(value, list) and value:
            return len(value)
    bets = ticket.get("bets")
    if isinstance(bets, list):
        count = 0
        for bet in bets:
            if not isinstance(bet, dict):
                continue
            for key in ("matches", "legs", "selections"):
                value = bet.get(key)
                if isinstance(value, list) and value:
                    count += len(value)
        if count:
            return count
    return 0


def needs_ticket_details(ticket: Dict[str, Any]) -> bool:
    if not ticket.get("id"):
        return False
    total = int(ticket.get("total_matches") or 1)
    ticket_type = str(ticket.get("ticket_type") or "").lower()
    if total <= 1 and ticket_type not in COMBO_TYPES:
        return False
    stored = _stored_leg_count(ticket)
    return stored < max(total, 2)


def unwrap_ticket_payload(detail: Any) -> Dict[str, Any]:
    if isinstance(detail, list):
        return {"matches": [item for item in detail if isinstance(item, dict)]}
    if not isinstance(detail, dict):
        return {}

    candidates = [detail]
    for key in ("ticket", "data", "result", "bet"):
        nested = detail.get(key)
        if isinstance(nested, dict):
            candidates.append(nested)
        elif isinstance(nested, list) and nested:
            return {"matches": [item for item in nested if isinstance(item, dict)]}

    for candidate in candidates:
        if any(
            isinstance(candidate.get(key), list) and candidate.get(key)
            for key in (
                "uniqueSelections",
                "unique_selections",
                "matches",
                "bets",
                "legs",
                "selections",
            )
        ):
            return candidate
    return detail


def merge_ticket_details(ticket: Dict[str, Any], detail: Any) -> Dict[str, Any]:
    payload = unwrap_ticket_payload(detail)
    merged = {**ticket}
    for key in ("matches", "bets", "legs", "uniqueSelections", "unique_selections"):
        if payload.get(key):
            merged[key] = payload[key]
    if payload.get("selections") and not merged.get("matches"):
        merged["matches"] = payload["selections"]
    return merged


def import_url(api_base: str) -> str:
    return api_base.rstrip("/") + "/api/bets/import/coolbet"


def auth_headers(token: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def login_payload(user_doc: Dict[str, Any], session_token: str) -> Dict[str, Any]:
    return {**user_doc, "session_token": session_token}


def resolve_last_coolbet_sync_at(
    user_doc: Optional[Dict[str, Any]],
    latest_bet_created_at: Optional[Any] = None,
) -> Optional[Any]:
    if user_doc:
        stored = user_doc.get("last_coolbet_sync_at")
        if stored:
            return stored
    return latest_bet_created_at


def should_stop_pagination(
    tickets: Iterable[Dict[str, Any]],
    has_next_page: bool,
    known_ids: Optional[Set[str]] = None,
    pending_ids: Optional[Set[str]] = None,
    incomplete_ids: Optional[Set[str]] = None,
) -> bool:
    tickets = list(tickets)
    if not has_next_page or len(tickets) == 0:
        return True
    if pending_ids:
        return False
    if incomplete_ids:
        return False
    if not known_ids:
        return False
    if not all(ticket.get("id") in known_ids for ticket in tickets):
        return False
    if any(str(ticket.get("status") or "").upper() in OPEN_STATUSES for ticket in tickets):
        return False
    return True


def _stored_bet_leg_count(bet: Dict[str, Any]) -> int:
    if bet.get("legs_count") is not None:
        try:
            return int(bet["legs_count"])
        except (TypeError, ValueError):
            pass
    legs = bet.get("legs")
    if isinstance(legs, list):
        return len(legs)
    return 0


def is_incomplete_stored_bet(bet: Dict[str, Any]) -> bool:
    if not bet.get("source_id"):
        return False
    total = int(bet.get("total_matches") or 1)
    ticket_type = str(bet.get("ticket_type") or "").lower()
    if total <= 1 and ticket_type not in COMBO_TYPES:
        return False
    return _stored_bet_leg_count(bet) < max(total, 2)


def collect_incomplete_ids_from_bets(bets: Iterable[Dict[str, Any]]) -> list:
    return [bet["source_id"] for bet in bets if is_incomplete_stored_bet(bet)]


def tickets_to_import(
    tickets: Iterable[Dict[str, Any]],
    known_ids: Optional[Set[str]] = None,
    pending_ids: Optional[Set[str]] = None,
    incomplete_ids: Optional[Set[str]] = None,
) -> list:
    tickets = list(tickets)
    if not known_ids:
        return tickets
    pending_ids = pending_ids or set()
    incomplete_ids = incomplete_ids or set()
    return [
        ticket
        for ticket in tickets
        if ticket.get("id") not in known_ids
        or str(ticket.get("status") or "").upper() in OPEN_STATUSES
        or ticket.get("id") in pending_ids
        or ticket.get("id") in incomplete_ids
    ]
