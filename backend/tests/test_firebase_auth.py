import os

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "test_firebase_auth")

import pytest

from firebase_auth import InvalidFirebaseToken, identity_from_claims, verify_id_token


def _claims(**overrides):
    claims = {
        "sub": "uid-1",
        "email": "ola@example.com",
        "email_verified": True,
        "name": "Ola",
        "picture": "https://lh3.googleusercontent.com/a/photo",
        "firebase": {"sign_in_provider": "google.com"},
    }
    claims.update(overrides)
    return claims


def test_google_claims_become_identity():
    identity = identity_from_claims(_claims())
    assert identity == {
        "uid": "uid-1",
        "email": "ola@example.com",
        "name": "Ola",
        "picture": "https://lh3.googleusercontent.com/a/photo",
    }


def test_user_id_claim_is_accepted_when_sub_is_missing():
    claims = _claims()
    claims.pop("sub")
    claims["user_id"] = "uid-2"
    assert identity_from_claims(claims)["uid"] == "uid-2"


@pytest.mark.parametrize(
    "claims",
    [
        {},
        _claims(firebase={"sign_in_provider": "password"}),
        _claims(email_verified=False),
        _claims(email=""),
        _claims(sub="  "),
    ],
)
def test_non_google_or_incomplete_claims_are_rejected(claims):
    with pytest.raises(InvalidFirebaseToken):
        identity_from_claims(claims)


def test_malformed_token_is_rejected_without_calling_google(monkeypatch):
    monkeypatch.setenv("FIREBASE_PROJECT_ID", "bet-tracker")
    with pytest.raises(InvalidFirebaseToken):
        verify_id_token("ikke-et-jwt")


def test_missing_project_id_is_not_configured(monkeypatch):
    from firebase_auth import FirebaseNotConfigured

    monkeypatch.delenv("FIREBASE_PROJECT_ID", raising=False)
    with pytest.raises(FirebaseNotConfigured):
        verify_id_token("a.b.c")
