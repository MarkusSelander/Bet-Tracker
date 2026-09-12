const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  HISTORY_PATH,
  authHeaders,
  betsUrl,
  collectIncompleteIdsFromBets,
  collectKnownIdsFromBets,
  collectPendingIdsFromBets,
  computeSyncProgress,
  formatLastSync,
  historyQuery,
  importUrl,
  latestBetCreatedAt,
  loginPayload,
  mergeTicketDetails,
  needsTicketDetails,
  resolveLastSyncAt,
  shouldFetchTicketDetails,
  shouldStopPagination,
  ticketDetailPaths,
  ticketsToImport,
} = require("./history.js");

test("history query matches Coolbet API contract", () => {
  const query = historyQuery(2);
  assert.equal(HISTORY_PATH, "/s/sbgate/bets/history");
  assert.equal(query.isCampaign, "false");
  assert.equal(query.isCashout, "true");
  assert.equal(query.language, "eu");
  assert.equal(query.layout, "EUROPEAN");
  assert.equal(query.pageNumber, "2");
  assert.equal(query.pageSize, "50");
  assert.ok(query.ticketStatus.includes("WON"));
  assert.ok(query.ticketStatus.includes("PENDING"));
  assert.ok(query.ticketStatus.startsWith("all,"));
});

test("import url strips trailing slash", () => {
  assert.equal(
    importUrl("https://api.example.com/"),
    "https://api.example.com/api/bets/import/coolbet"
  );
});

test("auth headers use bearer token", () => {
  assert.equal(authHeaders("session_abc").Authorization, "Bearer session_abc");
});

test("login payload keeps user fields and session token", () => {
  const payload = loginPayload({ email: "a@b.c" }, "session_xyz");
  assert.equal(payload.session_token, "session_xyz");
  assert.equal(payload.email, "a@b.c");
});

test("stops when page is all known settled tickets", () => {
  assert.equal(
    shouldStopPagination({
      tickets: [
        { id: "a", status: "WON" },
        { id: "b", status: "LOST" },
      ],
      hasNextPage: true,
      knownIds: new Set(["a", "b"]),
    }),
    true
  );
});

test("continues when unknown or pending tickets remain", () => {
  assert.equal(
    shouldStopPagination({
      tickets: [
        { id: "a", status: "WON" },
        { id: "new", status: "WON" },
      ],
      hasNextPage: true,
      knownIds: new Set(["a"]),
    }),
    false
  );
  assert.equal(
    shouldStopPagination({
      tickets: [{ id: "a", status: "PENDING" }],
      hasNextPage: true,
      knownIds: new Set(["a"]),
    }),
    false
  );
});

test("keeps paging while Bet Tracker still has unseen pending tickets", () => {
  assert.equal(
    shouldStopPagination({
      tickets: [
        { id: "a", status: "LOST" },
        { id: "b", status: "LOST" },
      ],
      hasNextPage: true,
      knownIds: new Set(["a", "b"]),
      pendingIds: new Set(["older-open"]),
    }),
    false
  );
});

test("keeps paging while Bet Tracker still has incomplete settled combos", () => {
  assert.equal(
    shouldStopPagination({
      tickets: [
        { id: "a", status: "LOST" },
        { id: "b", status: "WON" },
      ],
      hasNextPage: true,
      knownIds: new Set(["a", "b"]),
      incompleteIds: new Set(["older-combo"]),
    }),
    false
  );
});

test("collectPendingIdsFromBets keeps only open tracker bets", () => {
  assert.deepEqual(
    collectPendingIdsFromBets([
      { source_id: "open", status: "pending" },
      { source_id: "done", status: "lost" },
      { status: "pending" },
    ]),
    ["open"]
  );
});

test("collectIncompleteIdsFromBets keeps combos with fewer stored legs than total_matches", () => {
  assert.deepEqual(
    collectIncompleteIdsFromBets([
      {
        source_id: "incomplete-settled",
        status: "won",
        ticket_type: "combo",
        total_matches: 5,
        legs_count: 1,
      },
      {
        source_id: "complete-settled",
        status: "lost",
        ticket_type: "combo",
        total_matches: 2,
        legs_count: 2,
      },
      {
        source_id: "single",
        status: "won",
        ticket_type: "single",
        total_matches: 1,
        legs_count: 1,
      },
      {
        source_id: "incomplete-pending",
        status: "pending",
        ticket_type: "combo",
        total_matches: 3,
        legs: [{ match: "A - B" }],
      },
    ]),
    ["incomplete-settled", "incomplete-pending"]
  );
});

test("collectKnownIdsFromBets uses backend source_id", () => {
  assert.deepEqual(
    collectKnownIdsFromBets([
      { bet_id: "1", source_id: "ticket-a" },
      { bet_id: "2" },
      { source_id: "ticket-b" },
    ]),
    ["ticket-a", "ticket-b"]
  );
});

test("bets url uses source-ids endpoint", () => {
  assert.equal(
    betsUrl("https://api.example.com/", "Coolbet"),
    "https://api.example.com/api/bets/source-ids?bookie=Coolbet"
  );
});

