const TIMEOUT_MESSAGE = 'Forespørselen tok for lang tid';

function authErrorMessage(status, detail) {
  if (status === 401) {
    return typeof detail === 'string' && detail ? detail : 'Google-innloggingen ble avvist. Prøv igjen.';
  }
  if (status === 409) return detail || 'E-posten er knyttet til en annen konto.';
  if (status === 503) {
    return typeof detail === 'string' && detail ? detail : 'Databasen er utilgjengelig. Prøv igjen om et øyeblikk.';
  }
  if (status === 400 && typeof detail === 'string' && detail) return detail;
  if (status >= 500) return 'Serveren svarer ikke som den skal. Prøv igjen om litt.';
  return 'Noe gikk galt. Prøv igjen.';
}

function networkErrorMessage(error) {
  if (error?.message === TIMEOUT_MESSAGE) {
    return 'Serveren svarer ikke. Den kan holde på å starte opp – prøv igjen om noen sekunder.';
  }
  return 'Fikk ikke kontakt med serveren. Sjekk nettet og prøv igjen.';
}

function googleAuthError(error) {
  const code = error?.code || '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Innloggingen ble avbrutt.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Nettleseren blokkerte vinduet. Tillat popup og prøv igjen.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Dette domenet er ikke godkjent i Firebase.';
  }
  if (code === 'auth/network-request-failed') return networkErrorMessage(error);
  return 'Google-innlogging feilet. Prøv igjen.';
}

export { authErrorMessage, googleAuthError, networkErrorMessage };
