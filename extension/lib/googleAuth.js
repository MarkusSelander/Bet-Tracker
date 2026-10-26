(function (root, factory) {
  const api = factory();
  root.GoogleAuth = api;
  if (typeof module !== "undefined" && module && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function () {
  function base64Url(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function randomVerifier() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return base64Url(bytes);
  }

  async function codeChallenge(verifier) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    return base64Url(new Uint8Array(digest));
  }

  function googleAuthorizeUrl({ clientId, redirectUri, challenge, nonce }) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      code_challenge: challenge,
      code_challenge_method: "S256",
      nonce,
      prompt: "select_account",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  function authorizationCodeFromRedirect(url) {
    const parsed = new URL(String(url));
    const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
    const code = parsed.searchParams.get("code") || hash.get("code");
    if (code) return code;
    const error = parsed.searchParams.get("error") || hash.get("error");
    if (error) {
      throw new Error(parsed.searchParams.get("error_description") || hash.get("error_description") || error);
    }
    throw new Error("Google returnerte ingen innloggingskode.");
  }

  function tokenRequestBody({ clientId, code, redirectUri, verifier }) {
    return new URLSearchParams({
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }).toString();
  }

  function firebaseSignInBody({ idToken, accessToken, requestUri }) {
    const credential = idToken
      ? `id_token=${encodeURIComponent(idToken)}&providerId=google.com`
      : `access_token=${encodeURIComponent(accessToken || "")}&providerId=google.com`;
    return {
      postBody: credential,
      requestUri: requestUri || "http://localhost",
      returnIdpCredential: true,
      returnSecureToken: true,
    };
  }

  async function signInWithFirebase({
    firebaseApiKey,
    authDomain,
    redirectUri,
    idToken,
    accessToken,
    fetchImpl,
  }) {
    const fetchFn = fetchImpl || fetch;
    const domain = String(authDomain || "")
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");
    const requestUri = domain ? `https://${domain}` : redirectUri;
    const firebaseResponse = await fetchFn(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(firebaseApiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          firebaseSignInBody({
            idToken,
            accessToken,
            requestUri,
          })
        ),
      }
    );
    const firebaseData = await firebaseResponse.json().catch(() => ({}));
    if (!firebaseResponse.ok || !firebaseData.idToken) {
      throw new Error(firebaseData.error?.message || "Firebase avviste Google-kontoen.");
    }
    return firebaseData;
  }

  async function exchangeGoogleCode({
    clientId,
    firebaseApiKey,
    authDomain,
    redirectUri,
    code,
    verifier,
    fetchImpl,
  }) {
    const fetchFn = fetchImpl || fetch;
    const tokenResponse = await fetchFn("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenRequestBody({ clientId, code, redirectUri, verifier }),
    });
    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || (!tokenData.id_token && !tokenData.access_token)) {
      throw new Error(tokenData.error_description || "Google avviste innloggingen.");
    }
    return signInWithFirebase({
      firebaseApiKey,
      authDomain,
      redirectUri,
      idToken: tokenData.id_token,
      accessToken: tokenData.access_token,
      fetchImpl,
    });
  }

  async function exchangeGoogleAccessToken({ firebaseApiKey, authDomain, accessToken, fetchImpl }) {
    if (!accessToken) throw new Error("Google returnerte ikke noe token.");
    return signInWithFirebase({ firebaseApiKey, authDomain, accessToken, fetchImpl });
  }

  return {
    authorizationCodeFromRedirect,
    codeChallenge,
    exchangeGoogleAccessToken,
    exchangeGoogleCode,
    firebaseSignInBody,
    googleAuthorizeUrl,
    randomVerifier,
    tokenRequestBody,
  };
});
