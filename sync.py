# Optional Bet Tracker push after fetch:
#   BET_TRACKER_API_URL=http://localhost:8000
#   BET_TRACKER_TOKEN=session_...
# JSON is always written to coolbet_bets.json as fallback.
import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests
from playwright.sync_api import BrowserContext, sync_playwright
from playwright_stealth import Stealth

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "backend"))

from coolbet_sync import (  # noqa: E402
    auth_headers,
    history_query,
    import_url,
    merge_ticket_details,
    needs_ticket_details,
    ticket_detail_paths,
)

STORAGE_DIR = Path.home() / "Library/Application Support/Google/Chrome/CoolbetProfile"
OUTPUT_FILE = Path("coolbet_bets.json")


def get_fresh_tokens(context: BrowserContext):
    page = context.new_page()

    stealth = Stealth()
    stealth.apply_stealth_sync(page)

    page.add_init_script("""
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });
    """)

    print("→ Opening bet history page...")
    page.goto("https://www.coolbet.com/eu/bet-history/sports",
              wait_until="networkidle")
    time.sleep(3)

    captured = {"cbauth": None, "login_session_id": None, "user_id": None}

    def handle_request(request):
        if "bets/history" in request.url:
            headers = request.headers
            captured["cbauth"] = headers.get("cbauth")
            captured["login_session_id"] = headers.get("login_session_id")
            captured["user_id"] = headers.get("user_id")

    page.on("request", handle_request)

    page.reload(wait_until="networkidle")
    time.sleep(2)
    page.close()

    if not captured["cbauth"]:
        raise Exception("Could not capture cbauth token. Are you logged in?")

    cookies = {c["name"]: c["value"] for c in context.cookies()}

    headers = {
        "accept": "*/*",
        "accept-language": "nb-NO,nb;q=0.9,no;q=0.8,nn;q=0.7,en-US;q=0.6,en;q=0.5",
        "cbauth": captured["cbauth"],
        "content-type": "application/json; charset=utf-8",
        "login_session_id": captured["login_session_id"] or "",
        "user_id": captured["user_id"] or "",
        "x-device": "DESKTOP",
        "x-language": "eu",
        "referer": "https://www.coolbet.com/eu/bet-history/sports",
        "user-agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/151.0.0.0 Safari/537.36"
        ),
        "sec-ch-ua": '"Chromium";v="151", "Not=A?Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
    }

    return headers, cookies


def fetch_all_bets(headers: dict, cookies: dict) -> List[Dict]:
    url = "https://www.coolbet.com/s/sbgate/bets/history"
    all_tickets = []
    page_num = 1

    while True:
        params = history_query(page_num)
        resp = requests.get(url, params=params,
                            headers=headers, cookies=cookies, timeout=30)

        if resp.status_code != 200:
            print(f"Error on page {page_num}: {resp.status_code}")
            print(resp.text[:400])
            break

        data = resp.json()
        tickets = data.get("tickets", [])
        all_tickets.extend(tickets)

        print(
            f"Page {page_num}: got {len(tickets)} tickets (total: {len(all_tickets)})")

        if not data.get("hasNextPage") or len(tickets) == 0:
            break

        page_num += 1
        time.sleep(0.7)

    return all_tickets


def enrich_combo_tickets(tickets: List[Dict], headers: dict, cookies: dict) -> List[Dict]:
    base = "https://www.coolbet.com"
    enriched = []
    pending = [ticket for ticket in tickets if needs_ticket_details(ticket)]
    print(f"→ Fetching details for {len(pending)} combo tickets...")

    for index, ticket in enumerate(tickets, start=1):
        if not needs_ticket_details(ticket):
            enriched.append(ticket)
            continue

        merged = ticket
        for path in ticket_detail_paths(ticket["id"], ticket.get("display_id")):
            resp = requests.get(base + path, headers=headers, cookies=cookies, timeout=30)
            if resp.status_code != 200:
                continue
            try:
                detail = resp.json()
            except ValueError:
                continue
            if isinstance(detail, dict):
                merged = merge_ticket_details(merged, detail)
                if not needs_ticket_details(merged):
                    break
        enriched.append(merged)
        time.sleep(0.25)
        if index % 25 == 0:
            print(f"Details {index}/{len(tickets)}")

    return enriched


def capture_tokens_or_prompt(context: BrowserContext) -> Tuple[dict, dict]:
    print("→ Checking Coolbet session...")
    try:
        return get_fresh_tokens(context)
    except Exception as first_error:
        print(f"Not logged in yet ({first_error})")

    page = context.new_page()
    page.goto("https://www.coolbet.com/eu/bet-history/sports",
              wait_until="domcontentloaded")
    print("\n" + "=" * 60)
    print("Browser is open.")
    print("1. Log in to Coolbet if needed")
    print("2. Make sure you can see your bet history")
    print("3. Then come back here and press Enter")
    print("=" * 60 + "\n")
    input(">>> Press Enter when you are fully logged in and on the bet history page... ")
    page.close()
    return get_fresh_tokens(context)


def push_tickets(api_url: str, token: str, tickets: List[Dict]) -> Optional[dict]:
    response = requests.post(
        import_url(api_url),
        headers=auth_headers(token),
        json={"tickets": tickets},
        timeout=60,
    )
    if response.status_code >= 400:
        print(f"Bet Tracker import failed: {response.status_code}")
        print(response.text[:400])
        return None
    summary = response.json()
    print(
        f"Pushed to Bet Tracker: {summary.get('imported', 0)} new, "
        f"{summary.get('updated', 0)} updated, {summary.get('skipped', 0)} skipped"
    )
    return summary


def main():
    with sync_playwright() as p:
        print("→ Launching Chrome...")
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(STORAGE_DIR),
            channel="chrome",
            headless=False,
            viewport={"width": 1400, "height": 900},
            locale="nb-NO",
            timezone_id="Europe/Oslo",
            args=["--disable-blink-features=AutomationControlled"],
        )

        try:
            headers, cookies = capture_tokens_or_prompt(context)

            print("→ Fetching all bets...")
            tickets = enrich_combo_tickets(fetch_all_bets(headers, cookies), headers, cookies)

            print(f"\nFinished. Total tickets: {len(tickets)}")
            OUTPUT_FILE.write_text(json.dumps(
                tickets, indent=2, ensure_ascii=False))
            print(f"Saved to {OUTPUT_FILE}")

            api_url = os.environ.get("BET_TRACKER_API_URL")
            token = os.environ.get("BET_TRACKER_TOKEN") or os.environ.get(
                "BET_TRACKER_SESSION_TOKEN")
            if api_url and token:
                print("→ Pushing to Bet Tracker...")
                push_tickets(api_url, token, tickets)
            elif api_url:
                print("BET_TRACKER_API_URL is set but BET_TRACKER_TOKEN is missing — JSON only.")
            else:
                print("No BET_TRACKER_API_URL — JSON only. Set it to auto-push.")

        finally:
            context.close()


if __name__ == "__main__":
    main()
