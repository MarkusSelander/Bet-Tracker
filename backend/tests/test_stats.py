from datetime import datetime, timezone

from stats import (
    chart_date_bounds,
    compute_breakdown,
    compute_odds_range_breakdown,
    compute_stats,
    filter_bets,
    parse_days,
)


def _bet(**overrides):
    data = {
        "date": "2026-03-15",
        "status": "won",
        "stake": 100,
        "result": 80,
        "odds": 1.8,
        "sport": "Football",
        "bookie": "Coolbet",
        "tipster": "Anna",
        "league": "Eliteserien",
        "ticket_type": "single",
    }
    data.update(overrides)
    return data


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


def test_filter_bets_without_filters_keeps_all():
    bets = [_bet(), _bet(sport="Tennis")]
    assert filter_bets(bets) == bets


def test_filter_bets_by_date_range_is_inclusive():
    bets = [
        _bet(date="2026-01-01"),
        _bet(date="2026-01-15"),
        _bet(date="2026-02-01"),
    ]

    filtered = filter_bets(bets, date_from="2026-01-01", date_to="2026-01-15")

    assert [bet["date"] for bet in filtered] == ["2026-01-01", "2026-01-15"]


def test_filter_bets_by_sport_bookie_and_tipster_exact_match():
    bets = [
        _bet(sport="Football", bookie="Coolbet", tipster="Anna"),
        _bet(sport="Tennis", bookie="Coolbet", tipster="Anna"),
        _bet(sport="Football", bookie="Unibet", tipster="Anna"),
        _bet(sport="Football", bookie="Coolbet", tipster="Bo"),
    ]

    filtered = filter_bets(bets, sport="Football", bookie="Coolbet", tipster="Anna")

    assert filtered == [bets[0]]


def test_filter_bets_by_league_ticket_type_and_odds_range():
    bets = [
        _bet(league="Eliteserien", ticket_type="single", odds=1.80),
        _bet(league="Eliteserien", ticket_type="combo", odds=1.80),
        _bet(league="Premier League", ticket_type="single", odds=1.80),
        _bet(league="Eliteserien", ticket_type="single", odds=1.49),
        _bet(league="Eliteserien", ticket_type="single", odds=2.50),
    ]

    filtered = filter_bets(
        bets,
        league="Eliteserien",
        ticket_type="single",
        odds_min=1.5,
        odds_max=2.0,
    )

    assert filtered == [bets[0]]


def test_filter_bets_ignores_empty_optional_filters():
    bets = [_bet(sport="Football"), _bet(sport="Tennis")]

    filtered = filter_bets(bets, sport=None, bookie="", tipster=None, league="", ticket_type=None)

    assert filtered == bets


def test_filter_bets_by_status_and_inclusive_odds_bounds():
    bets = [
        _bet(status="won", odds=1.50),
        _bet(status="lost", odds=1.50),
        _bet(status="won", odds=2.00),
        _bet(status="won", odds=2.01),
    ]

    filtered = filter_bets(bets, status="won", odds_min=1.50, odds_max=2.00)

    assert filtered == [bets[0], bets[2]]


def test_breakdown_has_required_shape_and_groups_by_field():
    bets = [
        _bet(sport="Football", status="won", stake=100, result=80),
        _bet(sport="Football", status="lost", stake=100, result=-100),
        _bet(sport="Tennis", status="won", stake=50, result=25),
    ]

    rows = compute_breakdown(bets, "sport")
    football = next(row for row in rows if row["name"] == "Football")
    tennis = next(row for row in rows if row["name"] == "Tennis")

    assert set(football) >= {"name", "bets", "win_rate", "stake", "result", "roi"}
    assert football["bets"] == 2
    assert football["stake"] == 200
    assert football["result"] == -20
    assert football["win_rate"] == 50.0
    assert football["roi"] == -10.0
    assert tennis["bets"] == 1
    assert tennis["result"] == 25


def test_breakdown_roi_ignores_pending_stake():
    bets = [
        _bet(sport="Football", status="won", stake=100, result=50),
        _bet(sport="Football", status="pending", stake=500, result=0),
    ]

    row = compute_breakdown(bets, "sport")[0]

    assert row["bets"] == 2
    assert row["stake"] == 100
    assert row["result"] == 50
    assert row["roi"] == 50.0


