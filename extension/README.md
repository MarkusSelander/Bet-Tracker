# Bet Tracker Coolbet-utvidelse

Chrome-utvidelse (Manifest V3) som henter spillhistorikk fra Coolbet sitt history-API og poster kupongene til `POST /api/bets/import/coolbet`.

Utvidelsen kjører i **din** Chrome-økt. Den kan ikke kjøre på Vercel.

## Installer (load unpacked)

1. Åpne `chrome://extensions`
2. Slå på **Developer mode** øverst til høyre
3. Klikk **Load unpacked**
4. Velg mappen `extension/` i dette repoet
5. Klikk utvidelsesikonet → **Innstillinger**
6. Lim inn Bet Tracker **backend-URL** (ikke Vercel-frontenden), f.eks. `https://api.ditt-domene.com` eller `http://localhost:8000`
7. Logg inn med Google (samme konto som på nettsiden), eller lim inn et `session_`-token fra Innstillinger
8. Vær innlogget på [coolbet.com](https://www.coolbet.com) i Chrome. En ny innlogging starter synk av seg selv
9. Trykk **Synk nå**, eller åpne Coolbet bet-history, hvis du vil synke uten å logge inn på nytt

## Hvordan det virker

- En content script på `coolbet.com` kaller `GET /s/sbgate/bets/history` first-party (cookies + `cbauth` fanget fra sidens eget kall). Ingen DOM-scrape.
- Service worker poster `{ "tickets": [...] }` til Bet Tracker med `Authorization: Bearer <session_token>`.
- Backend upsertet på Coolbet-id. Full historikk første gang; senere stoppes paginering når en side kun inneholder kjente, avgjorte kuponger. Kombi-/systemkuponger hentes i tillegg fra kupongdetaljer slik at alle bein lagres.

## CORS / auth

Utvidelsen bruker **ikke** session-cookie fra Vercel. Den veksler et Firebase-token fra Google mot `/api/auth/google` og lagrer `session_token` i `chrome.storage.local`.

Backend tillater `chrome-extension://` + 32 bokstaver via `allow_origin_regex` (se `backend/coolbet_sync.py`). Du trenger ikke å legge utvidelses-ID i `CORS_ORIGINS`. `CORS_ORIGINS` skal fortsatt inneholde Vercel-frontenden.

Lagre aldri Coolbet-passord i utvidelsen. Token er gyldig i 7 dager (samme som web-innlogging).

## Auto-synk

- Når du logger inn på Coolbet (ny `login_session_id`, eller et vellykket innloggingskall). Standard på. Fanen du står i blir stående. Trenger fortsatt gyldig Bet Tracker-token i utvidelsen.
- På når du besøker Coolbet bet-history (standard). Maks én gang per 10 minutter.
- Valgfritt: alarm hver 6. time. Krever gyldig Coolbet-økt i Chrome.
