(function () {
  if (window.__coolbetSyncInjected) return;
  window.__coolbetSyncInjected = true;

  function headersToObject(headers) {
    const out = {};
    if (!headers) return out;
    if (typeof headers.forEach === "function") {
      headers.forEach((value, key) => {
        out[String(key).toLowerCase()] = value;
      });
      return out;
    }
    if (Array.isArray(headers)) {
      for (const pair of headers) {
        if (pair && pair.length >= 2) out[String(pair[0]).toLowerCase()] = pair[1];
      }
      return out;
    }
    for (const [key, value] of Object.entries(headers)) {
      out[String(key).toLowerCase()] = value;
    }
    return out;
  }

  function publish(headers) {
    if (!headers || !headers.cbauth) return;
    window.postMessage(
      {
        source: "coolbet-sync",
        type: "AUTH_HEADERS",
        headers: {
          cbauth: headers.cbauth,
          login_session_id: headers.login_session_id || "",
          user_id: headers.user_id || "",
        },
      },
      "https://www.coolbet.com"
    );
  }

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === "string" ? input : input && input.url;
      if (url && String(url).includes("bets/history")) {
        const fromInit = init && init.headers;
        const fromInput = input && input.headers;
        publish(headersToObject(fromInit || fromInput));
      }
    } catch (_err) {
      /* ignore */
    }
    return origFetch.apply(this, arguments);
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSet = XMLHttpRequest.prototype.setRequestHeader;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__coolbetUrl = url;
    this.__coolbetHeaders = {};
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (this.__coolbetHeaders) this.__coolbetHeaders[String(name).toLowerCase()] = value;
    return origSet.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    try {
      if (this.__coolbetUrl && String(this.__coolbetUrl).includes("bets/history")) {
        publish(this.__coolbetHeaders);
      }
    } catch (_err) {
      /* ignore */
    }
    return origSend.apply(this, arguments);
  };
})();
