from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple


SETTLED_STATUSES = {"won", "lost", "push", "cashed"}
ODDS_BUCKETS = [
    {"name": "1.00-1.50", "min": 1.0, "max": 1.5},
    {"name": "1.51-2.00", "min": 1.51, "max": 2.0},
    {"name": "2.01-3.00", "min": 2.01, "max": 3.0},
    {"name": "3.01-5.00", "min": 3.01, "max": 5.0},
    {"name": "5.01+", "min": 5.01, "max": float("inf")},
]


def _has_value(value: Any) -> bool:
    return value is not None and value != ""


def filter_bets(bets: List[Dict[str, Any]], **filters: Any) -> List[Dict[str, Any]]:
    date_from = filters.get("date_from")
    date_to = filters.get("date_to")
    sport = filters.get("sport")
    bookie = filters.get("bookie")
    tipster = filters.get("tipster")
    league = filters.get("league")
    ticket_type = filters.get("ticket_type")
    status = filters.get("status")
    odds_min = filters.get("odds_min")
    odds_max = filters.get("odds_max")

    def matches(bet: Dict[str, Any]) -> bool:
        bet_date = bet.get("date") or ""
        if _has_value(date_from) and bet_date < date_from:
            return False
        if _has_value(date_to) and bet_date > date_to:
            return False
        if _has_value(sport) and bet.get("sport") != sport:
            return False
        if _has_value(bookie) and bet.get("bookie") != bookie:
            return False
        if _has_value(tipster) and bet.get("tipster") != tipster:
            return False
        if _has_value(league) and bet.get("league") != league:
            return False
        if _has_value(ticket_type) and bet.get("ticket_type") != ticket_type:
            return False
        if _has_value(status) and bet.get("status") != status:
            return False
        odds = bet.get("odds")
        if odds_min is not None and (odds is None or odds < odds_min):
            return False
        if odds_max is not None and (odds is None or odds > odds_max):
            return False
        return True

    return [bet for bet in bets if matches(bet)]


def bets_mongo_query(user_id: str, **filters: Any) -> Dict[str, Any]:
    query: Dict[str, Any] = {"user_id": user_id}
    date_from = filters.get("date_from")
    date_to = filters.get("date_to")
    if _has_value(date_from) or _has_value(date_to):
        date_q: Dict[str, Any] = {}
        if _has_value(date_from):
            date_q["$gte"] = date_from
        if _has_value(date_to):
            date_q["$lte"] = date_to
        query["date"] = date_q
    for field in ("sport", "bookie", "tipster", "league", "ticket_type", "status"):
        value = filters.get(field)
        if _has_value(value):
            query[field] = value
    odds_min = filters.get("odds_min")
    odds_max = filters.get("odds_max")
    if odds_min is not None or odds_max is not None:
        odds_q: Dict[str, Any] = {}
        if odds_min is not None:
            odds_q["$gte"] = odds_min
        if odds_max is not None:
            odds_q["$lte"] = odds_max
        query["odds"] = odds_q
    return query


def unique_names(rows: List[Dict[str, Any]]) -> List[str]:
    names = sorted({row.get("name") for row in rows if row.get("name")})
    return names


def build_analytics_summary(
    bets: List[Dict[str, Any]],
    option_bets: List[Dict[str, Any]],
    chart_bets: List[Dict[str, Any]],
) -> Dict[str, Any]:
    return {
        "stats": compute_stats(bets),
        "chart": build_chart_data(chart_bets),
        "sports": compute_breakdown(bets, "sport"),
        "leagues": compute_breakdown(bets, "league"),
        "odds_range": compute_odds_range_breakdown(bets),
        "bookmakers": compute_breakdown(bets, "bookie"),
        "tipsters": compute_breakdown(bets, "tipster", skip_empty=True),
        "ticket_types": compute_breakdown(bets, "ticket_type"),
        "sport_options": unique_names(compute_breakdown(option_bets, "sport")),
        "bookie_options": unique_names(compute_breakdown(option_bets, "bookie")),
        "tipster_options": unique_names(compute_breakdown(option_bets, "tipster", skip_empty=True)),
    }


def _empty_group(name: str) -> Dict[str, Any]:
    return {
        "name": name,
        "bets": 0,
        "stake": 0,
        "result": 0,
        "won": 0,
        "lost": 0,
        "push": 0,
        "pending": 0,
        "cashed": 0,
    }


def _accumulate(group: Dict[str, Any], bet: Dict[str, Any]) -> None:
    group["bets"] += 1
    status = bet.get("status")
    if status in SETTLED_STATUSES:
        group["stake"] += bet.get("stake", 0) or 0
        group["result"] += bet.get("result", 0) or 0
    if status == "won":
        group["won"] += 1
    elif status == "lost":
        group["lost"] += 1
    elif status == "push":
        group["push"] += 1
    elif status == "pending":
        group["pending"] += 1
    elif status == "cashed":
        group["cashed"] += 1


