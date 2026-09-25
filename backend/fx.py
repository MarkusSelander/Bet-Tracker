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


def nok_per_usd_from_norges_bank(csv_text: str) -> float:
    rows = [line for line in (csv_text or "").splitlines() if line.strip()]
    if len(rows) < 2:
        raise ValueError("invalid usd rate")
    value = rows[-1].split(";")[-1].strip()
    return nok_per_usd({"rates": {"NOK": value}})
