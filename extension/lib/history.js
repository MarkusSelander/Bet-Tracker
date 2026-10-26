(function (root, factory) {
  const api = factory();
  root.CoolbetHistory = api;
  if (typeof module !== "undefined" && module && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function () {
  const HISTORY_PATH = "/s/sbgate/bets/history";
  const TICKET_STATUS =
    "all,WON,LOST,CONFIRMED,CANCELLED,PUSHED,PARTIALLY_WON,VOIDED,CASHED,PENDING";
  const PAGE_SIZE = "50";
  const MAX_HISTORY_PAGES = 400;
  const IMPORT_CHUNK_SIZE = 80;
  const OPEN_STATUSES = { PENDING: true, CONFIRMED: true };
  const COMBO_TYPES = { combo: true, system: true, betbuilder: true };
  const DIRECT_FETCH_LIMIT = 100;
  const DETAIL_FETCH_LIMIT = 80;

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
    return `${String(apiBase).replace(/\/$/, "")}/api/auth/google`;
  }

  function meUrl(apiBase) {
    return `${String(apiBase).replace(/\/$/, "")}/api/auth/me`;
  }

  function betsUrl(apiBase, bookie, options) {
    const base = `${String(apiBase).replace(/\/$/, "")}/api/bets/source-ids`;
    const params = new URLSearchParams();
    if (bookie) params.set("bookie", bookie);
    const view = options && typeof options === "object" ? options.view : "";
    if (view) params.set("view", String(view));
    const query = params.toString();
    return query ? `${base}?${query}` : base;
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

  function coolbetSessionKey(headers) {
    if (!headers || typeof headers !== "object") return "";
    const sessionId = String(headers.login_session_id || "").trim();
    if (sessionId) return `session:${sessionId}`;
    const userId = String(headers.user_id || "").trim();
    const token = String(headers.cbauth || "").trim();
    if (userId && token) return `user:${userId}`;
    return "";
  }

  function isCoolbetLoginRequest(url, method) {
    if (String(method || "GET").toUpperCase() !== "POST") return false;
    let parsed;
    try {
      parsed = new URL(String(url), "https://www.coolbet.com");
    } catch (_err) {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (host !== "www.coolbet.com" && host !== "coolbet.com") return false;
    const path = parsed.pathname.toLowerCase();
    if (/(^|\/)(logout|sign-?out)(\/|$)/.test(path)) return false;
    if (/(^|\/)(login|sign-?in|authenticate)(\/|$)/.test(path)) return true;
    return /\/auth\/sessions?(\/|$)/.test(path);
  }

  function collectTicketIds(tickets) {
    return (tickets || []).map((ticket) => ticket.id).filter(Boolean);
  }

  function collectKnownIdsFromBets(bets) {
    return (bets || []).map((bet) => bet && bet.source_id).filter(Boolean);
  }

  function mergeKnownIds(localIds, bets) {
    return Array.from(new Set([...(localIds || []), ...collectKnownIdsFromBets(bets)]));
  }

  // Lokale id-er kan peke på kuponger som aldri ble lagret på kontoen.
  // Når Spill-lista svarer, er den lista den eneste grunnen til å hoppe over import.
  function knownIdsForSync(localIds, bets, serverOk) {
    if (serverOk) return collectKnownIdsFromBets(bets);
    return (localIds || []).filter(Boolean);
  }

  function collectPendingIdsFromBets(bets) {
    return (bets || [])
      .filter((bet) => bet && bet.source_id && bet.status === "pending")
      .map((bet) => bet.source_id);
  }

  function storedBetLegCount(bet) {
    if (bet && bet.legs_count != null && Number.isFinite(Number(bet.legs_count))) {
      return Number(bet.legs_count);
    }
    if (Array.isArray(bet && bet.legs)) return bet.legs.length;
    return 0;
  }

  function isIncompleteStoredBet(bet) {
    if (!bet || !bet.source_id) return false;
    if (typeof bet.incomplete === "boolean") return bet.incomplete;
    const total = Number(bet.total_matches || 1);
    const type = String(bet.ticket_type || "").toLowerCase();
    if (total <= 1 && !COMBO_TYPES[type]) return false;
    return storedBetLegCount(bet) < Math.max(total, 2);
  }

  function collectIncompleteIdsFromBets(bets) {
    return (bets || []).filter(isIncompleteStoredBet).map((bet) => bet.source_id);
  }

  function isOpenTicket(ticket) {
    const status = String((ticket && ticket.status) || "").toUpperCase();
    return Boolean(OPEN_STATUSES[status]);
  }

  function shouldRefreshKnownTicket(ticket, pendingIds) {
    return Boolean(pendingIds && ticket && pendingIds.has(ticket.id));
  }

  function positiveInt(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function explicitFlag(value) {
    if (value === true || value === 1 || value === "1" || value === "true") return true;
    if (value === false || value === 0 || value === "0" || value === "false") return false;
    return null;
  }

  function historyPageSize(data) {
    const payload = data && typeof data === "object" ? data : {};
    return positiveInt(payload.pageSize ?? payload.page_size) || Number(PAGE_SIZE);
  }

  function historyTotalPages(data) {
    const payload = data && typeof data === "object" ? data : {};
    return positiveInt(
      payload.totalPages ?? payload.total_pages ?? payload.pageCount ?? payload.numberOfPages
    );
  }

  function historyTotalCount(data) {
    const payload = data && typeof data === "object" ? data : {};
    const value =
      payload.total ?? payload.totalCount ?? payload.totalElements ?? payload.totalTickets ?? payload.count;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  // Historikken er nyest først. En full side kan ha eldre kuponger bak seg
  // selv når hasNextPage mangler, så en full side betyr at vi leser videre.
  function resolveHasNextPage(data, page, tickets) {
    const payload = data && typeof data === "object" ? data : {};
    const currentPage = positiveInt(page) || 1;
    const pageTickets = Array.isArray(tickets) ? tickets : [];
    const pageSize = historyPageSize(payload);
    const totalPages = historyTotalPages(payload);
    if (pageTickets.length >= pageSize) return true;
    if (totalPages > 0) return currentPage < totalPages;
    const total = historyTotalCount(payload);
    if (total != null) return currentPage * pageSize < total;
    const flag = explicitFlag(
      payload.hasNextPage ?? payload.has_next_page ?? payload.hasMore ?? payload.has_more
    );
    return flag === true;
  }

  function pageAlreadySeen(tickets, seenIds) {
    const seen = seenIds instanceof Set ? seenIds : new Set(seenIds || []);
    if (seen.size === 0) return false;
    const ids = (tickets || []).map((ticket) => ticket && ticket.id).filter(Boolean);
    if (!ids.length) return false;
    return ids.every((id) => seen.has(id));
  }

  // Ikke stopp fordi en kupong-id allerede er lagret. Det skyver alle eldre
  // oppgjorte kuponger av, siden de ligger på senere sider.
  function shouldStopPagination({ tickets, hasNextPage, page }) {
    if (!tickets || tickets.length === 0) return true;
    if (typeof page === "number" && page >= MAX_HISTORY_PAGES) return true;
    return !hasNextPage;
  }

  function chunkTickets(tickets, size) {
    const list = Array.isArray(tickets) ? tickets : [];
    const chunkSize = positiveInt(size) || IMPORT_CHUNK_SIZE;
    const chunks = [];
    for (let index = 0; index < list.length; index += chunkSize) {
      chunks.push(list.slice(index, index + chunkSize));
    }
    return chunks;
  }

  function directTicketIds({ seenIds, pendingIds, incompleteIds, limit }) {
    const seen = seenIds instanceof Set ? seenIds : new Set(seenIds || []);
    const cap = limit == null ? DIRECT_FETCH_LIMIT : Number(limit);
    const safeCap = Number.isFinite(cap) && cap >= 0 ? cap : DIRECT_FETCH_LIMIT;
    const queued = new Set();
    const wanted = [];

    function push(id) {
      if (!id || queued.has(id) || seen.has(id) || isNumericDisplayId(id)) return;
      queued.add(id);
      wanted.push(id);
    }

    for (const id of pendingIds || []) push(id);
    for (const id of incompleteIds || []) push(id);
    return {
      ids: wanted.slice(0, safeCap),
      deferred: Math.max(0, wanted.length - safeCap),
    };
  }

  function ticketsNeedingDetails(tickets, knownIds, pendingIds, incompleteIds, skipIds) {
    const skip = skipIds instanceof Set ? skipIds : new Set(skipIds || []);
    return ticketsToImport(tickets, knownIds, pendingIds, incompleteIds).filter(
      (ticket) =>
        ticket &&
        ticket.id &&
        !skip.has(ticket.id) &&
        shouldFetchTicketDetails(ticket, knownIds, pendingIds, incompleteIds)
    );
  }

  function ticketFromDirectResponse(ticketId, detail) {
    if (Array.isArray(detail)) {
      return mergeTicketDetails({ id: ticketId }, detail);
    }
    const flat = detail && typeof detail === "object" ? detail : {};
    const nested =
      flat.ticket && typeof flat.ticket === "object" && !Array.isArray(flat.ticket) ? flat.ticket : {};
    const base = {
      ...flat,
      ...nested,
      id: nested.id || flat.id || ticketId,
    };
    return mergeTicketDetails(base, detail);
  }

  function hasImportableComboLegs(ticket) {
    const total = Number((ticket && ticket.total_matches) || 1);
    const type = String((ticket && ticket.ticket_type) || "").toLowerCase();
    if (total <= 1 && !COMBO_TYPES[type]) return false;
    return storedLegCount(ticket) >= 2;
  }

  function countComboTicketsWithLegs(tickets) {
    return (tickets || []).filter(hasImportableComboLegs).length;
  }

  function shouldFetchTicketDetails(ticket, knownIds, _pendingIds, incompleteIds) {
    if (!needsTicketDetails(ticket)) return false;
    if (shouldRefreshKnownTicket(ticket, incompleteIds)) return true;
    if (!knownIds || knownIds.size === 0) return true;
    if (!knownIds.has(ticket.id)) return true;
    return false;
  }

  function ticketsToImport(tickets, knownIds, pendingIds, incompleteIds) {
    if (!knownIds || knownIds.size === 0) return tickets || [];
    return (tickets || []).filter(
      (ticket) =>
        !knownIds.has(ticket.id) ||
        isOpenTicket(ticket) ||
        shouldRefreshKnownTicket(ticket, pendingIds) ||
        shouldRefreshKnownTicket(ticket, incompleteIds)
    );
  }

  function isNumericDisplayId(value) {
    return value != null && value !== "" && /^\d+$/.test(String(value));
  }

  function ticketDetailPaths(ticketId, _displayId) {
    // Coolbet 404s on /tickets/{display_id} and on UUID without ticketId=.
    if (!ticketId || isNumericDisplayId(ticketId)) return [];
    const id = encodeURIComponent(ticketId);
    return [`/s/sbgate/bets/tickets/${id}?language=eu&layout=EUROPEAN&ticketId=${id}`];
  }

  function storedLegCount(ticket) {
    if (Array.isArray(ticket.uniqueSelections) && ticket.uniqueSelections.length > 0) {
      return ticket.uniqueSelections.length;
    }
    if (Array.isArray(ticket.unique_selections) && ticket.unique_selections.length > 0) {
      return ticket.unique_selections.length;
    }
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
        (Array.isArray(candidate.uniqueSelections) && candidate.uniqueSelections.length > 0) ||
        (Array.isArray(candidate.unique_selections) && candidate.unique_selections.length > 0) ||
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
    if (payload.uniqueSelections) merged.uniqueSelections = payload.uniqueSelections;
    if (payload.unique_selections) merged.unique_selections = payload.unique_selections;
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

  function clampPercent(value) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  function historyPercent(page, totalPages, hasNextPage) {
    const safePage = Math.max(1, Number(page) || 1);
    if (totalPages && totalPages > 0) {
      return 12 + 56 * (safePage / totalPages);
    }
    if (hasNextPage === false) return 68;
    return 12 + 56 * (1 - 1 / (safePage + 1));
  }

  function computeSyncProgress(input) {
    const state = input && typeof input === "object" ? input : {};
    if (Number.isFinite(state.percent) && state.label && state.phase) {
      return {
        phase: state.phase,
        percent: clampPercent(state.percent),
        label: String(state.label),
      };
    }
    const phase = state.phase || "auth";
    const tickets = Number(state.tickets) || 0;
    const page = Number(state.page) || 1;
    const totalPages = Number(state.totalPages) || 0;
    const detailsDone = Number(state.detailsDone) || 0;
    const detailsTotal = Number(state.detailsTotal) || 0;

    if (phase === "done") {
      return { phase, percent: 100, label: "Ferdig" };
    }
    if (phase === "import") {
      return { phase, percent: 95, label: "Sender til Bet Tracker…" };
    }
    if (phase === "coolbet") {
      return { phase, percent: 10, label: "Åpner Coolbet…" };
    }
    if (phase === "details") {
      const ratio = detailsTotal > 0 ? detailsDone / detailsTotal : 0;
      return {
        phase,
        percent: clampPercent(70 + 20 * ratio),
        label: `Henter kupongdetaljer · ${detailsDone}/${detailsTotal}`,
      };
    }
    if (phase === "history") {
      const percent = clampPercent(historyPercent(page, totalPages, state.hasNextPage));
      return {
        phase,
        percent,
        label: `Henter historikk · side ${page} · ${tickets} kuponger`,
      };
    }
    return { phase: "auth", percent: 4, label: "Sjekker Bet Tracker…" };
  }

  return {
    HISTORY_PATH,
    TICKET_STATUS,
    PAGE_SIZE,
    MAX_HISTORY_PAGES,
    IMPORT_CHUNK_SIZE,
    DIRECT_FETCH_LIMIT,
    DETAIL_FETCH_LIMIT,
    authHeaders,
    betsUrl,
    collectIncompleteIdsFromBets,
    collectKnownIdsFromBets,
    collectPendingIdsFromBets,
    knownIdsForSync,
    mergeKnownIds,
    collectTicketIds,
    chunkTickets,
    countComboTicketsWithLegs,
    computeSyncProgress,
    directTicketIds,
    formatLastSync,
    historyQuery,
    historyUrl,
    importUrl,
    latestBetCreatedAt,
    coolbetSessionKey,
    isCoolbetLoginRequest,
    loginPayload,
    loginUrl,
    meUrl,
    mergeTicketDetails,
    needsTicketDetails,
    parseTimestamp,
    pageAlreadySeen,
    resolveHasNextPage,
    resolveLastSyncAt,
    shouldFetchTicketDetails,
    shouldStopPagination,
    ticketDetailPaths,
    ticketFromDirectResponse,
    ticketsNeedingDetails,
    ticketsToImport,
  };
});
