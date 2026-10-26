import re
from typing import Any, Dict, Iterable, Optional, Set

CHROME_EXTENSION_ORIGIN_RE = r"^chrome-extension://[a-z]{32}$"

HISTORY_PATH = "/s/sbgate/bets/history"
TICKET_STATUS = "all,WON,LOST,CONFIRMED,CANCELLED,PUSHED,PARTIALLY_WON,VOIDED,CASHED,PENDING"
PAGE_SIZE = 50
OPEN_STATUSES = {"PENDING", "CONFIRMED"}
COMBO_TYPES = {"combo", "system", "betbuilder"}
DIRECT_FETCH_LIMIT = 100


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


def _is_numeric_display_id(value: Any) -> bool:
    if value is None or value == "":
        return False
    return str(value).isdigit()


def ticket_detail_paths(ticket_id: str, display_id: Optional[Any] = None) -> list:
    if ticket_id is None or ticket_id == "":
        return []
    if _is_numeric_display_id(ticket_id):
        return []
    tid = str(ticket_id)
    query = "language=eu&layout=EUROPEAN"
    return [f"/s/sbgate/bets/tickets/{tid}?{query}&ticketId={tid}"]


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


def direct_ticket_ids(
    seen_ids: Optional[Iterable[str]] = None,
    pending_ids: Optional[Iterable[str]] = None,
    incomplete_ids: Optional[Iterable[str]] = None,
    limit: Optional[int] = None,
) -> Dict[str, Any]:
    """Pending and incomplete ids missing from the history pages already read."""
    seen = set(seen_ids or [])
    cap = DIRECT_FETCH_LIMIT if limit is None else limit
    if cap < 0:
        cap = 0
    wanted: list = []
    queued = set()

    def push(ticket_id: Any) -> None:
        if ticket_id is None or ticket_id == "":
            return
        if ticket_id in queued or ticket_id in seen or _is_numeric_display_id(ticket_id):
            return
        queued.add(ticket_id)
        wanted.append(ticket_id)

    for ticket_id in list(pending_ids or []):
        push(ticket_id)
    for ticket_id in list(incomplete_ids or []):
        push(ticket_id)
    return {"ids": wanted[:cap], "deferred": max(0, len(wanted) - cap)}


def tickets_needing_details(
    tickets: Iterable[Dict[str, Any]],
    known_ids: Optional[Set[str]] = None,
    pending_ids: Optional[Set[str]] = None,
    incomplete_ids: Optional[Set[str]] = None,
    skip_ids: Optional[Iterable[str]] = None,
) -> list:
    skip = set(skip_ids or [])
    selected = tickets_to_import(tickets, known_ids, pending_ids, incomplete_ids)
    return [
        ticket
        for ticket in selected
        if ticket.get("id")
        and ticket.get("id") not in skip
        and should_fetch_ticket_details(ticket, known_ids, pending_ids, incomplete_ids)
    ]


def ticket_from_direct_response(ticket_id: str, detail: Any) -> Dict[str, Any]:
    if isinstance(detail, list):
        return merge_ticket_details({"id": ticket_id}, detail)
    flat = detail if isinstance(detail, dict) else {}
    nested = flat.get("ticket") if isinstance(flat.get("ticket"), dict) else {}
    base = {**flat, **nested, "id": nested.get("id") or flat.get("id") or ticket_id}
    return merge_ticket_details(base, detail)


def should_stop_pagination(
    tickets: Iterable[Dict[str, Any]],
    has_next_page: bool,
    known_ids: Optional[Set[str]] = None,
    pending_ids: Optional[Set[str]] = None,
    incomplete_ids: Optional[Set[str]] = None,
    full_history: bool = False,
) -> bool:
    tickets = list(tickets)
    if not has_next_page or len(tickets) == 0:
        return True
    if full_history:
        return False
    if not known_ids:
        return False
    last = tickets[-1]
    return bool(last.get("id") and last.get("id") in known_ids)


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
    if isinstance(bet.get("incomplete"), bool):
        return bool(bet["incomplete"])
    total = int(bet.get("total_matches") or 1)
    ticket_type = str(bet.get("ticket_type") or "").lower()
    if total <= 1 and ticket_type not in COMBO_TYPES:
        return False
    return _stored_bet_leg_count(bet) < max(total, 2)


def collect_incomplete_ids_from_bets(bets: Iterable[Dict[str, Any]]) -> list:
    return [bet["source_id"] for bet in bets if is_incomplete_stored_bet(bet)]


def should_fetch_ticket_details(
    ticket: Dict[str, Any],
    known_ids: Optional[Set[str]] = None,
    pending_ids: Optional[Set[str]] = None,
    incomplete_ids: Optional[Set[str]] = None,
) -> bool:
    if not needs_ticket_details(ticket):
        return False
    ticket_id = ticket.get("id")
    if incomplete_ids and ticket_id in incomplete_ids:
        return True
    if not known_ids:
        return True
    if ticket_id not in known_ids:
        return True
    return False


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
