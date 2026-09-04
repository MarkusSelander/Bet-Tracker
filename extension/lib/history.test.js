const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  HISTORY_PATH,
  authHeaders,
  historyQuery,
  importUrl,
  loginPayload,
  mergeTicketDetails,
  needsTicketDetails,
  shouldStopPagination,
  ticketDetailPaths,
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
  const paths = ticketDetailPaths("26090221-4ce1-4145-b10d-387fb0146ecd", 1949);
  assert.ok(paths[0].startsWith("/s/sbgate/bets/26090221-4ce1-4145-b10d-387fb0146ecd"));
  assert.ok(paths[0].includes("language=eu"));
  assert.ok(paths.some((path) => path.includes("/s/sbgate/bets/ticket/")));
  assert.ok(paths.some((path) => path.startsWith("/s/sbgate/bets/1949?")));
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
