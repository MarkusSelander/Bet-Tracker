import re
from typing import Optional

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


def public_user(user_doc: dict) -> dict:
    hidden = {"_id", "password_hash"}
    return {key: value for key, value in user_doc.items() if key not in hidden}
