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
                f"/s/sbgate/bets/{tid}?{query}",
                f"/s/sbgate/bets/ticket/{tid}?{query}",
            ]
        )
    return paths


def _stored_leg_count(ticket: Dict[str, Any]) -> int:
    for key in ("matches", "legs"):
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
            for key in ("matches", "bets", "legs", "selections")
        ):
            return candidate
    return detail


def merge_ticket_details(ticket: Dict[str, Any], detail: Any) -> Dict[str, Any]:
    payload = unwrap_ticket_payload(detail)
    merged = {**ticket}
    for key in ("matches", "bets", "legs"):
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


def should_stop_pagination(
    tickets: Iterable[Dict[str, Any]],
    has_next_page: bool,
    known_ids: Optional[Set[str]] = None,
) -> bool:
    tickets = list(tickets)
    if not has_next_page or len(tickets) == 0:
        return True
    if not known_ids:
        return False
    if not all(ticket.get("id") in known_ids for ticket in tickets):
        return False
    if any(str(ticket.get("status") or "").upper() in OPEN_STATUSES for ticket in tickets):
        return False
    return True
