import re
from typing import Optional

import bcrypt

MIN_PASSWORD_LENGTH = 8
# bcrypt bruker bare de første 72 bytene; lengre passord ville gitt en falsk trygghet.
MAX_PASSWORD_BYTES = 72
MAX_EMAIL_LENGTH = 254
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_email(value) -> str:
    return value.strip().lower() if isinstance(value, str) else ""


def email_error(email: str) -> Optional[str]:
    if not email:
        return "Skriv inn e-post"
    if len(email) > MAX_EMAIL_LENGTH or not _EMAIL_RE.match(email):
        return "Ugyldig e-postadresse"
    return None


def password_error(password) -> Optional[str]:
    if not isinstance(password, str) or not password:
        return "Skriv inn passord"
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"Passordet må være minst {MIN_PASSWORD_LENGTH} tegn"
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        return f"Passordet kan være maks {MAX_PASSWORD_BYTES} tegn"
    if not password.strip():
        return "Passordet kan ikke bare være mellomrom"
    return None


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: Optional[str]) -> bool:
    if not isinstance(password, str) or not password_hash:
        return False
    encoded = password.encode("utf-8")
    if len(encoded) > MAX_PASSWORD_BYTES:
        return False
    try:
        return bcrypt.checkpw(encoded, password_hash.encode("utf-8"))
    except ValueError:
        return False


def public_user(user_doc: dict) -> dict:
    return {key: value for key, value in user_doc.items() if key not in ("_id", "password_hash")}
