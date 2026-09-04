importScripts("lib/history.js");

const BET_HISTORY_URL = "https://www.coolbet.com/eu/bet-history/sports";
const ALARM_NAME = "coolbet-auto-sync";
const AUTO_COOLDOWN_MS = 10 * 60 * 1000;

let capturedAuth = null;
let syncInFlight = null;
let lastAutoAt = 0;

chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    if (!details.url || !details.url.includes("/s/sbgate/bets/history")) return;
    const headers = {};
    for (const header of details.requestHeaders || []) {
      headers[String(header.name).toLowerCase()] = header.value;
    }
    if (headers.cbauth) {
      capturedAuth = {
        cbauth: headers.cbauth,
        login_session_id: headers.login_session_id || "",
        user_id: headers.user_id || "",
      };
    }
  },
  { urls: ["https://www.coolbet.com/s/sbgate/bets/history*"] },
  ["requestHeaders", "extraHeaders"]
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function setState(partial) {
  await chrome.storage.local.set(partial);
}

async function waitForTabComplete(tabId, timeoutMs = 25000) {
  const existing = await chrome.tabs.get(tabId);
  if (existing.status === "complete") return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Coolbet-fanen lastet ikke i tide"));
    }, timeoutMs);

    function listener(updatedId, info) {
      if (updatedId === tabId && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function ensureCoolbetTab() {
  const tabs = await chrome.tabs.query({ url: "https://www.coolbet.com/*" });
  let tab = tabs.find((item) => item.url && item.url.includes("bet-history")) || tabs[0];

  if (!tab) {
    tab = await chrome.tabs.create({ url: BET_HISTORY_URL, active: false });
    await waitForTabComplete(tab.id);
    return tab.id;
  }

  if (!tab.url || !tab.url.includes("bet-history")) {
    await chrome.tabs.update(tab.id, { url: BET_HISTORY_URL });
    await waitForTabComplete(tab.id);
  }

  return tab.id;
}

async function waitForAuth(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (capturedAuth && capturedAuth.cbauth) return capturedAuth;
    await sleep(200);
  }
  return capturedAuth;
}

async function sendToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (_err) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["lib/history.js", "content.js"],
    });
    await sleep(200);
    return chrome.tabs.sendMessage(tabId, message);
  }
}

async function runSync(reason) {
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    await setState({ lastStatus: "syncing", lastError: "" });

    try {
      const config = await chrome.storage.local.get([
        "apiUrl",
        "sessionToken",
        "knownIds",
        "lastSyncAt",
      ]);

      if (!config.apiUrl || !config.sessionToken) {
        await setState({ lastStatus: "need_bet_tracker" });
        return { ok: false, status: "need_bet_tracker" };
      }

      const meResponse = await fetch(CoolbetHistory.meUrl(config.apiUrl), {
        headers: CoolbetHistory.authHeaders(config.sessionToken),
        credentials: "omit",
      });
      if (meResponse.status === 401) {
        await setState({ lastStatus: "need_bet_tracker", sessionToken: "" });
        return { ok: false, status: "need_bet_tracker" };
      }
      if (!meResponse.ok) {
        throw new Error(`Bet Tracker /auth/me ${meResponse.status}`);
      }
      const me = await meResponse.json().catch(() => ({}));
      const remoteSyncAt = CoolbetHistory.resolveLastSyncAt(me);
      if (remoteSyncAt && !config.lastSyncAt) {
        await setState({ lastSyncAt: remoteSyncAt });
        config.lastSyncAt = remoteSyncAt;
      }

      const tabId = await ensureCoolbetTab();
      const auth = await waitForAuth(10000);
      const result = await sendToTab(tabId, {
        type: "FETCH_TICKETS",
        auth,
        knownIds: config.knownIds || [],
      });

      if (!result || result.status === "need_coolbet") {
        await setState({ lastStatus: "need_coolbet" });
        return { ok: false, status: "need_coolbet" };
      }

      if (result.status !== "ok") {
        await setState({
          lastStatus: "error",
          lastError: result.error || "Ukjent feil fra Coolbet",
        });
        return { ok: false, status: "error", error: result.error };
      }

      const tickets = result.tickets || [];
      const importResponse = await fetch(CoolbetHistory.importUrl(config.apiUrl), {
        method: "POST",
        headers: CoolbetHistory.authHeaders(config.sessionToken),
        credentials: "omit",
        body: JSON.stringify({ tickets }),
      });

      if (importResponse.status === 401) {
        await setState({ lastStatus: "need_bet_tracker", sessionToken: "" });
        return { ok: false, status: "need_bet_tracker" };
      }

      if (!importResponse.ok) {
        const text = await importResponse.text();
        throw new Error(`Import ${importResponse.status}: ${text.slice(0, 180)}`);
      }

      const summary = await importResponse.json();
      const knownIds = Array.from(
        new Set([...(config.knownIds || []), ...CoolbetHistory.collectTicketIds(tickets)])
      ).slice(-4000);

      const lastSyncAt = Date.now();
      await setState({ lastSyncAt });
      await setState({
        lastStatus: "ok",
        lastError: "",
        lastSyncAt,
        lastResult: {
          fetched: tickets.length,
          imported: summary.imported || 0,
          updated: summary.updated || 0,
          skipped: summary.skipped || 0,
          reason,
        },
        knownIds,
      });

      return { ok: true, status: "ok", summary, fetched: tickets.length };
    } catch (err) {
      await setState({
        lastStatus: "error",
        lastError: String(err.message || err),
      });
      return { ok: false, status: "error", error: String(err.message || err) };
    } finally {
      syncInFlight = null;
    }
  })();

  return syncInFlight;
}

async function maybeAutoSync(reason) {
  const config = await chrome.storage.local.get(["autoOnHistory", "autoAlarm"]);
  if (reason === "history-page" && config.autoOnHistory === false) return;
  if (reason === "alarm" && !config.autoAlarm) return;
  if (Date.now() - lastAutoAt < AUTO_COOLDOWN_MS) return;
  lastAutoAt = Date.now();
  return runSync(reason);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) return undefined;

  if (message.type === "AUTH_FROM_PAGE" && message.headers && message.headers.cbauth) {
    capturedAuth = message.headers;
    return undefined;
  }

  if (message.type === "COOLBET_HISTORY_OPEN") {
    Promise.resolve(maybeAutoSync("history-page")).finally(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "RUN_SYNC") {
    runSync("popup").then(sendResponse);
    return true;
  }

  if (message.type === "GET_STATE") {
    chrome.storage.local
      .get([
        "lastSyncAt",
        "lastStatus",
        "lastResult",
        "lastError",
        "sessionToken",
        "apiUrl",
      ])
      .then((state) => {
        sendResponse({
          ...state,
          lastSyncAt: CoolbetHistory.resolveLastSyncAt(state),
        });
      });
    return true;
  }

  return undefined;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) maybeAutoSync("alarm");
});

async function recoverInterruptedSync() {
  const current = await chrome.storage.local.get(["lastStatus", "lastSyncAt"]);
  if (current.lastStatus === "syncing") {
    await chrome.storage.local.set({
      lastStatus: current.lastSyncAt ? "ok" : "",
      lastError: "",
    });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(["autoOnHistory", "autoAlarm"]);
  if (current.autoOnHistory === undefined) {
    await chrome.storage.local.set({ autoOnHistory: true });
  }
  if (current.autoAlarm) {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 360 });
  }
  await recoverInterruptedSync();
});

recoverInterruptedSync();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.autoAlarm) return;
  if (changes.autoAlarm.newValue) {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 360 });
  } else {
    chrome.alarms.clear(ALARM_NAME);
  }
});
