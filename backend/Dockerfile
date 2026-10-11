# Render kjører denne filen. Python-miljøet der har ikke Chromium,
# og SofaScore avviser vanlige HTTP-kall.
FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright \
    SOFASCORE_CLIENT__BROWSER_PROFILE=/app/sofascore-data/chrome_profile \
    SOFASCORE_STORAGE__DATA_DIR=/app/sofascore-data

WORKDIR /app

COPY requirements.txt ./
COPY vendor/sofascore_scraper ./vendor/sofascore_scraper

RUN pip install -r requirements.txt \
    && python -m patchright install --with-deps --no-shell chromium \
    && rm -rf /var/lib/apt/lists/* /root/.cache \
    && useradd --create-home --shell /usr/sbin/nologin app \
    && mkdir -p /app/sofascore-data/chrome_profile \
    && chown -R app:app /app/sofascore-data /opt/ms-playwright

COPY --chown=app:app . .

USER app

CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]
