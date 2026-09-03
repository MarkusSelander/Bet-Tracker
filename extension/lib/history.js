(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.CoolbetHistory = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  const HISTORY_PATH = "/s/sbgate/bets/history";
  const TICKET_STATUS =
    "all,WON,LOST,CONFIRMED,CANCELLED,PUSHED,PARTIALLY_WON,VOIDED,CASHED,PENDING";
  const PAGE_SIZE = "50";
  const OPEN_STATUSES = { PENDING: true, CONFIRMED: true };

  function historyQuery(pageNumber) {
    return {
      isCampaign: "false",
      isCashout: "true",
      language: "eu",
      layout: "EUROPEAN",
      pageNumber: String(pageNumber),
      pageSize: PAGE_SIZE,
      ticketStatus: TICKET_STATUS,
    };
  }

  function historyUrl(pageNumber) {
    const params = new URLSearchParams(historyQuery(pageNumber));
    return `${HISTORY_PATH}?${params.toString()}`;
  }

  function importUrl(apiBase) {
    return `${String(apiBase).replace(/\/$/, "")}/api/bets/import/coolbet`;
  }

  function loginUrl(apiBase) {
    return `${String(apiBase).replace(/\/$/, "")}/api/auth/login`;
  }

  function meUrl(apiBase) {
    return `${String(apiBase).replace(/\/$/, "")}/api/auth/me`;
  }

  function authHeaders(token) {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  function loginPayload(userDoc, sessionToken) {
    return { ...userDoc, session_token: sessionToken };
  }

  function shouldStopPagination({ tickets, hasNextPage, knownIds }) {
    if (!hasNextPage || !tickets || tickets.length === 0) return true;
    if (!knownIds || knownIds.size === 0) return false;
    const allKnown = tickets.every((ticket) => knownIds.has(ticket.id));
    if (!allKnown) return false;
    const anyOpen = tickets.some((ticket) => {
      const status = String(ticket.status || "").toUpperCase();
      return Boolean(OPEN_STATUSES[status]);
    });
    return !anyOpen;
  }

  function collectTicketIds(tickets) {
    return (tickets || []).map((ticket) => ticket.id).filter(Boolean);
  }

  return {
    HISTORY_PATH,
    TICKET_STATUS,
    PAGE_SIZE,
    authHeaders,
    collectTicketIds,
    historyQuery,
    historyUrl,
    importUrl,
    loginPayload,
    loginUrl,
    meUrl,
    shouldStopPagination,
  };
});
