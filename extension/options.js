const apiUrlEl = document.getElementById("api-url");
const clientIdEl = document.getElementById("google-client-id");
const clientSecretEl = document.getElementById("google-client-secret");
const RETIRED_CLIENT_ID = "680779615178-1hjlo3l0cfc7b83rg1h65t1ir58123p3.apps.googleusercontent.com";
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
    "googleClientSecret",
    "firebaseApiKey",
    "firebaseAuthDomain",
    "autoOnHistory",
    "autoOnLogin",
    "autoAlarm",
  ]);
  apiUrlEl.value = state.apiUrl || "";
  const savedClientId = state.googleClientId || "";
  clientIdEl.value =
    savedClientId && savedClientId !== RETIRED_CLIENT_ID ? savedClientId : configuredValue({}, "googleClientId");
  clientSecretEl.value = state.googleClientSecret || "";
  firebaseKeyEl.value = configuredValue(state, "firebaseApiKey");
  authDomainEl.value = configuredValue(state, "firebaseAuthDomain");
  tokenEl.value = state.sessionToken || "";
  autoHistoryEl.checked = state.autoOnHistory !== false;
  document.getElementById("auto-login").checked = state.autoOnLogin !== false;
  autoAlarmEl.checked = Boolean(state.autoAlarm);
  const redirectEl = document.getElementById("redirect-uri");
  if (redirectEl && chrome.identity?.getRedirectURL) {
    redirectEl.value = chrome.identity.getRedirectURL();
  }
}

let preparedLogin = null;

async function prepareLogin() {
  const verifier = GoogleAuth.randomVerifier();
  const challenge = await GoogleAuth.codeChallenge(verifier);
  preparedLogin = { verifier, challenge, nonce: GoogleAuth.randomVerifier() };
}

function launchGooglePopup(clientId) {
  const redirectUri = chrome.identity.getRedirectURL();
  const prepared = preparedLogin;
  preparedLogin = null;
  prepareLogin();
  if (!prepared) {
    return Promise.reject(new Error("Innloggingen er ikke klar ennå. Prøv igjen."));
  }
  const url = GoogleAuth.googleAuthorizeUrl({
    clientId,
    redirectUri,
    challenge: prepared.challenge,
    nonce: prepared.nonce,
  });
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url, interactive: true }, (responseUrl) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else if (!responseUrl) reject(new Error("Innloggingen ble avbrutt."));
      else {
        try {
          resolve({
            redirectUri,
            code: GoogleAuth.authorizationCodeFromRedirect(responseUrl),
            verifier: prepared.verifier,
          });
        } catch (error) {
          reject(error);
        }
      }
    });
  });
}

async function saveExtras() {
  await chrome.storage.local.set({
    apiUrl: apiUrlEl.value.trim().replace(/\/$/, ""),
    googleClientId: clientIdEl.value.trim(),
    googleClientSecret: clientSecretEl.value.trim(),
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

document.getElementById("login").addEventListener("click", () => {
  const apiUrl = apiUrlEl.value.trim().replace(/\/$/, "");
  const clientId = clientIdEl.value.trim();
  const clientSecret = clientSecretEl.value.trim();
  const firebaseApiKey = firebaseKeyEl.value.trim();
  const authDomain = authDomainEl.value.trim();
  if (!apiUrl || !clientId || !clientSecret || !firebaseApiKey) {
    showMessage("Fyll inn backend-URL, Google-klient-ID, klient-hemmelighet og Firebase API-nøkkel.", false);
    return;
  }
  if (!chrome.identity?.launchWebAuthFlow || !chrome.identity.getRedirectURL) {
    showMessage("Denne Chrome-versjonen kan ikke åpne Google-innlogging.", false);
    return;
  }
  if (!preparedLogin) {
    showMessage("Innloggingen er ikke klar ennå. Prøv igjen.", false);
    prepareLogin();
    return;
  }

  const loginButton = document.getElementById("login");
  loginButton.disabled = true;
  showMessage("Åpner Google-innlogging…", true);
  // Chrome viser bare vinduet når kallet skjer i selve klikket, før noe await.
  const authPromise = launchGooglePopup(clientId);

  finishGoogleLogin({ apiUrl, clientId, clientSecret, firebaseApiKey, authDomain, authPromise })
    .catch((err) => showMessage(String(err.message || err), false))
    .finally(() => {
      loginButton.disabled = false;
    });
});

async function finishGoogleLogin({ apiUrl, clientId, clientSecret, firebaseApiKey, authDomain, authPromise }) {
  try {
    await saveExtras();
    const { redirectUri, code, verifier } = await authPromise;
    const firebaseData = await GoogleAuth.exchangeGoogleCode({
      clientId,
      clientSecret,
      firebaseApiKey,
      authDomain,
      redirectUri,
      code,
      verifier,
    });
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
      googleClientSecret: clientSecret,
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
}

load();
prepareLogin();
