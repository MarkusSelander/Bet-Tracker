import "./lib/history.js";

const CoolbetHistory = globalThis.CoolbetHistory;

const BET_HISTORY_URL = "https://www.coolbet.com/eu/bet-history/sports";
const ALARM_NAME = "coolbet-auto-sync";
const AUTO_COOLDOWN_MS = 10 * 60 * 1000;
const LOGIN_DEBOUNCE_MS = 30 * 1000;

let capturedAuth = null;
let syncInFlight = null;
let lastAutoAt = 0;
let lastLoginSyncAt = 0;
let lastSeenSessionKey = null;
let sessionKeyLoad = null;

function headerMap(requestHeaders) {
  const headers = {};
  for (const header of requestHeaders || []) {
    headers[String(header.name).toLowerCase()] = header.value;
  }
  return headers;
}

function rememberCapturedAuth(headers) {
  if (!headers || !headers.cbauth) return;
  capturedAuth = {
    cbauth: headers.cbauth,
    login_session_id: headers.login_session_id || "",
    user_id: headers.user_id || "",
  };
  noteCoolbetSession(capturedAuth);
}

chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    if (!details.url) return;
    rememberCapturedAuth(headerMap(details.requestHeaders));
  },
  { urls: ["https://www.coolbet.com/*"] },
  ["requestHeaders", "extraHeaders"]
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (!details.url || details.statusCode < 200 || details.statusCode >= 300) return;
    if (!CoolbetHistory.isCoolbetLoginRequest(details.url, details.method)) return;
    maybeAutoSync("coolbet-login");
  },
  { urls: ["https://www.coolbet.com/*"] }
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function setState(partial) {
  await chrome.storage.local.set(partial);
}

async function setProgress(partial) {
  await setState({
    lastStatus: "syncing",
    syncProgress: CoolbetHistory.computeSyncProgress(partial),
  });
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

async function openHistoryTabForLogin() {
  const tabs = await chrome.tabs.query({ url: "https://www.coolbet.com/*" });
  const historyTab = tabs.find((item) => item.url && item.url.includes("bet-history"));
  if (historyTab) return { tabId: historyTab.id, created: false };

  if (capturedAuth && capturedAuth.cbauth) {
    const current = tabs.find((item) => item.active) || tabs[0];
    if (current) return { tabId: current.id, created: false };
  }

  const created = await chrome.tabs.create({ url: BET_HISTORY_URL, active: false });
  await waitForTabComplete(created.id);
  return { tabId: created.id, created: true };
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
    let closeTabId = null;
    await setState({ lastStatus: "syncing", lastError: "", syncProgress: CoolbetHistory.computeSyncProgress({ phase: "auth" }) });

    try {
      const config = await chrome.storage.local.get([
        "apiUrl",
        "sessionToken",
        "knownIds",
        "lastSyncAt",
      ]);

      if (!config.apiUrl || !config.sessionToken) {
        await setState({ lastStatus: "need_bet_tracker", syncProgress: null });
        return { ok: false, status: "need_bet_tracker" };
      }

      const meResponse = await fetch(CoolbetHistory.meUrl(config.apiUrl), {
        headers: CoolbetHistory.authHeaders(config.sessionToken),
        credentials: "omit",
      });
      if (meResponse.status === 401) {
        await setState({ lastStatus: "need_bet_tracker", sessionToken: "", syncProgress: null });
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

      let knownIds = Array.isArray(config.knownIds) ? config.knownIds : [];
      let pendingIds = [];
      let incompleteIds = [];
      const betsResponse = await fetch(
        CoolbetHistory.betsUrl(config.apiUrl, "Coolbet", { view: "summary" }),
        {
          headers: CoolbetHistory.authHeaders(config.sessionToken),
          credentials: "omit",
        }
      );
      if (betsResponse.ok) {
        const bets = await betsResponse.json();
        pendingIds = CoolbetHistory.collectPendingIdsFromBets(bets);
        incompleteIds = CoolbetHistory.collectIncompleteIdsFromBets(bets);
        knownIds = CoolbetHistory.mergeKnownIds(knownIds, bets);
        if (knownIds.length) await setState({ knownIds });
      }

      await setProgress({ phase: "coolbet" });
      let tabId;
      if (reason === "coolbet-login") {
        const opened = await openHistoryTabForLogin();
        tabId = opened.tabId;
        if (opened.created) closeTabId = opened.tabId;
      } else {
        tabId = await ensureCoolbetTab();
      }
      const auth = await waitForAuth(10000);
      const result = await sendToTab(tabId, {
        type: "FETCH_TICKETS",
        auth,
        knownIds,
        pendingIds,
        incompleteIds,
      });

      if (!result || result.status === "need_coolbet") {
        await setState({ lastStatus: "need_coolbet", syncProgress: null });
        return { ok: false, status: "need_coolbet" };
      }

      if (result.status !== "ok") {
        await setState({
          lastStatus: "error",
          lastError: result.error || "Ukjent feil fra Coolbet",
          syncProgress: null,
        });
        return { ok: false, status: "error", error: result.error };
      }

      const fetched = result.tickets || [];
      const tickets = CoolbetHistory.ticketsToImport(
        fetched,
        new Set(knownIds),
        new Set(pendingIds),
        new Set(incompleteIds)
      );
      let summary = { imported: 0, updated: 0, skipped: tickets.length ? 0 : fetched.length };
      const acceptedIds = [];
      const chunks = CoolbetHistory.chunkTickets(tickets);
      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        await setProgress({
          phase: "import",
          percent: 95,
          label:
            chunks.length > 1
              ? `Lagrer kuponger · ${index + 1}/${chunks.length}`
              : "Sender til Bet Tracker…",
        });
        const importResponse = await fetch(CoolbetHistory.importUrl(config.apiUrl), {
          method: "POST",
          headers: CoolbetHistory.authHeaders(config.sessionToken),
          credentials: "omit",
          body: JSON.stringify({ tickets: chunk }),
        });

        if (importResponse.status === 401) {
          await setState({ lastStatus: "need_bet_tracker", sessionToken: "", syncProgress: null });
          return { ok: false, status: "need_bet_tracker" };
        }

        if (!importResponse.ok) {
          const text = await importResponse.text();
          throw new Error(`Import ${importResponse.status}: ${text.slice(0, 180)}`);
        }

        const part = await importResponse.json();
        summary.imported += part.imported || 0;
        summary.updated += part.updated || 0;
        summary.skipped += part.skipped || 0;
        acceptedIds.push(...CoolbetHistory.collectTicketIds(chunk));
      }

      const nextKnownIds = Array.from(new Set([...knownIds, ...acceptedIds]));

      const lastSyncAt = Date.now();
      await setState({ lastSyncAt });
      await setState({
        lastStatus: "ok",
        lastError: "",
        lastSyncAt,
        syncProgress: CoolbetHistory.computeSyncProgress({ phase: "done" }),
        lastResult: {
          fetched: fetched.length,
          imported: summary.imported || 0,
          updated: summary.updated || 0,
          skipped: summary.skipped || 0,
          comboLegs: CoolbetHistory.countComboTicketsWithLegs(tickets),
          reason,
        },
        knownIds: nextKnownIds,
      });

      return { ok: true, status: "ok", summary, fetched: fetched.length };
    } catch (err) {
      await setState({
        lastStatus: "error",
        lastError: String(err.message || err),
        syncProgress: null,
      });
      return { ok: false, status: "error", error: String(err.message || err) };
    } finally {
      if (closeTabId != null) {
        try {
          await chrome.tabs.remove(closeTabId);
        } catch (_err) {
          /* fanen kan allerede være lukket */
        }
      }
      syncInFlight = null;
    }
  })();

  return syncInFlight;
}

