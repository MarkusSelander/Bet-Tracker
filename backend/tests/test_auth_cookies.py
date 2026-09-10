from auth_cookies import use_cross_site_cookies


def test_cross_site_cookies_when_environment_is_production(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("RENDER", raising=False)
    assert use_cross_site_cookies() is True


def test_cross_site_cookies_on_render_without_environment(monkeypatch):
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.setenv("ENVIRONMENT", "")
    assert use_cross_site_cookies() is True


def test_local_dev_keeps_lax_cookies(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "")
    monkeypatch.delenv("RENDER", raising=False)
    assert use_cross_site_cookies() is False