test("reimports known tickets that settled after we stored them as pending", () => {
  const tickets = [
    { id: "old-won", status: "WON" },
    { id: "was-open", status: "LOST" },
  ];
  const imported = ticketsToImport(
    tickets,
    new Set(["old-won", "was-open"]),
    new Set(["was-open"])
  );
  assert.deepEqual(
    imported.map((ticket) => ticket.id),
    ["was-open"]
  );
});

test("fetches combo details when a known ticket is still pending in Bet Tracker", () => {
  const combo = {
    id: "was-open",
    total_matches: 2,
    ticket_type: "combo",
    status: "LOST",
  };
  assert.equal(
    shouldFetchTicketDetails(combo, new Set(["was-open"]), new Set(["was-open"])),
    true
  );
});

test("skips detail fetch for known settled combos", () => {
  const combo = { id: "a", total_matches: 2, ticket_type: "combo", status: "WON" };
  const pending = { id: "b", total_matches: 2, ticket_type: "combo", status: "PENDING" };
  const fresh = { id: "c", total_matches: 2, ticket_type: "combo", status: "WON" };
  const known = new Set(["a", "b"]);
  assert.equal(shouldFetchTicketDetails(combo, known), false);
  assert.equal(shouldFetchTicketDetails(pending, known), true);
  assert.equal(shouldFetchTicketDetails(fresh, known), true);
  assert.equal(shouldFetchTicketDetails(combo, new Set()), true);
});

test("fetches details for known settled combos missing stored legs", () => {
  const combo = { id: "a", total_matches: 5, ticket_type: "combo", status: "WON" };
  const known = new Set(["a"]);
  assert.equal(shouldFetchTicketDetails(combo, known, new Set(), new Set(["a"])), true);
  assert.equal(shouldFetchTicketDetails(combo, known, new Set(), new Set()), false);
});

test("reimports known settled tickets that are missing stored legs", () => {
  const tickets = [
    { id: "complete-won", status: "WON" },
    { id: "incomplete-combo", status: "WON" },
  ];
  const imported = ticketsToImport(
    tickets,
    new Set(["complete-won", "incomplete-combo"]),
    new Set(),
    new Set(["incomplete-combo"])
  );
  assert.deepEqual(
    imported.map((ticket) => ticket.id),
    ["incomplete-combo"]
  );
});

test("import only unknown or open tickets when known ids exist", () => {
  const tickets = [
    { id: "old", status: "WON" },
    { id: "open", status: "PENDING" },
    { id: "new", status: "WON" },
  ];
  const imported = ticketsToImport(tickets, new Set(["old", "open"]));
  assert.deepEqual(
    imported.map((ticket) => ticket.id),
    ["open", "new"]
  );
  assert.equal(ticketsToImport(tickets, new Set()).length, 3);
});

test("combo tickets need details until matches exist", () => {
  assert.equal(needsTicketDetails({ id: "a", total_matches: 2, ticket_type: "combo" }), true);
  assert.equal(needsTicketDetails({ id: "b", ticket_type: "system" }), true);
  assert.equal(needsTicketDetails({ id: "c", total_matches: 1, ticket_type: "single" }), false);
  assert.equal(
    needsTicketDetails({ id: "d", total_matches: 2, matches: [{ match_name: "A - B" }] }),
    true
  );
  assert.equal(
    needsTicketDetails({
      id: "e",
      total_matches: 2,
      matches: [{ match_name: "A - B" }, { match_name: "C - D" }],
    }),
    false
  );
});

test("ticket detail paths include ticket id", () => {
  const uuid = "26090221-4ce1-4145-b10d-387fb0146ecd";
  const paths = ticketDetailPaths(uuid, 1949);
  assert.deepEqual(paths, [
    `/s/sbgate/bets/tickets/${uuid}?language=eu&layout=EUROPEAN&ticketId=${uuid}`,
  ]);
});

test("ticket detail paths never request display_id like 2004", () => {
  const uuid = "26091203-0b1b-4bd4-8d33-87f7263e9dd7";
  const paths = ticketDetailPaths(uuid, 2004);
  assert.deepEqual(paths, [
    `/s/sbgate/bets/tickets/${uuid}?language=eu&layout=EUROPEAN&ticketId=${uuid}`,
  ]);
  for (const path of paths) {
    assert.equal(path.includes("/tickets/2004"), false);
    assert.equal(path.includes("/bets/2004"), false);
    assert.equal(/\/tickets\/\d+(?:\?|$)/.test(path), false);
    assert.match(path, /[?&]ticketId=26091203-0b1b-4bd4-8d33-87f7263e9dd7/);
  }
});

test("ticket detail paths skip numeric display ids used as ticket id", () => {
  assert.deepEqual(ticketDetailPaths(2004), []);
  assert.deepEqual(ticketDetailPaths("2004", 2004), []);
  assert.deepEqual(ticketDetailPaths(null, 2004), []);
});

test("mergeTicketDetails copies match lists onto history ticket", () => {
  const merged = mergeTicketDetails(
    { id: "a", total_matches: 2 },
    { bets: [{ matches: [{ match_name: "A - B" }] }] }
  );
  assert.equal(merged.id, "a");
  assert.equal(merged.bets[0].matches[0].match_name, "A - B");
});

