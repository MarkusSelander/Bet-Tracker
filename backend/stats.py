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

    for bet in all_bets:
        status = bet.get("status")
        if status == "won":
            temp_win_streak += 1
            temp_loss_streak = 0
            if current_streak_type == "won" or current_streak_type is None:
                current_streak += 1
                current_streak_type = "won"
            else:
                current_streak = 1
                current_streak_type = "won"
            best_win_streak = max(best_win_streak, temp_win_streak)
        elif status == "lost":
            temp_loss_streak += 1
            temp_win_streak = 0
            if current_streak_type == "lost" or current_streak_type is None:
                current_streak += 1
                current_streak_type = "lost"
            else:
                current_streak = 1
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
