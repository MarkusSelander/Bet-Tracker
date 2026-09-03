const apiUrlEl = document.getElementById("api-url");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const tokenEl = document.getElementById("token");
const autoHistoryEl = document.getElementById("auto-history");
const autoAlarmEl = document.getElementById("auto-alarm");
const messageEl = document.getElementById("message");

function showMessage(text, ok) {
  messageEl.hidden = false;
  messageEl.textContent = text;
  messageEl.className = `message ${ok ? "ok" : "error"}`;
}

async function load() {
  const state = await chrome.storage.local.get([
    "apiUrl",
    "sessionToken",
    "email",
    "autoOnHistory",
    "autoAlarm",
  ]);
  apiUrlEl.value = state.apiUrl || "";
  emailEl.value = state.email || "";
  tokenEl.value = state.sessionToken || "";
  autoHistoryEl.checked = state.autoOnHistory !== false;
  autoAlarmEl.checked = Boolean(state.autoAlarm);
}

async function saveExtras() {
  await chrome.storage.local.set({
    apiUrl: apiUrlEl.value.trim().replace(/\/$/, ""),
    email: emailEl.value.trim(),
    autoOnHistory: autoHistoryEl.checked,
    autoAlarm: autoAlarmEl.checked,
  });
}

document.getElementById("save").addEventListener("click", async () => {
  const token = tokenEl.value.trim();
  await saveExtras();
  if (token) {
    await chrome.storage.local.set({ sessionToken: token, lastStatus: "ok", lastError: "" });
  }
  showMessage("Lagret.", true);
});

document.getElementById("login").addEventListener("click", async () => {
  const apiUrl = apiUrlEl.value.trim().replace(/\/$/, "");
  const email = emailEl.value.trim();
  const password = passwordEl.value;
  if (!apiUrl || !email || !password) {
    showMessage("Fyll inn backend-URL, e-post og passord.", false);
    return;
  }

  try {
    await saveExtras();
    const response = await fetch(CoolbetHistory.loginUrl(apiUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      throw new Error(`Innlogging feilet (${response.status})`);
    }
    const data = await response.json();
    if (!data.session_token) {
      throw new Error("Svaret manglet session_token. Oppdater backend og prøv igjen.");
    }
    tokenEl.value = data.session_token;
    passwordEl.value = "";
    await chrome.storage.local.set({
      apiUrl,
      email,
      sessionToken: data.session_token,
      lastStatus: "ok",
      lastError: "",
    });
    showMessage("Innlogget. Token er lagret lokalt i utvidelsen.", true);
  } catch (err) {
    showMessage(String(err.message || err), false);
  }
});

load();
