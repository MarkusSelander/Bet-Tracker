# Favorittlag med Coolbet-odds

Dato: 2026-09-04  
Status: godkjent i design-dialog, venter på spec-gjennomgang før implementasjonsplan

## Mål

Ett menypunkt **Favoritter** som åpner en SofaScore-lignende feed: kommende kamper for lagene brukeren følger, med Coolbet 1X2 i lista. Klikk på en kamp åpner et kampkort med flere Coolbet-markeder.

## Ikke i v1

- Lag som egne undermenyer i sidemenyen
- Lineup, H2H, live-score, statistikk (SofaScore-kampcenter)
- Odds fra andre bookmakere enn Coolbet
- Åpne spill / betslip fra appen
- Nye bookmakere i synken

## Brukerflate

- Sidemeny: **Favoritter** mellom Analyse og Innstillinger. Rute: `/favorites`.
- Øverst: søkefelt («Søk og legg til lag…»). Treff fra eksisterende `GET /teams/search`. Velg lag → `POST /favorites/teams`. Lag vises som chips med fjern (×) → `DELETE /favorites/teams/{team_id}`.
- Feed under: gruppert på **dag**, deretter **liga**. Hver rad: kickoff, hjemme–borte (logo hvis badge finnes), Coolbet 1X2 til høyre (hjemme / uavgjort / borte).
- Klikk rad → kampkort som dialog (samme mønster som kupongdetaljer). Viser kampinfo pluss flere Coolbet-hovedmarkeder: 1X2, over/under og BTTS når Coolbet har dem. Andre markeder vises ikke i v1.
- Kamp uten Coolbet-treff vises likevel. Odds-kolonnen er tom. Kampkortet forklarer at odds ikke ble funnet.

Tom tilstand uten favoritter: kort tekst + søkefelt, ikke en blank side.

## Dataflyt

Eksisterende (beholdes):

- `GET /teams/search?query=` — TheSportsDB, cachet
- `POST /favorites/teams`, `DELETE /favorites/teams/{team_id}`, `GET /favorites/teams`
- `GET /favorites/upcoming-matches` — neste kamper per favorittlag, 6 t fixture-cache

Nytt:

- Utvid `GET /favorites/upcoming-matches` slik at hver kamp får `odds_1x2: { home, draw, away } | null` og `coolbet_event_id | null`. Ingen ekstra list-endepunkt i v1.
- `GET /favorites/matches/{fixture_id}/markets` — flere markeder for den Coolbet-eventen. 404/tom liste hvis ingen `coolbet_event_id`.

Matching: hjemme- og bortelagnavn + kampdato mot Coolbet event-søk. Best effort. Ingen manuell mapping-tabell i v1.

Cache: fixtures som i dag (timer). Odds kort (2–5 min) fordi linjer flytter seg. SportsDB-nede: vis lagrede favoritter og si at kampene ikke lot seg oppdatere. Coolbet-nede: kamper uten odds.

## Frontend

- Ny `FavoritesPage` i samme visuelle språk som Oversikt/Analyse (mørkt, `#18181B`-kort).
- SofaScore-struktur: liga-header, kompakt kamprad, 1X2 høyrejustert monospace.
- Kampkort: samme dialogmønster som `BetDetailsDialog` (ikke en ny app-i-appen).

## Tester

- Mapper: SportsDB-kamp + Coolbet 1X2 → rad med liga, tid, tre odds.
- Ingen Coolbet-treff → kamp uten odds, ingen exception.
- Kampkort: flere markeder når `coolbet_event_id` finnes; tom/forklaring når ikke.
- Favoritt add/remove og søk uendret i kontrakt.
- `/favorites` er registrert i router og sidemeny.

## Suksess

Brukeren kan følge Brann (osv.), se neste kamper i en SofaScore-feed, lese Coolbet 1X2 uten å forlate appen, og åpne kampen for flere markeder når Coolbet har eventen.
