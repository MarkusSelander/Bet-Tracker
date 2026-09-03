import re
from typing import Any, Dict, Iterable, Optional, Set

CHROME_EXTENSION_ORIGIN_RE = r"^chrome-extension://[a-z]{32}$"

HISTORY_PATH = "/s/sbgate/bets/history"
TICKET_STATUS = "all,WON,LOST,CONFIRMED,CANCELLED,PUSHED,PARTIALLY_WON,VOIDED,CASHED,PENDING"
PAGE_SIZE = 50
OPEN_STATUSES = {"PENDING", "CONFIRMED"}


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