def test_breakdown_uses_unknown_for_empty_and_can_skip_empty():
    bets = [
        _bet(sport="", league=None, tipster=""),
        _bet(sport="Football", league="Eliteserien", tipster="Anna"),
    ]

    sports = compute_breakdown(bets, "sport")
    leagues = compute_breakdown(bets, "league")
    tipsters = compute_breakdown(bets, "tipster", skip_empty=True)

    assert {row["name"] for row in sports} == {"Unknown", "Football"}
    assert {row["name"] for row in leagues} == {"Unknown", "Eliteserien"}
    assert [row["name"] for row in tipsters] == ["Anna"]


def test_leagues_and_ticket_types_use_same_breakdown_shape():
    bets = [
        _bet(league="Eliteserien", ticket_type="single", status="won", stake=100, result=80),
        _bet(league="Eliteserien", ticket_type="combo", status="lost", stake=100, result=-100),
    ]

    leagues = compute_breakdown(bets, "league")
    tickets = compute_breakdown(bets, "ticket_type")

    assert leagues[0]["name"] == "Eliteserien"
    assert leagues[0]["bets"] == 2
    assert {row["name"] for row in tickets} == {"single", "combo"}
    assert set(tickets[0]) >= {"name", "bets", "win_rate", "stake", "result", "roi"}


def test_odds_range_buckets_and_boundaries():
    bets = [
        _bet(odds=1.00, status="won", stake=10, result=5),
        _bet(odds=1.50, status="lost", stake=10, result=-10),
        _bet(odds=1.51, status="won", stake=20, result=10),
        _bet(odds=2.00, status="lost", stake=20, result=-20),
        _bet(odds=2.01, status="won", stake=30, result=15),
        _bet(odds=3.00, status="lost", stake=30, result=-30),
        _bet(odds=3.01, status="won", stake=40, result=20),
        _bet(odds=5.00, status="lost", stake=40, result=-40),
        _bet(odds=5.01, status="won", stake=50, result=25),
        _bet(odds=9.00, status="pending", stake=500, result=0),
    ]

    rows = {row["name"]: row for row in compute_odds_range_breakdown(bets)}

    assert set(rows) == {
        "1.00-1.50",
        "1.51-2.00",
        "2.01-3.00",
        "3.01-5.00",
        "5.01+",
    }
    assert rows["1.00-1.50"]["bets"] == 2
    assert rows["1.51-2.00"]["bets"] == 2
    assert rows["2.01-3.00"]["bets"] == 2
    assert rows["3.01-5.00"]["bets"] == 2
    assert rows["5.01+"]["bets"] == 2
    assert rows["5.01+"]["stake"] == 50
    assert rows["5.01+"]["result"] == 25
    assert rows["5.01+"]["roi"] == 50.0


def test_parse_days_accepts_all_and_integers():
    assert parse_days(None) is None
    assert parse_days("all") is None
    assert parse_days("30") == 30
    assert parse_days("7") == 7


def test_chart_date_bounds_prefer_explicit_range_over_days():
    now = datetime(2026, 9, 10, tzinfo=timezone.utc)

    start, end = chart_date_bounds(
        days="30",
        date_from="2026-01-01",
        date_to="2026-01-31",
        now=now,
    )

    assert start == "2026-01-01"
    assert end == "2026-01-31"


def test_chart_date_bounds_days_all_has_no_cap():
    now = datetime(2026, 9, 10, tzinfo=timezone.utc)

    start, end = chart_date_bounds(days="all", now=now)

    assert start is None
    assert end is None


def test_chart_omitted_days_uses_range_or_defaults_to_30():
    now = datetime(2026, 9, 10, tzinfo=timezone.utc)

    ranged = chart_date_bounds(days=None, date_from="2026-02-01", date_to="2026-02-28", now=now)
    defaulted = chart_date_bounds(days=None, now=now)
    numeric = chart_date_bounds(days="30", now=now)

    assert ranged == ("2026-02-01", "2026-02-28")
    assert defaulted == ("2026-08-11", None)
    assert numeric == ("2026-08-11", None)

