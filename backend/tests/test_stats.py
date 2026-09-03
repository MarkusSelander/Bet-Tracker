from stats import compute_stats


def test_roi_ignores_pending_stake():
    bets = [
        {"status": "won", "stake": 100, "result": 80},
        {"status": "lost", "stake": 100, "result": -100},
        {"status": "pending", "stake": 500, "result": 0},
        {"status": "cashed", "stake": 100, "result": -40},
    ]

    stats = compute_stats(bets)

    assert stats["total_bets"] == 4
    assert stats["pending_count"] == 1
    assert stats["total_stake"] == 300
    assert stats["total_profit_loss"] == -60
    assert stats["roi"] == -20.0
    assert stats["won_count"] == 1
    assert stats["lost_count"] == 1
    assert stats["win_rate"] == 50.0