function noteCoolbetSession(auth) {
  const key = CoolbetHistory.coolbetSessionKey(auth);
  if (!key || key === lastSeenSessionKey || sessionKeyLoad) return;
  sessionKeyLoad = (async () => {
    try {
      const stored = await chrome.storage.local.get(["lastCoolbetSessionKey", "autoOnLogin"]);
      if (stored.lastCoolbetSessionKey === key) {
        lastSeenSessionKey = key;
        return;
      }
      lastSeenSessionKey = key;
      await chrome.storage.local.set({ lastCoolbetSessionKey: key });
      if (stored.autoOnLogin === false) return;
      if (syncInFlight || Date.now() - lastLoginSyncAt < LOGIN_DEBOUNCE_MS) return;
      await maybeAutoSync("coolbet-login", { ignoreCooldown: true });
    } finally {
      sessionKeyLoad = null;
    }
  })();
}

async function maybeAutoSync(reason, options = {}) {
  const config = await chrome.storage.local.get(["autoOnHistory", "autoAlarm", "autoOnLogin"]);
  if (reason === "history-page" && config.autoOnHistory === false) return;
  if (reason === "alarm" && !config.autoAlarm) return;
  if (reason === "coolbet-login" && config.autoOnLogin === false) return;

  const now = Date.now();
  if (reason === "coolbet-login") {
    if (options.ignoreCooldown) {
      lastLoginSyncAt = now;
    } else if (now - lastAutoAt < AUTO_COOLDOWN_MS) {
      return;
    } else {
      lastLoginSyncAt = now;
    }
  } else if (now - lastAutoAt < AUTO_COOLDOWN_MS) {
    return;
  }
  lastAutoAt = now;
  return runSync(reason);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) return undefined;

  if (message.type === "AUTH_FROM_PAGE" && message.headers && message.headers.cbauth) {
    rememberCapturedAuth(message.headers);
    return undefined;
  }

  if (message.type === "SYNC_PROGRESS") {
    setProgress(message);
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
        "syncProgress",
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
      syncProgress: null,
    });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(["autoOnHistory", "autoOnLogin", "autoAlarm"]);
  const defaults = {};
  if (current.autoOnHistory === undefined) defaults.autoOnHistory = true;
  if (current.autoOnLogin === undefined) defaults.autoOnLogin = true;
  if (Object.keys(defaults).length) await chrome.storage.local.set(defaults);
  if (current.autoAlarm) {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 360 });
  }
  await recoverInterruptedSync();
});

recoverInterruptedSync();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (
    changes.sessionToken &&
    changes.sessionToken.newValue &&
    changes.sessionToken.newValue !== changes.sessionToken.oldValue
  ) {
    lastSeenSessionKey = null;
    lastLoginSyncAt = 0;
    chrome.storage.local.remove("lastCoolbetSessionKey");
  }
  if (!changes.autoAlarm) return;
  if (changes.autoAlarm.newValue) {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 360 });
  } else {
    chrome.alarms.clear(ALARM_NAME);
  }
});
