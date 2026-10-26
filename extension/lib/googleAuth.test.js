const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  authorizationCodeFromRedirect,
  codeChallenge,
  exchangeGoogleAccessToken,
  exchangeGoogleCode,
  firebaseSignInBody,
  googleAuthorizeUrl,
  randomVerifier,
  tokenRequestBody,
} = require("./googleAuth.js");

test("pkce challenge matches the RFC 7636 vector", async () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  assert.equal(await codeChallenge(verifier), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

test("verifier is url-safe and long enough for PKCE", () => {
  const verifier = randomVerifier();
  assert.match(verifier, /^[A-Za-z0-9_-]+$/);
  assert.ok(verifier.length >= 43);
});

test("google authorize url asks for an authorization code", () => {
  const url = new URL(
    googleAuthorizeUrl({
      clientId: "client.apps.googleusercontent.com",
      redirectUri: "https://abc.chromiumapp.org/",
      challenge: "challenge",
      nonce: "nonce",
    })
  );
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("client_id"), "client.apps.googleusercontent.com");
  assert.equal(url.searchParams.get("redirect_uri"), "https://abc.chromiumapp.org/");
});

test("redirect parser reads the code and surfaces Google errors", () => {
  assert.equal(
    authorizationCodeFromRedirect("https://abc.chromiumapp.org/?code=xyz&scope=openid"),
    "xyz"
  );
  assert.throws(
    () => authorizationCodeFromRedirect("https://abc.chromiumapp.org/?error=access_denied&error_description=Avbrutt"),
    /Avbrutt/
  );
});

test("token and firebase bodies keep the Google credential", () => {
  const body = new URLSearchParams(
    tokenRequestBody({
      clientId: "client",
      code: "code",
      redirectUri: "https://abc.chromiumapp.org/",
      verifier: "verifier",
    })
  );
  assert.equal(body.get("grant_type"), "authorization_code");
  assert.equal(body.get("code_verifier"), "verifier");
  assert.equal(body.get("client_secret"), null);
  const withSecret = new URLSearchParams(
    tokenRequestBody({
      clientId: "client",
      clientSecret: "secret",
      code: "code",
      redirectUri: "https://abc.chromiumapp.org/",
      verifier: "verifier",
    })
  );
  assert.equal(withSecret.get("client_secret"), "secret");
  assert.equal(
    firebaseSignInBody({ idToken: "a b", requestUri: "https://app.firebaseapp.com" }).postBody,
    "id_token=a%20b&providerId=google.com"
  );
});

test("exchange turns a Google code into a Firebase id token", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), body: options.body });
    if (String(url).includes("oauth2.googleapis.com")) {
      return {
        ok: true,
        json: async () => ({ id_token: "google.jwt.token", access_token: "ya29" }),
      };
    }
    return {
      ok: true,
      json: async () => ({ idToken: "firebase-token", email: "a@b.c", displayName: "A" }),
    };
  };

  const result = await exchangeGoogleCode({
    clientId: "client",
    firebaseApiKey: "key",
    authDomain: "https://app.firebaseapp.com/",
    redirectUri: "https://abc.chromiumapp.org/",
    code: "code",
    verifier: "verifier",
    fetchImpl,
  });

  assert.equal(result.idToken, "firebase-token");
  assert.match(calls[1].url, /key=key/);
  assert.match(calls[1].body, /id_token=google\.jwt\.token/);
  assert.match(calls[1].body, /https:\/\/app\.firebaseapp\.com/);
});

test("chrome access token is exchanged directly with Firebase", async () => {
  let body = "";
  const result = await exchangeGoogleAccessToken({
    firebaseApiKey: "key",
    authDomain: "app.firebaseapp.com",
    accessToken: "ya29.token",
    fetchImpl: async (_url, options) => {
      body = options.body;
      return { ok: true, json: async () => ({ idToken: "firebase-token" }) };
    },
  });
  assert.equal(result.idToken, "firebase-token");
  assert.match(body, /access_token=ya29\.token/);
  assert.match(body, /https:\/\/app\.firebaseapp\.com/);
});
