const apiUrlEl = document.getElementById("api-url");
const clientIdEl = document.getElementById("google-client-id");
const firebaseKeyEl = document.getElementById("firebase-api-key");
const authDomainEl = document.getElementById("firebase-auth-domain");
const tokenEl = document.getElementById("token");
const autoHistoryEl = document.getElementById("auto-history");
const autoAlarmEl = document.getElementById("auto-alarm");
const messageEl = document.getElementById("message");
const defaults = globalThis.BET_TRACKER_AUTH || {};

function showMessage(text, ok) {
  messageEl.hidden = false;
  messageEl.textContent = text;
  messageEl.className = `message ${ok ? "ok" : "error"}`;
}

function configuredValue(stored, key) {
  return stored[key] || defaults[key] || "";
}

async function load() {
  const state = await chrome.storage.local.get([
    "apiUrl",
    "sessionToken",
    "googleClientId",
    "firebaseApiKey",
    "firebaseAuthDomain",
    "autoOnHistory",
    "autoOnLogin",
    "autoAlarm",
  ]);
  apiUrlEl.value = state.apiUrl || "";
  clientIdEl.value = manifestClientId() || configuredValue(state, "googleClientId");
  firebaseKeyEl.value = configuredValue(state, "firebaseApiKey");
  authDomainEl.value = configuredValue(state, "firebaseAuthDomain");
  tokenEl.value = state.sessionToken || "";
  autoHistoryEl.checked = state.autoOnHistory !== false;
  document.getElementById("auto-login").checked = state.autoOnLogin !== false;
  autoAlarmEl.checked = Boolean(state.autoAlarm);
}

function manifestClientId() {
  return chrome.runtime?.getManifest?.()?.oauth2?.client_id || "";
}

function chromeAccessToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else if (!token) reject(new Error("Google returnerte ikke noe token."));
      else resolve(token);
    });
  });
}

function forgetAccessToken(token) {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

async function saveExtras() {
  await chrome.storage.local.set({
    apiUrl: apiUrlEl.value.trim().replace(/\/$/, ""),
    googleClientId: clientIdEl.value.trim(),
    firebaseApiKey: firebaseKeyEl.value.trim(),
    firebaseAuthDomain: authDomainEl.value.trim(),
    autoOnHistory: autoHistoryEl.checked,
    autoOnLogin: document.getElementById("auto-login").checked,
    autoAlarm: autoAlarmEl.checked,
  });
}

document.getElementById("save").addEventListener("click", async () => {
  const token = tokenEl.value.trim();
  await saveExtras();
  if (token) {
    const extras = { sessionToken: token, lastError: "" };
    const stored = await chrome.storage.local.get(["lastSyncAt"]);
    if (stored.lastSyncAt) extras.lastStatus = "ok";
    await chrome.storage.local.set(extras);
  }
  showMessage("Lagret.", true);
});

document.getElementById("login").addEventListener("click", async () => {
  const apiUrl = apiUrlEl.value.trim().replace(/\/$/, "");
  const clientId = clientIdEl.value.trim() || manifestClientId();
  const firebaseApiKey = firebaseKeyEl.value.trim();
  const authDomain = authDomainEl.value.trim();
  if (!apiUrl || !clientId || !firebaseApiKey) {
    showMessage("Fyll inn backend-URL, Google-klient-ID og Firebase API-nøkkel.", false);
    return;
  }
  const useChromeToken = Boolean(manifestClientId() && chrome.identity?.getAuthToken);
  if (!useChromeToken && (!chrome.identity?.launchWebAuthFlow || !chrome.identity.getRedirectURL)) {
    showMessage("Denne Chrome-versjonen kan ikke åpne Google-innlogging.", false);
    return;
  }

  try {
    await saveExtras();
    let firebaseData;
    if (useChromeToken) {
      const accessToken = await chromeAccessToken();
      try {
        firebaseData = await GoogleAuth.exchangeGoogleAccessToken({
          firebaseApiKey,
          authDomain,
          accessToken,
        });
      } catch (err) {
        await forgetAccessToken(accessToken);
        throw err;
      }
    } else {
      const redirectUri = chrome.identity.getRedirectURL();
      const verifier = GoogleAuth.randomVerifier();
      const challenge = await GoogleAuth.codeChallenge(verifier);
      const nonce = GoogleAuth.randomVerifier();
      const url = GoogleAuth.googleAuthorizeUrl({ clientId, redirectUri, challenge, nonce });
      const redirected = await new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({ url, interactive: true }, (responseUrl) => {
          const err = chrome.runtime.lastError;
          if (err) reject(new Error(err.message));
          else resolve(responseUrl);
        });
      });
      if (!redirected) throw new Error("Innloggingen ble avbrutt.");
      const code = GoogleAuth.authorizationCodeFromRedirect(redirected);
      firebaseData = await GoogleAuth.exchangeGoogleCode({
        clientId,
        firebaseApiKey,
        authDomain,
        redirectUri,
        code,
        verifier,
      });
    }
    const response = await fetch(CoolbetHistory.loginUrl(apiUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify({
        id_token: firebaseData.idToken,
        name: firebaseData.displayName || "",
      }),
    });
    if (!response.ok) {
      throw new Error(`Innlogging feilet (${response.status})`);
    }
    const data = await response.json();
    if (!data.session_token) {
      throw new Error("Svaret manglet session_token. Oppdater backend og prøv igjen.");
    }
    tokenEl.value = data.session_token;
    const lastSyncAt = CoolbetHistory.resolveLastSyncAt(data);
    await chrome.storage.local.set({
      apiUrl,
      googleClientId: clientId,
      firebaseApiKey,
      firebaseAuthDomain: authDomain,
      sessionToken: data.session_token,
      lastError: "",
      ...(lastSyncAt ? { lastSyncAt, lastStatus: "ok" } : {}),
    });
    showMessage("Innlogget med Google. Token er lagret lokalt i utvidelsen.", true);
  } catch (err) {
    showMessage(String(err.message || err), false);
  }
});

load();
