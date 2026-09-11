from datetime import datetime, timezone


def _h2h_market(bookmaker):
    for market in bookmaker.get("markets") or []:
        if market.get("key") == "h2h":
            return market
    return None


def best_h2h(event):
    home = event.get("home_team")
    away = event.get("away_team")
    best = {
        "home": None,
        "draw": None,
        "away": None,
        "home_bookmaker": None,
        "draw_bookmaker": None,
        "away_bookmaker": None,
    }
    for bookmaker in event.get("bookmakers") or []:
        market = _h2h_market(bookmaker)
        if not market:
            continue
        title = bookmaker.get("title") or bookmaker.get("key") or ""
        for outcome in market.get("outcomes") or []:
            name = outcome.get("name")
            price = outcome.get("price")
            if price is None:
                continue
            if name == home and (best["home"] is None or price > best["home"]):
                best["home"] = price
                best["home_bookmaker"] = title
            elif name == away and (best["away"] is None or price > best["away"]):
                best["away"] = price
                best["away_bookmaker"] = title
            elif name == "Draw" and (best["draw"] is None or price > best["draw"]):
                best["draw"] = price
                best["draw_bookmaker"] = title
    if best["home"] is None and best["draw"] is None and best["away"] is None:
        return None
    return best


def _closest_totals_point(bookmakers, target=2.5):
    points = []
    for bookmaker in bookmakers:
        for market in bookmaker.get("markets") or []:
            if market.get("key") != "totals":
                continue
            for outcome in market.get("outcomes") or []:
                point = outcome.get("point")
                if point is not None:
                    points.append(float(point))
    if not points:
        return None
    return min(points, key=lambda value: (abs(value - target), value))


def _best_named_outcomes(bookmakers, market_key, allowed_names=None, point=None):
    best = {}
    for bookmaker in bookmakers:
        title = bookmaker.get("title") or bookmaker.get("key") or ""
        for market in bookmaker.get("markets") or []:
            if market.get("key") != market_key:
                continue
            for outcome in market.get("outcomes") or []:
                name = outcome.get("name")
                price = outcome.get("price")
                if name is None or price is None:
                    continue
                if allowed_names and name not in allowed_names:
                    continue
                if point is not None:
                    outcome_point = outcome.get("point")
                    if outcome_point is None or float(outcome_point) != float(point):
                        continue
                current = best.get(name)
                if current is None or price > current["price"]:
                    row = {"name": name, "price": price, "bookmaker": title}
                    if outcome.get("point") is not None:
                        row["point"] = outcome["point"]
                    best[name] = row
    return list(best.values())


def map_event_markets(event):
    bookmakers = event.get("bookmakers") or []
    mapped = []
    h2h = best_h2h(event)
    if h2h:
        outcomes = []
        if h2h["home"] is not None:
            outcomes.append({"name": event.get("home_team"), "price": h2h["home"], "bookmaker": h2h["home_bookmaker"]})
        if h2h["draw"] is not None:
            outcomes.append({"name": "Draw", "price": h2h["draw"], "bookmaker": h2h["draw_bookmaker"]})
        if h2h["away"] is not None:
            outcomes.append({"name": event.get("away_team"), "price": h2h["away"], "bookmaker": h2h["away_bookmaker"]})
        mapped.append({"key": "h2h", "outcomes": outcomes})
    point = _closest_totals_point(bookmakers)
    totals = _best_named_outcomes(bookmakers, "totals", {"Over", "Under"}, point=point)
    if totals:
        mapped.append({"key": "totals", "outcomes": totals})
    btts = _best_named_outcomes(bookmakers, "btts", {"Yes", "No"})
    if btts:
        mapped.append({"key": "btts", "outcomes": btts})
    return mapped


def match_date(commence_time):
    if not commence_time:
        return None
    text = str(commence_time).replace("Z", "+00:00")
    try:
        value = datetime.fromisoformat(text)
    except ValueError:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.date().isoformat()


def match_status(match):
    if match.get("completed"):
        return "finished"
    if match.get("scores"):
        return "live"
    return "scheduled"


def filter_matches(matches, date, status_filter="all"):
    filtered = [row for row in matches if match_date(row.get("commence_time")) == date]
    if status_filter in {"live", "finished", "scheduled"}:
        filtered = [row for row in filtered if match_status(row) == status_filter]
    if status_filter == "odds":
        filtered = [row for row in filtered if row.get("odds_1x2")]
    return filtered