def _finalize_group(group: Dict[str, Any]) -> Dict[str, Any]:
    decided = group["won"] + group["lost"]
    stake = group["stake"]
    result = group["result"]
    return {
        "name": group["name"],
        "bets": group["bets"],
        "win_rate": (group["won"] / decided * 100) if decided > 0 else 0,
        "stake": stake,
        "result": result,
        "roi": (result / stake * 100) if stake > 0 else 0,
        "profit_loss": result,
        "won": group["won"],
        "lost": group["lost"],
        "push": group["push"],
        "pending": group["pending"],
    }


def compute_breakdown(
    bets: List[Dict[str, Any]],
    field: str,
    *,
    skip_empty: bool = False,
) -> List[Dict[str, Any]]:
    groups: Dict[str, Dict[str, Any]] = {}
    for bet in bets:
        raw = bet.get(field)
        if skip_empty and not raw:
            continue
        name = raw if raw else "Unknown"
        if name not in groups:
            groups[name] = _empty_group(name)
        _accumulate(groups[name], bet)
    rows = [_finalize_group(group) for group in groups.values()]
    return sorted(rows, key=lambda row: row["result"], reverse=True)


def compute_odds_range_breakdown(bets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    groups = {bucket["name"]: _empty_group(bucket["name"]) for bucket in ODDS_BUCKETS}
    for bet in bets:
        odds = bet.get("odds")
        if odds is None:
            continue
        for bucket in ODDS_BUCKETS:
            if bucket["min"] <= odds <= bucket["max"]:
                _accumulate(groups[bucket["name"]], bet)
                break
    return [_finalize_group(group) for group in groups.values() if group["bets"] > 0]


def parse_days(days: Optional[str]) -> Optional[int]:
    if days is None or days == "" or str(days).lower() == "all":
        return None
    return int(days)


def chart_date_bounds(
    *,
    days: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    now: Optional[datetime] = None,
) -> Tuple[Optional[str], Optional[str]]:
    if _has_value(date_from) or _has_value(date_to):
        return (date_from or None, date_to or None)
    parsed = parse_days(days)
    if days is not None and parsed is None:
        return (None, None)
    window = parsed if parsed is not None else 30
    now = now or datetime.now(timezone.utc)
    start = (now - timedelta(days=window)).strftime("%Y-%m-%d")
    return (start, None)


def build_chart_data(bets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    daily_data: Dict[str, Dict[str, Any]] = {}

    for bet in bets:
        date = bet.get("date")
        if not date:
            continue
        if date not in daily_data:
            daily_data[date] = {
                "date": date,
                "daily_pl": 0,
                "cumulative_pl": 0,
                "bets": 0,
                "daily_stake": 0,
                "cumulative_stake": 0,
            }
        daily_data[date]["daily_pl"] += bet.get("result", 0) or 0
        daily_data[date]["bets"] += 1
        if bet.get("status") in SETTLED_STATUSES:
            daily_data[date]["daily_stake"] += bet.get("stake", 0) or 0

    chart_data = []
    cumulative_pl = 0
    cumulative_stake = 0
    for date in sorted(daily_data.keys()):
        row = daily_data[date]
        cumulative_pl += row["daily_pl"]
        cumulative_stake += row["daily_stake"]
        row["cumulative_pl"] = cumulative_pl
        row["cumulative_stake"] = cumulative_stake
        chart_data.append(row)
    return chart_data


def _bet_chrono_key(bet: Dict[str, Any]) -> Tuple[str, str]:
    return (bet.get("date") or "", bet.get("time") or "00:00:00")


def compute_stats(all_bets: List[Dict[str, Any]]) -> Dict[str, Any]:
    settled = [bet for bet in all_bets if bet.get("status") in SETTLED_STATUSES]
    total_stake = sum(bet.get("stake", 0) for bet in settled)
    total_profit_loss = sum(bet.get("result", 0) for bet in settled)

    won_bets = [bet for bet in all_bets if bet.get("status") == "won"]
    lost_bets = [bet for bet in all_bets if bet.get("status") == "lost"]
    push_bets = [bet for bet in all_bets if bet.get("status") == "push"]
    pending_bets = [bet for bet in all_bets if bet.get("status") == "pending"]
    cashed_bets = [bet for bet in all_bets if bet.get("status") == "cashed"]

    current_streak = 0
    current_streak_type: Optional[str] = None
    best_win_streak = 0
    worst_loss_streak = 0
    temp_win_streak = 0
    temp_loss_streak = 0

    for bet in sorted(all_bets, key=_bet_chrono_key):
        status = bet.get("status")
        if status == "won":
            temp_win_streak += 1
            temp_loss_streak = 0
            current_streak = temp_win_streak
            current_streak_type = "won"
            best_win_streak = max(best_win_streak, temp_win_streak)
        elif status == "lost":
            temp_loss_streak += 1
            temp_win_streak = 0
            current_streak = temp_loss_streak
            current_streak_type = "lost"
            worst_loss_streak = max(worst_loss_streak, temp_loss_streak)

    decided = len(won_bets) + len(lost_bets)
    return {
        "total_bets": len(all_bets),
        "total_stake": total_stake,
        "total_profit_loss": total_profit_loss,
        "roi": (total_profit_loss / total_stake * 100) if total_stake > 0 else 0,
        "won_count": len(won_bets),
        "lost_count": len(lost_bets),
        "push_count": len(push_bets),
        "pending_count": len(pending_bets),
        "cashed_count": len(cashed_bets),
        "win_rate": (len(won_bets) / decided * 100) if decided > 0 else 0,
        "current_streak": current_streak,
        "current_streak_type": current_streak_type,
        "best_win_streak": best_win_streak,
        "worst_loss_streak": worst_loss_streak,
    }


def parse_bankroll_amount(value: Any) -> float:
    if value is None or value == "":
        raise ValueError("missing")
    number = float(value)
    if number != number or number <= 0:
        raise ValueError("invalid")
    return round(number, 2)


def compute_cash_position(
    entries: List[Dict[str, Any]],
    unit_size: Any = None,
    bets: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Opening balance plus deposits, withdrawals and bet results."""
    ordered = sorted(entries or [], key=lambda entry: entry.get("at") or "")
    balance = None
    baseline = None
    deposited = 0.0
    withdrawn = 0.0
    applied: List[Dict[str, Any]] = []

    for entry in ordered:
        kind = entry.get("type")
        try:
            amount = round(float(entry.get("amount")), 2)
        except (TypeError, ValueError):
            continue
        if amount <= 0:
            continue
        if kind == "set":
            balance = amount
            baseline = amount
            deposited = 0.0
            withdrawn = 0.0
            applied = [entry]
        elif balance is None:
            continue
        elif kind == "deposit":
            balance = round(balance + amount, 2)
            deposited = round(deposited + amount, 2)
            applied.append(entry)
        elif kind == "withdrawal":
            balance = round(balance - amount, 2)
            withdrawn = round(withdrawn + amount, 2)
            applied.append(entry)

    bet_result = 0.0
    pending_stake = 0.0
    if balance is not None:
        for bet in bets or []:
            status = bet.get("status")
            if status in SETTLED_STATUSES:
                bet_result = round(bet_result + float(bet.get("result") or 0), 2)
            elif status == "pending":
                pending_stake = round(pending_stake + float(bet.get("stake") or 0), 2)
        balance = round(balance + bet_result - pending_stake, 2)

    unit = None
    try:
        unit = parse_bankroll_amount(unit_size)
    except (TypeError, ValueError):
        unit = None

    configured = baseline is not None
    return {
        "configured": configured,
        "baseline": baseline if configured else None,
        "current": balance if configured else None,
        "bet_result": bet_result,
        "pending_stake": pending_stake,
        "unit_size": unit,
        "current_units": round(balance / unit, 2) if configured and unit else None,
        "deposited": deposited,
        "withdrawn": withdrawn,
        "moves": list(reversed(applied[-8:])),
    }


def compute_bankroll(
    bets: List[Dict[str, Any]],
    starting_bankroll: Any = None,
    unit_size: Any = None,
) -> Dict[str, Any]:
    """Equity from a starting bank. Pending stakes are exposure, not a result."""
    start = None
    unit = None
    try:
        start = parse_bankroll_amount(starting_bankroll)
        unit = parse_bankroll_amount(unit_size)
    except (TypeError, ValueError):
        start = None
        unit = None

    settled = [bet for bet in bets if bet.get("status") in SETTLED_STATUSES]
    profit = 0.0
    equity = start or 0.0
    peak = equity
    max_drawdown = 0.0
    max_drawdown_pct = 0.0

    for bet in sorted(settled, key=_bet_chrono_key):
        result = float(bet.get("result") or 0)
        profit += result
        if start is None:
            continue
        equity += result
        if equity > peak:
            peak = equity
        drawdown = peak - equity
        if drawdown > max_drawdown:
            max_drawdown = drawdown
            max_drawdown_pct = (drawdown / peak * 100) if peak > 0 else 0.0

    pending_stake = sum(float(bet.get("stake") or 0) for bet in bets if bet.get("status") == "pending")
    configured = start is not None and unit is not None
    current = equity if configured else None
    current_drawdown = (peak - equity) if configured else None
    current_drawdown_pct = ((current_drawdown / peak) * 100) if configured and peak > 0 else None

    def money(value: Optional[float]) -> Optional[float]:
        return None if value is None else round(value, 2)

    return {
        "configured": configured,
        "starting_bankroll": start,
        "unit_size": unit,
        "current": money(current),
        "peak": money(peak) if configured else None,
        "profit_loss": round(profit, 2),
        "change_pct": round(((equity - start) / start) * 100, 2) if configured and start else None,
        "max_drawdown": money(max_drawdown) if configured else None,
        "max_drawdown_pct": round(max_drawdown_pct, 2) if configured else None,
        "current_drawdown": money(current_drawdown),
        "current_drawdown_pct": round(current_drawdown_pct, 2) if current_drawdown_pct is not None else None,
        "current_units": round(equity / unit, 2) if configured and unit else None,
        "pending_stake": round(pending_stake, 2),
        "available": money(equity - pending_stake) if configured else None,
    }
