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

function formatTime(ts) {
  if (!ts) return "Sist synket: aldri";
  return `Sist synket: ${new Date(ts).toLocaleString("nb-NO")}`;
}

function render(state) {
  const status = state.lastStatus || (state.sessionToken ? "ok" : "need_bet_tracker");
  statusEl.textContent = STATUS_TEXT[status] || STATUS_TEXT.error;
  statusEl.className = `status ${status === "ok" ? "ok" : status === "need_coolbet" || status === "need_bet_tracker" ? "warn" : status === "syncing" ? "" : "error"}`;
  lastSyncEl.textContent = formatTime(state.lastSyncAt);
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

async function refresh() {
  const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
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

refresh();
