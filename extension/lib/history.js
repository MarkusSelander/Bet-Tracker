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
  const COMBO_TYPES = { combo: true, system: true, betbuilder: true };

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

  function betsUrl(apiBase, bookie) {
    const base = `${String(apiBase).replace(/\/$/, "")}/api/bets`;
    if (!bookie) return base;
    return `${base}?bookie=${encodeURIComponent(bookie)}`;
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

  function ticketDetailPaths(ticketId, displayId) {
    const query = "language=eu&layout=EUROPEAN";
    const ids = [ticketId];
    if (displayId != null && String(displayId) !== String(ticketId)) {
      ids.push(displayId);
    }
    const paths = [];
    for (const rawId of ids) {
      const id = encodeURIComponent(rawId);
      paths.push(`/s/sbgate/bets/${id}?${query}`, `/s/sbgate/bets/ticket/${id}?${query}`);
    }
    return paths;
  }

  function storedLegCount(ticket) {
    if (Array.isArray(ticket.matches) && ticket.matches.length > 0) return ticket.matches.length;
    if (Array.isArray(ticket.legs) && ticket.legs.length > 0) return ticket.legs.length;
    if (!Array.isArray(ticket.bets)) return 0;
    return ticket.bets.reduce((sum, bet) => {
      if (!bet) return sum;
      if (Array.isArray(bet.matches) && bet.matches.length > 0) return sum + bet.matches.length;
      if (Array.isArray(bet.legs) && bet.legs.length > 0) return sum + bet.legs.length;
      if (Array.isArray(bet.selections) && bet.selections.length > 0) return sum + bet.selections.length;
      return sum;
    }, 0);
  }

  function needsTicketDetails(ticket) {
    if (!ticket || !ticket.id) return false;
    const total = Number(ticket.total_matches || 1);
    const type = String(ticket.ticket_type || "").toLowerCase();
    if (total <= 1 && !COMBO_TYPES[type]) return false;
    return storedLegCount(ticket) < Math.max(total, 2);
  }

  function unwrapTicketPayload(detail) {
    if (Array.isArray(detail)) {
      return { matches: detail.filter((item) => item && typeof item === "object") };
    }
    if (!detail || typeof detail !== "object") return {};

    const candidates = [detail];
    for (const key of ["ticket", "data", "result", "bet"]) {
      const nested = detail[key];
      if (nested && typeof nested === "object" && !Array.isArray(nested)) {
        candidates.push(nested);
      } else if (Array.isArray(nested) && nested.length > 0) {
        return { matches: nested.filter((item) => item && typeof item === "object") };
      }
    }

    for (const candidate of candidates) {
      if (
        (Array.isArray(candidate.matches) && candidate.matches.length > 0) ||
        (Array.isArray(candidate.bets) && candidate.bets.length > 0) ||
        (Array.isArray(candidate.legs) && candidate.legs.length > 0) ||
        (Array.isArray(candidate.selections) && candidate.selections.length > 0)
      ) {
        return candidate;
      }
    }
    return detail;
  }

  function mergeTicketDetails(ticket, detail) {
    const payload = unwrapTicketPayload(detail);
    const merged = { ...ticket };
    if (payload.matches) merged.matches = payload.matches;
    if (payload.bets) merged.bets = payload.bets;
    if (payload.legs) merged.legs = payload.legs;
    if (payload.selections && !merged.matches) merged.matches = payload.selections;
    return merged;
  }

  function parseTimestamp(value) {
    if (value == null || value === "") return null;
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
    if (value instanceof Date) {
      const ms = value.getTime();
      return Number.isFinite(ms) && ms > 0 ? ms : null;
    }
    if (typeof value === "string") {
      const asNum = Number(value);
      if (Number.isFinite(asNum) && asNum > 0) return asNum;
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }
    return null;
  }

  function resolveLastSyncAt(state) {
    if (!state || typeof state !== "object") return null;
    return parseTimestamp(state.lastSyncAt) || parseTimestamp(state.last_coolbet_sync_at);
  }

  function latestBetCreatedAt(bets) {
    let latest = null;
    for (const bet of bets || []) {
      const ts = parseTimestamp(bet && bet.created_at);
      if (ts && (latest == null || ts > latest)) latest = ts;
    }
    return latest;
  }

  function formatLastSync(ts) {
    const resolved = parseTimestamp(ts);
    if (!resolved) return "Sist synket: aldri";
    return `Sist synket: ${new Date(resolved).toLocaleString("nb-NO")}`;
  }

  return {
    HISTORY_PATH,
    TICKET_STATUS,
    PAGE_SIZE,
    authHeaders,
    betsUrl,
    collectTicketIds,
    formatLastSync,
    historyQuery,
    historyUrl,
    importUrl,
    latestBetCreatedAt,
    loginPayload,
    loginUrl,
    meUrl,
    mergeTicketDetails,
    needsTicketDetails,
    parseTimestamp,
    resolveLastSyncAt,
    shouldStopPagination,
    ticketDetailPaths,
  };
});
