from typing import Any, Dict, List, Optional

MOVEMENT_TYPES = {"deposit", "withdrawal"}


def _public_movement(row: Dict[str, Any]) -> Dict[str, Any]:
    created = row.get("created_at")
    if hasattr(created, "isoformat"):
        created = created.isoformat()
    try:
        amount = round(float(row.get("amount") or 0), 2)
    except (TypeError, ValueError):
        amount = 0.0
    return {
        "movement_id": row.get("movement_id"),
        "type": row.get("type"),
        "amount": amount,
        "date": row.get("date"),
        "note": row.get("note"),
        "created_at": created,
    }


def compute_bankroll(movements: List[Dict[str, Any]]) -> Dict[str, Any]:
    deposited = 0.0
    withdrawn = 0.0
    for movement in movements or []:
        try:
            amount = float(movement.get("amount") or 0)
        except (TypeError, ValueError):
            amount = 0.0
        if amount < 0:
            amount = 0.0
        kind = movement.get("type")
        if kind == "deposit":
            deposited += amount
        elif kind == "withdrawal":
            withdrawn += amount
    rows = sorted(
        movements or [],
        key=lambda row: (str(row.get("date") or ""), str(row.get("created_at") or "")),
        reverse=True,
    )
    return {
        "balance": round(deposited - withdrawn, 2),
        "deposited": round(deposited, 2),
        "withdrawn": round(withdrawn, 2),
        "movements": [_public_movement(row) for row in rows],
    }


def movement_from_set(current_balance: float, new_balance: float) -> Optional[Dict[str, Any]]:
    delta = round(float(new_balance) - float(current_balance), 2)
    if delta == 0:
        return None
    if delta > 0:
        return {"type": "deposit", "amount": delta}
    return {"type": "withdrawal", "amount": abs(delta)}
