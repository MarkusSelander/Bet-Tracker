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
