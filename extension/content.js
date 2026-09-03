(function () {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let pageAuth = null;

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.origin && event.origin !== "https://www.coolbet.com") return;
    const data = event.data;
    if (!data || data.source !== "coolbet-sync" || data.type !== "AUTH_HEADERS") return;
    if (!data.headers || !data.headers.cbauth) return;
    pageAuth = data.headers;
    try {
      chrome.runtime.sendMessage({ type: "AUTH_FROM_PAGE", headers: pageAuth });
    } catch (_err) {
      /* extension context may be invalidated */
    }
  });

  async function waitForPageAuth(timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (pageAuth && pageAuth.cbauth) return pageAuth;
      await sleep(150);
    }
    return pageAuth;
  }

  async function fetchTickets(auth, knownIds) {
    const resolvedAuth = (auth && auth.cbauth ? auth : null) || (await waitForPageAuth(8000));
    const headers = {
      accept: "*/*",
      "content-type": "application/json; charset=utf-8",
      "x-device": "DESKTOP",
      "x-language": "eu",
    };
    if (resolvedAuth && resolvedAuth.cbauth) {
      headers.cbauth = resolvedAuth.cbauth;
      headers.login_session_id = resolvedAuth.login_session_id || "";
      headers.user_id = resolvedAuth.user_id || "";
    }

    const known = new Set(knownIds || []);
    const all = [];
    let page = 1;

    while (true) {
      const response = await fetch(CoolbetHistory.historyUrl(page), {
        credentials: "include",
        headers,
      });

      if (response.status === 401 || response.status === 403) {
        return { status: "need_coolbet", tickets: [] };
      }
      if (!response.ok) {
        return {
          status: "error",
          error: `Coolbet history ${response.status}`,
          tickets: all,
        };
      }

      const data = await response.json();
      const tickets = Array.isArray(data.tickets) ? data.tickets : [];
      all.push(...tickets);

      if (
        CoolbetHistory.shouldStopPagination({
          tickets,
          hasNextPage: Boolean(data.hasNextPage),
          knownIds: known,
        })
      ) {
        break;
      }

      page += 1;
      await sleep(700);
    }

    return { status: "ok", tickets: all };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "FETCH_TICKETS") return undefined;
    fetchTickets(message.auth, message.knownIds)
      .then(sendResponse)
      .catch((err) => sendResponse({ status: "error", error: String(err.message || err), tickets: [] }));
    return true;
  });

  if (location.pathname.includes("bet-history")) {
    try {
      chrome.runtime.sendMessage({ type: "COOLBET_HISTORY_OPEN" });
    } catch (_err) {
      /* ignore */
    }
  }
})();