test("mergeTicketDetails unwraps nested ticket payloads", () => {
  const merged = mergeTicketDetails(
    { id: "a", total_matches: 2, ticket_type: "combo" },
    { ticket: { matches: [{ match_name: "A - B" }, { match_name: "C - D" }] } }
  );
  assert.equal(merged.matches[1].match_name, "C - D");
  assert.equal(needsTicketDetails(merged), false);
});

test("mergeTicketDetails copies uniqueSelections from ticket detail", () => {
  const merged = mergeTicketDetails(
    {
      id: "TICKET-UUID",
      total_matches: 2,
      ticket_type: "combo",
      first_match: { match_name: "Some Home - Liverpool" },
    },
    {
      bets: [{ leg_count: 2, outcome_ids: [1, 2], status: "PENDING" }],
      ticket: { id: "TICKET-UUID", ticket_type: "combo", total_matches: 2 },
      uniqueSelections: [
        { match_name: "Some Home - Liverpool", outcome_name: "Liverpool" },
        { match_name: "Sabalenka, A - Rybakina, E", outcome_name: "Sabalenka, A" },
      ],
    }
  );
  assert.equal(merged.uniqueSelections.length, 2);
  assert.equal(merged.uniqueSelections[1].match_name, "Sabalenka, A - Rybakina, E");
  assert.equal(needsTicketDetails(merged), false);
  assert.equal(
    needsTicketDetails({
      id: "TICKET-UUID",
      total_matches: 2,
      ticket_type: "combo",
      bets: [{ leg_count: 2, outcome_ids: [1, 2] }],
    }),
    true
  );
});

test("formatLastSync says never only when no timestamp exists", () => {
  assert.equal(formatLastSync(null), "Sist synket: aldri");
  assert.equal(formatLastSync(undefined), "Sist synket: aldri");
  assert.equal(formatLastSync(0), "Sist synket: aldri");
  assert.equal(formatLastSync(""), "Sist synket: aldri");
});

test("formatLastSync shows a real time for stored sync timestamps", () => {
  const ts = Date.parse("2026-09-04T12:00:00.000Z");
  const text = formatLastSync(ts);
  assert.notEqual(text, "Sist synket: aldri");
  assert.match(text, /^Sist synket: /);
  assert.ok(text.includes("2026"));
});

test("latestBetCreatedAt uses the newest Coolbet import time", () => {
  assert.equal(latestBetCreatedAt([]), null);
  assert.equal(
    latestBetCreatedAt([
      { created_at: "2026-08-01T10:00:00.000Z" },
      { created_at: "2026-09-04T18:30:00.000Z" },
      { created_at: "2026-07-01T00:00:00.000Z" },
    ]),
    Date.parse("2026-09-04T18:30:00.000Z")
  );
});

test("computeSyncProgress maps sync phases to rising percent and a label", () => {
  const auth = computeSyncProgress({ phase: "auth" });
  assert.equal(auth.percent, 4);
  assert.match(auth.label, /Bet Tracker/);

  const coolbet = computeSyncProgress({ phase: "coolbet" });
  assert.equal(coolbet.percent, 10);
  assert.match(coolbet.label, /Coolbet/);

  const page1 = computeSyncProgress({ phase: "history", page: 1, hasNextPage: true, tickets: 50 });
  const page8 = computeSyncProgress({ phase: "history", page: 8, totalPages: 10, tickets: 400 });
  const lastPage = computeSyncProgress({ phase: "history", page: 10, totalPages: 10, tickets: 500 });
  assert.ok(page1.percent > 10 && page1.percent < page8.percent);
  assert.equal(lastPage.percent, 68);
  assert.match(page1.label, /side 1/);
  assert.match(page1.label, /50/);

  const details = computeSyncProgress({
    phase: "details",
    detailsDone: 2,
    detailsTotal: 10,
  });
  assert.equal(details.percent, 74);
  assert.match(details.label, /2\/10/);

  assert.equal(computeSyncProgress({ phase: "import" }).percent, 95);
  assert.equal(computeSyncProgress({ phase: "done" }).percent, 100);

  const stored = { phase: "history", percent: 41, label: "Henter historikk · side 3 · 150 kuponger" };
  assert.deepEqual(computeSyncProgress(stored), stored);
});

test("resolveLastSyncAt prefers local lastSyncAt and falls back to backend field", () => {
  const local = Date.parse("2026-09-05T08:00:00.000Z");
  assert.equal(resolveLastSyncAt({ lastSyncAt: local }), local);
  assert.equal(
    resolveLastSyncAt({ last_coolbet_sync_at: "2026-09-04T12:00:00.000Z" }),
    Date.parse("2026-09-04T12:00:00.000Z")
  );
  assert.equal(
    resolveLastSyncAt({
      lastSyncAt: local,
      last_coolbet_sync_at: "2026-09-01T00:00:00.000Z",
    }),
    local
  );
  assert.equal(resolveLastSyncAt({ lastStatus: "ok" }), null);
  assert.equal(resolveLastSyncAt({}), null);
});
