from typing import Any, Dict, List, Optional


SETTLED_STATUSES = {"won", "lost", "push", "cashed"}


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
