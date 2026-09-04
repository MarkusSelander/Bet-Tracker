import certifi

DEFAULT_SERVER_SELECTION_TIMEOUT_MS = 8000
DEFAULT_CONNECT_TIMEOUT_MS = 5000


def uses_tls(mongo_url: str) -> bool:
    lowered = (mongo_url or "").lower()
    return (
        lowered.startswith("mongodb+srv://")
        or "tls=true" in lowered
        or "ssl=true" in lowered
    )


def mongo_client_kwargs(mongo_url: str, ca_file: str | None = None) -> dict:
    kwargs = {
        "serverSelectionTimeoutMS": DEFAULT_SERVER_SELECTION_TIMEOUT_MS,
        "connectTimeoutMS": DEFAULT_CONNECT_TIMEOUT_MS,
    }
    if uses_tls(mongo_url):
        kwargs["tlsCAFile"] = ca_file or certifi.where()
    return kwargs
