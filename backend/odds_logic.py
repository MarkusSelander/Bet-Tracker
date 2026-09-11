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


def _norm(value):
    return " ".join(str(value or "").lower().split())


def favorite_matches(matches, league_keys, teams, event_ids):
    leagues = set(league_keys or [])
    events = set(event_ids or [])
    team_pairs = {(_norm(team.get("name")), team.get("sport_key")) for team in teams or []}
    selected = []
    for match in matches:
        home = _norm(match.get("home_team"))
        away = _norm(match.get("away_team"))
        key = match.get("sport_key")
        if match.get("id") in events or key in leagues:
            selected.append(match)
            continue
        if (home, key) in team_pairs or (away, key) in team_pairs:
            selected.append(match)
    return selected


TAB_GROUPS = {
    "soccer": ("soccer",),
    "tennis": ("tennis",),
    "basketball": ("basketball",),
    "icehockey": ("icehockey", "hockey"),
    "golf": ("golf",),
}


def sport_tab_keys(sports, tab):
    prefixes = TAB_GROUPS.get(tab)
    if not prefixes:
        return []
    keys = []
    for sport in sports:
        if not sport.get("active", True):
            continue
        blob = f"{sport.get('key', '')} {sport.get('group', '')}".lower()
        if any(prefix in blob for prefix in prefixes):
            keys.append(sport["key"])
    return keys


def search_leagues_and_teams(sports, events, query, limit=8):
    needle = _norm(query)
    leagues = []
    teams = []
    if needle:
        for sport in sports:
            hay = _norm(f"{sport.get('title', '')} {sport.get('key', '')}")
            if needle in hay and sport.get("active", True):
                leagues.append({
                    "key": sport["key"],
                    "title": sport.get("title") or sport["key"],
                    "group": sport.get("group") or "",
                })
            if len(leagues) >= limit:
                break
        seen = set()
        for event in events:
            for name in (event.get("home_team"), event.get("away_team")):
                if not name or needle not in _norm(name):
                    continue
                item = (name, event.get("sport_key"))
                if item in seen:
                    continue
                seen.add(item)
                teams.append({"name": name, "sport_key": event.get("sport_key")})
                if len(teams) >= limit:
                    break
            if len(teams) >= limit:
                break
    return {"leagues": leagues, "teams": teams}


def normalize_event(event, odds_1x2):
    return {
        "id": event.get("id"),
        "sport_key": event.get("sport_key"),
        "sport_title": event.get("sport_title"),
        "commence_time": event.get("commence_time"),
        "home_team": event.get("home_team"),
        "away_team": event.get("away_team"),
        "completed": bool(event.get("completed")),
        "scores": event.get("scores"),
        "odds_1x2": odds_1x2,
    }
