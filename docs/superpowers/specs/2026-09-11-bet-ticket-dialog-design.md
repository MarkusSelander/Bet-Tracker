# Kupongdialog: felles visning og skjema

Dato: 2026-09-11  
Status: godkjent i design-dialog, venter på spec-gjennomgang før implementasjonsplan  
Referanse: eksisterende detaljdialog + «Nytt spill»-skjema, restylet etter add-bet-layout (uten Single/Multiple-faner og uten bookmaker-logo-rad).

## Mål

Én dialog, `BetTicketDialog`, dekker visning, nytt spill og redigering. Kjernefelt ligger i et kompakt grid som i referansen. Øvrige felt ligger bak **Detaljer**. Ingen nye API-felt.

## Ikke i v1

- Single Bet / Multiple Bet-faner
- Klikkbar rad av bookmaker-logoer og «Se alle»
- Tags, «Lock bet», «Keep match info»
- Nye backend-felter eller utvidet `BetCreate`/`BetUpdate`
- Rediger/Slett på Oversikt og Kalender
- Offisielle bookmaker-bildefiler (fortsett med `BookmakerLogo`)

## Modi

| Modus | Åpnes fra | Felt | Footer |
| --- | --- | --- | --- |
| `view` | Rad-klikk på Spill, Oversikt, Kalender | Skrivebeskyttet | **Rediger** og **Slett** bare når `onEdit`/`onDelete` er satt (Spill-siden). **Detaljer** alltid. |
| `create` | **Nytt spill** på Spill-siden | Redigerbart, dato = i dag, status = åpen | **Legg til** + **Detaljer** |
| `edit` | **Rediger** i visning på Spill-siden | Redigerbart, forhåndsutfylt | **Oppdater** + **Detaljer** |

På Spill-siden bytter **Rediger** til `edit` i **samme** dialog. Ingen andre modal. Lukk med X (og Esc som i dagens `Dialog`). Avbryt-knapp utgår; X er nok.

Oversikt og Kalender bruker bare `view` uten Rediger/Slett.

## Layout

Bred modal (`max-w-2xl` eller tilsvarende), mørk flate som i dag (`bg-[#18181B]`, `border-[#27272A]`). Ingen faner øverst. Dialogtittel er skjermleser-tekst (`Nytt spill` / `Rediger spill` / `Spilldetaljer`); kampnavnet ligger i feltet Kamp, ikke som overskrift.

Kjernegrid:

```
Kamp                    Status
Utvalg                  Innsats    Odds
Sport                   Tipster    Bookmaker
```

- Labels over feltene, norsk.
- Innsats viser valutaprefiks (`kr`), ikke `$`.
- Bookmaker: `BookmakerLogo` for valgt navn. I `create`/`edit` er det et tekstfelt (som i dag) med merket ved siden av. Ingen logo-rad.
- Status: samme verdier som nå (`pending`, `won`, `lost`, `push`, `cashed`) med eksisterende norske labels.
- I `view` er kontrollene `disabled` / read-only, ikke en nøkkel–verdi-liste.

**Detaljer** er en utvidelse i samme dialog (ikke ny side). Standard: sammenklappet. Tilstanden kan resettes når dialogen lukkes.

### Bak Detaljer

Vises når verdien finnes, eller i `create`/`edit` når feltet er skrivbart:

| Felt | Visning | Skrivbart i create/edit |
| --- | --- | --- |
| Dato | ja | ja (`BetCreate`/`BetUpdate`) |
| Tid | ja | ja |
| Notater | ja | ja |
| Liga | ja | nei |
| Type (`ticket_type`) | ja | nei |
| Produkt | ja | nei |
| Kamper (`total_matches`) | ja | nei |
| Resultat | ja | nei |
| Forventet oppgjør | ja | nei |
| Cashout | ja | nei |
| Kupong-ID (`display_id`) | ja | nei |
| Kilde-ID | ja | nei |
| Bein (`legs`) | ja, samme kort som i dag | nei |

Manglende kombi-bein (advarselen «Kun første utvalg er lagret…») vises i Detaljer sammen med bein-listen.

I `create` finnes ikke synkede felt ennå; Detaljer viser da dato, tid og notater.

Nye spill får `date` = i dag uten at dato ligger i kjernegridet.

## Data og API

Ingen backend-endring. Lagring som i dag:

- Create: `POST /api/bets` med `date`, `time`, `game`, `bet`, `stake`, `odds`, `status`, `bookie`, `tipster`, `sport`, `notes`
- Update: `PATCH /api/bets/{bet_id}` med samme skrivbare felt
- Delete: `DELETE /api/bets/{bet_id}` med eksisterende `window.confirm`

Påkrevd ved lagring: kamp (`game`), utvalg (`bet`), innsats, odds. Dato settes automatisk i create hvis brukeren ikke åpner Detaljer.

Etter vellykket create/update eller slett lukkes dialogen (samme som i dag).

Feil: eksisterende toast (`Kunne ikke lagre spill` / slett-feil). Ingen ny feilflate.

## Komponenter

- Ny: `frontend/src/components/BetTicketDialog.jsx` — skall, grid, Detaljer-panel, modus.
- `BetDetailsDialog.jsx` fjernes når Spill, Oversikt og Kalender peker på `BetTicketDialog`.
- `BetsPage.jsx` mister det innebygde create/edit-skjemaet; én dialog-instans med modus.
- `BookmakerLogo` gjenbrukes uendret.
- Test-ider: behold `bet-details-dialog`, `bet-details-edit`, `bet-details-delete`, `bet-details-legs`. Nye: `bet-ticket-details-toggle`, og create/edit-felter med stabile `data-testid` der det trengs.

## Tester

Logikk trekkes ut i `frontend/src/lib/betTicket.js` og testes med `node:test` som øvrige frontend-lib-tester (`frontend/src/lib/betTicket.test.js`):

- `CORE_FIELDS` / `DETAIL_FIELDS` — hvilke nøkler som er kjerne vs Detaljer.
- `isDetailFieldWritable(key)` — bare `date`, `time`, `notes` er skrivbare bak Detaljer.
- `missingComboLegs(bet)` — samme regel som i dagens detaljdialog.
- `defaultCreateValues()` — `date` er i dag, `status` er `pending`.
- `visibleFooterActions({ mode, onEdit, onDelete })` — view uten callbacks: ingen Rediger/Slett; view med callbacks: begge; create: Legg til; edit: Oppdater.

Ingen nye backend-tester. Ingen krav om React-komponenttester.

## Suksess

- Detaljvisning og nytt/rediger-spill ser ut som samme skjema.
- Referansens grid og Detaljer-mønster er gjenkjennelig, uten faner og uten logo-rad.
- Eksisterende lagring, sletting, statuslabels og bookmaker-merke fortsetter å virke.
- Oversikt og Kalender kan fortsatt åpne et spill read-only.
