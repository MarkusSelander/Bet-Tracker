"""Verifiser Firebase ID-token fra Google-innlogging.

Signaturen sjekkes mot Googles offentlige sertifikater. Backend trenger bare
FIREBASE_PROJECT_ID, ikke en service account.
"""

import os
from typing import Optional

import certifi
import urllib3
from google.auth.transport.urllib3 import Request
from google.oauth2 import id_token

_google_request: Optional[Request] = None


class FirebaseNotConfigured(Exception):
    pass


class InvalidFirebaseToken(Exception):
    pass


def _text(value) -> str:
    return value.strip() if isinstance(value, str) else ""


def identity_from_claims(claims: dict) -> dict:
    if not isinstance(claims, dict):
        raise InvalidFirebaseToken("Ugyldig token")
    firebase = claims.get("firebase") if isinstance(claims.get("firebase"), dict) else {}
    if firebase.get("sign_in_provider") != "google.com":
        raise InvalidFirebaseToken("Kun Google-innlogging er tillatt")
    email = _text(claims.get("email"))
    if claims.get("email_verified") is not True or not email:
        raise InvalidFirebaseToken("Google-kontoen mangler bekreftet e-post")
    uid = _text(claims.get("sub") or claims.get("user_id"))
    if not uid:
        raise InvalidFirebaseToken("Ugyldig token")
    return {
        "uid": uid,
        "email": email,
        "name": _text(claims.get("name")),
        "picture": _text(claims.get("picture")),
    }


def _request() -> Request:
    global _google_request
    if _google_request is None:
        http = urllib3.PoolManager(cert_reqs="CERT_REQUIRED", ca_certs=certifi.where())
        _google_request = Request(http)
    return _google_request


def verify_id_token(token: str) -> dict:
    project = os.environ.get("FIREBASE_PROJECT_ID", "").strip()
    if not project:
        raise FirebaseNotConfigured()
    if not isinstance(token, str) or token.count(".") != 2 or len(token) > 12000:
        raise InvalidFirebaseToken("Ugyldig token")
    try:
        claims = id_token.verify_firebase_token(
            token,
            _request(),
            audience=project,
            clock_skew_in_seconds=10,
        )
    except Exception as exc:
        raise InvalidFirebaseToken("Ugyldig token") from exc
    if claims.get("iss") != f"https://securetoken.google.com/{project}":
        raise InvalidFirebaseToken("Ugyldig token")
    if claims.get("aud") != project:
        raise InvalidFirebaseToken("Ugyldig token")
    return identity_from_claims(claims)
