const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TIMEOUT_MESSAGE = 'Forespørselen tok for lang tid';

function byteLength(value) {
  return new TextEncoder().encode(value).length;
}

function validateLogin({ email, password }) {
  if (!email.trim()) return 'Skriv inn e-post';
  if (!EMAIL_RE.test(email.trim())) return 'Ugyldig e-postadresse';
  if (!password) return 'Skriv inn passord';
  return null;
}

function validateRegister({ name = '', email, password, confirm }) {
  const loginError = validateLogin({ email, password });
  if (loginError) return loginError;
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Passordet må være minst ${MIN_PASSWORD_LENGTH} tegn`;
  }
  if (byteLength(password) > MAX_PASSWORD_BYTES) {
    return `Passordet kan være maks ${MAX_PASSWORD_BYTES} tegn`;
  }
  if (!password.trim()) return 'Passordet kan ikke bare være mellomrom';
  if (password !== confirm) return 'Passordene er ikke like';
  if (name.trim().length > 80) return 'Navnet kan være maks 80 tegn';
  return null;
}

function authErrorMessage(status, detail) {
  if (status === 401) return 'Feil e-post eller passord';
  if (status === 409) return detail || 'E-postadressen er allerede registrert. Logg inn i stedet.';
  if (status === 503) return 'Databasen er utilgjengelig. Prøv igjen om et øyeblikk.';
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

export { MIN_PASSWORD_LENGTH, authErrorMessage, networkErrorMessage, validateLogin, validateRegister };
