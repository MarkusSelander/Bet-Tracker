"""USD/NOK rate used to display ledger amounts (stored in NOK)."""

from typing import Any


def nok_per_usd(payload: Any) -> float:
    rates = payload.get("rates") if isinstance(payload, dict) else None
    raw = rates.get("NOK") if isinstance(rates, dict) else None
    try:
        rate = float(raw)
    except (TypeError, ValueError) as error:
        raise ValueError("invalid usd rate") from error
    if rate != rate or rate <= 0:
        raise ValueError("invalid usd rate")
    return round(rate, 4)
