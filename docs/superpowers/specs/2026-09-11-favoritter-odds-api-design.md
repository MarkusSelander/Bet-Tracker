# Favoritter: Flashscore-layout med The Odds API

Dato: 2026-09-11  
Status: godkjent i design-dialog, venter på spec-gjennomgang før implementasjonsplan  
Erstatter: `docs/superpowers/specs/2026-09-04-favorittlag-odds-design.md` (Coolbet/SportsDB). Den gamle flyten er fjernet fra koden.

## Mål

`/favorites` er en Flashscore-lignende kampflate drevet av **The Odds API** via backend. Brukeren fester ligaer og følger lag i venstremenyen (ikke som chips øverst). Listen viser kamper gruppert per liga med **beste EU 1X2**. Klikk åpner et kampkort med 1X2, over/under 2.5 og BTTS når markedene finnes.

## Ikke i v1

- Tabeller, lineup, kamp-events, H2H-statistikk, offisielle klubblogo-pakker
- «Nytt spill» / betslip fra kampkortet
- Historiske odds
- Live play-by-play utover stilling + minutt når scores-endepunktet har det
- Kall til The Odds API fra frontend, eller nøkkel i nettleseren

## Brukerflate

- Rute og meny uendret: **Favoritter** → `/favorites`.
- Sport-faner øverst. **Favoritter** er standard. Andre faner (Fotball, Tennis, Basketball, …) viser den sportens program for valgt dato.
- Venstre kolonne:
  - **Festede ligaer** — pin/unpin. En liga er en Odds API `sport_key` (f.eks. `soccer_epl`).
  - **Mine lag** — liste, ikke chips. Fjern per lag.
  - **+ Legg til lag** åpner søkedialog (lag og ligaer). Treff legges i riktig liste.
- Verktøylinje: Alle / Live / Odds / Ferdig / Program, pluss datovelger.
- Hovedflate: kamper gruppert under ligahode (land/sport-tittel + liganavn). Liga-stjerne pinner/fjerner ligaen. Kamp-stjerne lagrer `event_id` så kampen vises på Favoritter-fanen. Hver rad: tid eller live-minutt, hjemme/borte, tre odds-celler (1 / X / 2) med beste desimalodds. Mangler 1X2: tomme celler, raden vises.
- Filter: `all` = alle på datoen; `live` = pågående; `finished` = ferdige; `scheduled` = ikke startet; `odds` = har 1X2.
- Favoritter-fanen viser **unionen** av kamper i festede ligaer, kamper der minst ett fulgt lag spiller, og stjernemerkede `event_id`. Ingen treff: sidemeny + kort tom-tekst og «Legg til lag», ikke blank side.
- Klikk rad → dialog (samme mønster som kupongdetaljer). Kampinfo, stilling hvis kjent, markeder 1X2 / O/U 2.5 / BTTS. Hver utfallscelle: beste odds + bookmaker-navn. Mangler et marked: det utelates, ingen feil.

The Odds API leverer ikke tabeller eller logo-filer. Ingen Standings-lenke. Lag vises med navn og nøytral placeholder, ikke scrapet merkevare.

## Arkitektur

```
FavoritesPage  →  FastAPI (/api/odds/*, /api/favorites/*)  →  cache  →  The Odds API
                         ↘ Mongo (pinned leagues, followed teams per bruker)
```

- `ODDS_API_KEY` bare i backend `.env`. Aldri i frontend, git eller README med ekte verdi.
- Frontend kaller kun egne endepunkter med eksisterende auth-cookies.

## API

Alle under auth, samme mønster som resten av appen.

| Metode | Sti | Rolle |
| --- | --- | --- |
| GET | `/api/odds/sports` | Faner + pinbare ligaer fra `/v4/sports` |
| GET | `/api/odds/matches` | Kamper for `date`, `tab` (`favorites` eller sport-gruppe), `filter` |
| GET | `/api/odds/matches/{event_id}/markets` | Kampkortmarkeder |
| GET/POST/DELETE | `/api/favorites/leagues` | Festede `sport_key` |
| GET/POST/DELETE | `/api/favorites/teams` | Fulgte lag (`name` + `sport_key`) |
| POST/DELETE | `/api/favorites/events` | Stjernemerkede kamper (`event_id`) |
| GET | `/api/favorites/search?query=` | Ligaer fra sports-listen; lag fra events (quota-fritt) |

`GET /api/odds/matches` query: `date=YYYY-MM-DD`, `tab=favorites|soccer|tennis|...`, `filter=all|live|odds|finished|scheduled`.

Svar per kamp (minimum): `id`, `sport_key`, `sport_title`, `commence_time`, `home_team`, `away_team`, `completed`, `scores`, `odds_1x2: { home, draw, away, home_bookmaker, draw_bookmaker, away_bookmaker } | null`.

Kampkort: liste av markeder `{ key, outcomes: [{ name, price, bookmaker }] }`. Bare `h2h`, `totals` (linje 2.5 når den finnes, ellers nærmeste), og `btts` når Odds API returnerer dem.

## Dataflyt og cache

- Region: `eu`. Oddsformat: `decimal`.
- **Beste odds:** per utfall, høyeste `price` blant EU-bookmakere. Cellen viser tallet; kampkortet viser også bookmaker-navnet.
- Quota: `/v4/sports` og `/v4/events` koster ikke. `/v4/odds` og `/v4/scores` koster. Listen henter **bare `h2h`** per relevant `sport_key`. Kampkort bruker event-odds for én event med `h2h,totals` og `btts` når sporten støtter det.
- Favoritter-fanen henter kun `sport_key` som er festet eller knyttet til fulgte lag — ikke alle sports.
- Cache (Mongo eller minne + TTL, samme stil som øvrig backend): sports 12 t, scores/kamper 2 min, odds 3 min, kampkort 3 min. Cache-nøkkel inkluderer sport, dato, marked.
- Odds API-feil: server cachet data hvis fersk nok; ellers 502/503 med kort melding. Frontend viser banner, krasjer ikke.
- Uten `ODDS_API_KEY`: endepunktene svarer 503 med forklaring. Siden rendres.

## Frontend

- Bygg i `FavoritesPage` og små underkomponenter (sport-faner, sidemeny, ligagruppe, kamprad, kampdialog, søk). Mørkt Flashscore-preg, men appens typografi/spacing. Ingen chips-rad med alle lag.
- Styling i eksisterende Tailwind/shadcn-mønster. Desktop først; sidemeny kan kollapses på smal skjerm, men v1 trenger ikke mobilparitet med Flashscore.

## Tester

Kjør mot mock av Odds API, aldri mot live-nøkkel i CI.

- Beste-odds: tre bookmakere → riktig max per 1/X/2 og riktig bookmaker-navn.
- Favoritter-filter: union av pinned liga, fulgt lagnavn og stjernemerket `event_id`; andre kamper utelates.
- Kampkort: mapper h2h/totals/btts; mangler btts → feltet vises ikke.
- Cache-hit: andre kall med samme nøkkel treffer ikke HTTP-klienten.
- Odds API 500 uten cache → kontrollert feil, ikke 500-stack i UI.
- Tom tilstand uten pins/lag: sidemeny + tom-tekst, HTTP 200 med tom kamp-liste.

## Suksess

Innlogget bruker kan feste Eliteserien, følge Brann, se dagens kamper i Flashscore-layout med beste EU 1X2, og åpne Brann-kampen for flere markeder — uten at nøkkelen forlater serveren.
