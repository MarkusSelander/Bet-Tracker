// Med lagret token starter /auth/me med en gang, og innloggingsskjemaet venter
// til økten er avklart. Da blir brukeren værende innlogget selv om API-et svarer
// tregt. Uten token kan skjemaet vises etter en kort grace, så Firebase rekker
// å lese en lokalt lagret Google-økt først.
const SESSION_RESTORE_GRACE_MS = 1200;
const SESSION_RESTORE_TIMEOUT_MS = 60000;

function sessionCheckPlan(token) {
  if (!token) return { restore: false, block: false, immediate: false, holdUntilSettled: false };
  return {
    restore: true,
    block: true,
    immediate: true,
    holdUntilSettled: true,
    graceMs: SESSION_RESTORE_GRACE_MS,
    timeoutMs: SESSION_RESTORE_TIMEOUT_MS,
  };
}

function shouldReleaseLoading(token, restoreInFlight = 0) {
  if (restoreInFlight > 0) return false;
  return !sessionCheckPlan(token).holdUntilSettled;
}

export { SESSION_RESTORE_GRACE_MS, SESSION_RESTORE_TIMEOUT_MS, sessionCheckPlan, shouldReleaseLoading };
