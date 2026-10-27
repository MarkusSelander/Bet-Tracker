import re
from typing import Any, Dict, Iterable, Optional, Set

CHROME_EXTENSION_ORIGIN_RE = r"^chrome-extension://[a-z]{32}$"

HISTORY_PATH = "/s/sbgate/bets/history"
TICKET_STATUS = "all,WON,LOST,CONFIRMED,CANCELLED,PUSHED,PARTIALLY_WON,VOIDED,CASHED,PENDING"
PAGE_SIZE = 50
MAX_HISTORY_PAGES = 400
IMPORT_CHUNK_SIZE = 80
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


def _positive_int(value: Any) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return 0
    return number if number > 0 else 0


def _explicit_flag(value: Any) -> Optional[bool]:
    if value is True or value in (1, "1", "true", "True"):
        return True
    if value is False or value in (0, "0", "false", "False"):
        return False
    return None


def history_page_size(data: Optional[Dict[str, Any]]) -> int:
    payload = data if isinstance(data, dict) else {}
    return _positive_int(payload.get("pageSize", payload.get("page_size"))) or PAGE_SIZE


def history_total_pages(data: Optional[Dict[str, Any]]) -> int:
    payload = data if isinstance(data, dict) else {}
    for key in ("totalPages", "total_pages", "pageCount", "numberOfPages"):
        if key in payload:
            found = _positive_int(payload.get(key))
            if found:
                return found
    return 0


def history_total_count(data: Optional[Dict[str, Any]]) -> Optional[int]:
    payload = data if isinstance(data, dict) else {}
    for key in ("total", "totalCount", "totalElements", "totalTickets", "count"):
        if payload.get(key) is None:
            continue
        try:
            return int(payload.get(key))
        except (TypeError, ValueError):
            continue
    return None


def resolve_has_next_page(
    data: Optional[Dict[str, Any]],
    page: int,
    tickets: Optional[Iterable[Dict[str, Any]]] = None,
) -> bool:
    """A full page always continues. Older settled tickets sit on later pages."""
    payload = data if isinstance(data, dict) else {}
    page_tickets = list(tickets or [])
    page_size = history_page_size(payload)
    current = _positive_int(page) or 1
    if len(page_tickets) >= page_size:
        return True
    total_pages = history_total_pages(payload)
    if total_pages:
        return current < total_pages
    total = history_total_count(payload)
    if total is not None and total >= 0:
        return current * page_size < total
    flag = _explicit_flag(
        payload.get(
            "hasNextPage",
            payload.get("has_next_page", payload.get("hasMore", payload.get("has_more"))),
        )
    )
    return flag is True


def page_already_seen(tickets: Iterable[Dict[str, Any]], seen_ids: Optional[Iterable[str]] = None) -> bool:
    seen = set(seen_ids or [])
    if not seen:
        return False
    ids = [ticket.get("id") for ticket in tickets if isinstance(ticket, dict) and ticket.get("id")]
    if not ids:
        return False
    return all(ticket_id in seen for ticket_id in ids)


def needs_full_history(history_backfill_done: bool = False, known_count: int = 0) -> bool:
    """The first import reads every page. Later syncs only need the newest page."""
    if history_backfill_done:
        return False
    try:
        saved = int(known_count or 0)
    except (TypeError, ValueError):
        saved = 0
    if saved > PAGE_SIZE:
        return False
    return True


def should_stop_pagination(
    tickets: Iterable[Dict[str, Any]],
    has_next_page: bool,
    known_ids: Optional[Set[str]] = None,
    pending_ids: Optional[Set[str]] = None,
    incomplete_ids: Optional[Set[str]] = None,
    full_history: bool = False,
    page: int = 0,
) -> bool:
    del known_ids, pending_ids, incomplete_ids
    tickets = list(tickets)
    if len(tickets) == 0:
        return True
    if page and page >= MAX_HISTORY_PAGES:
        return True
    if not full_history:
        return True
    return not has_next_page


def chunk_tickets(tickets: Iterable[Dict[str, Any]], size: Optional[int] = None) -> list:
    items = list(tickets or [])
    chunk_size = _positive_int(size) or IMPORT_CHUNK_SIZE
    return [items[index : index + chunk_size] for index in range(0, len(items), chunk_size)]


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
