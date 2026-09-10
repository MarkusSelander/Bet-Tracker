import os


def use_cross_site_cookies() -> bool:
    if os.environ.get("ENVIRONMENT", "").lower() == "production":
        return True
    return os.environ.get("RENDER", "").lower() == "true"
