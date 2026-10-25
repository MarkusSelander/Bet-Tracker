// Én import-sti, brukt av React.lazy og forhåndslasting på innloggingssiden.
export function loadDashboard() {
  return import('../pages/Dashboard');
}

let dashboardPreloadStarted = false;

export function preloadDashboard() {
  if (dashboardPreloadStarted) return undefined;
  dashboardPreloadStarted = true;
  return loadDashboard();
}
