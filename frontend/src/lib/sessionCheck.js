// Kort venting når API-et allerede er våkent, så innloggede ikke ser innloggingsskjemaet.
// Lengre kall fortsetter i bakgrunnen. Render kan bruke mange sekunder på å våkne,
// og det skal ikke holde siden bak «Laster...».
const SESSION_RESTORE_GRACE_MS = 1200;
const SESSION_RESTORE_TIMEOUT_MS = 20000;

function sessionCheckPlan(token) {
  if (!token) return { restore: false, block: false };
  return {
    restore: true,
    block: true,
    graceMs: SESSION_RESTORE_GRACE_MS,
    timeoutMs: SESSION_RESTORE_TIMEOUT_MS,
  };
}

export { SESSION_RESTORE_GRACE_MS, SESSION_RESTORE_TIMEOUT_MS, sessionCheckPlan };
