const statusEl = document.getElementById("status");
const lastSyncEl = document.getElementById("last-sync");
const resultEl = document.getElementById("result");
const errorEl = document.getElementById("error");
const syncBtn = document.getElementById("sync-now");

const STATUS_TEXT = {
  ok: "OK — synkronisert",
  syncing: "Synker…",
  need_coolbet: "Logg inn på Coolbet",
  need_bet_tracker: "Logg inn på Bet Tracker",
  error: "Feil under synk",
};

function render(state) {
  const lastSyncAt = CoolbetHistory.resolveLastSyncAt(state);
  const status = state.lastStatus || (state.sessionToken ? "ok" : "need_bet_tracker");
  statusEl.textContent = STATUS_TEXT[status] || STATUS_TEXT.error;
  statusEl.className = `status ${status === "ok" ? "ok" : status === "need_coolbet" || status === "need_bet_tracker" ? "warn" : status === "syncing" ? "" : "error"}`;
  lastSyncEl.textContent = CoolbetHistory.formatLastSync(lastSyncAt);
  if (state.lastResult && status === "ok") {
    const r = state.lastResult;
    resultEl.textContent = `${r.fetched || 0} hentet · ${r.imported || 0} nye · ${r.updated || 0} oppdatert`;
  } else {
    resultEl.textContent = "";
  }
  if (state.lastError && status === "error") {
    errorEl.hidden = false;
    errorEl.textContent = state.lastError;
  } else {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }
  syncBtn.disabled = status === "syncing";
}

async function readState() {
  const local = await chrome.storage.local.get(null);
  const fromMessage = await chrome.runtime.sendMessage({ type: "GET_STATE" }).catch(() => null);
  return { ...(fromMessage || {}), ...local };
}

async function hydrateLastSync(state) {
  const existing = CoolbetHistory.resolveLastSyncAt(state);
  if (existing || !state.apiUrl || !state.sessionToken) return state;

  const headers = CoolbetHistory.authHeaders(state.sessionToken);
  try {
    const meResponse = await fetch(CoolbetHistory.meUrl(state.apiUrl), {
      headers,
      credentials: "omit",
    });
    if (meResponse.ok) {
      const remoteTs = CoolbetHistory.resolveLastSyncAt(await meResponse.json());
      if (remoteTs) {
        await chrome.storage.local.set({ lastSyncAt: remoteTs });
        return { ...state, lastSyncAt: remoteTs };
      }
    }

    const betsResponse = await fetch(CoolbetHistory.betsUrl(state.apiUrl, "Coolbet"), {
      headers,
      credentials: "omit",
    });
    if (!betsResponse.ok) return state;
    const remoteTs = CoolbetHistory.latestBetCreatedAt(await betsResponse.json());
    if (!remoteTs) return state;
    await chrome.storage.local.set({ lastSyncAt: remoteTs });
    return { ...state, lastSyncAt: remoteTs };
  } catch (_err) {
    return state;
  }
}

async function refresh() {
  const state = await hydrateLastSync(await readState());
  render(state || {});
}

syncBtn.addEventListener("click", async () => {
  syncBtn.disabled = true;
  statusEl.textContent = STATUS_TEXT.syncing;
  await chrome.runtime.sendMessage({ type: "RUN_SYNC" });
  await refresh();
});

document.getElementById("open-options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.lastSyncAt || changes.lastStatus || changes.lastResult || changes.lastError) {
    refresh();
  }
});

refresh();
