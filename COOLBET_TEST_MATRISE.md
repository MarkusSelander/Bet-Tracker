# Coolbet Import - Test Matrise

## ✅ Status

- **Parsing**: Verifisert korrekt
- **DOM Selectors**: Verifisert mot ekte Coolbet (desember 2025)
- **Backend**: Klar (sjekk punkt 2 under)
- **Bookmarklet**: Produksjonsklar
- **Frontend**: `/import/coolbet` side er klar

---

## 🧪 Test 1: Første Import (5 min)

### Setup
1. Åpne Bet Tracker app i en tab
2. Logg inn
3. Åpne Coolbet i en annen tab
4. Logg inn på Coolbet
5. Naviger til bet history side

### Test
1. Klikk på bookmarklet
2. Se at alert viser antall bets funnet
3. Bekreft import
4. Noter resultatet:
   - Total: ___
   - Imported: ___
   - Skipped: ___

### Forventet
- Total = antall bets på siden
- Imported = Total (første gang)
- Skipped = 0 (første gang)

### ✅ Pass Kriterier
- [ ] Alert viser riktig antall bets
- [ ] Imported > 0
- [ ] Ingen feilmeldinger i console
- [ ] Success melding vises

---

## 🧪 Test 2: Duplicate Detection (2 min)

### Test
1. Klikk på bookmarklet igjen (samme side)
2. Noter resultatet:
   - Total: ___
   - Imported: ___
   - Skipped: ___

### Forventet
- Total = samme som før
- Imported = 0
- Skipped = Total (alle er duplicates)

### ✅ Pass Kriterier
- [ ] Imported = 0
- [ ] Skipped > 0
- [ ] Ingen feilmeldinger
- [ ] Success melding vises

---

## 🧪 Test 3: Dashboard Verification (3 min)

### Test
1. Gå til Dashboard i Bet Tracker
2. Sjekk at bets vises
3. Sjekk ROI beregning
4. Test sport filter
5. Test league filter (hvis tilgjengelig)

### ✅ Pass Kriterier
- [ ] Bets vises i dashboard
- [ ] ROI er kalkulert riktig
- [ ] Event names vises riktig
- [ ] Stake og odds er korrekte
- [ ] Result status (won/lost/pending) stemmer
- [ ] Sport filter fungerer
- [ ] League info vises (hvis støttet)

---

## 🧪 Test 4: MongoDB Verification (2 min)

### Test med MongoDB Compass eller CLI

#### Collection: `bets`
```javascript
db.bets.find({ bookie: "Coolbet" }).limit(5)
```

**Sjekk at:**
- [ ] `bets` collection har nye dokumenter
- [ ] `bookie` = "Coolbet"
- [ ] `sport` er detektert riktig (basketball, football, etc.)
- [ ] `game` / `event` navn vises
- [ ] `bet` / `selection` vises
- [ ] `stake`, `odds`, `status` er korrekte
- [ ] `notes` inneholder "Imported from Coolbet (ID: ...)"

#### Collection: `imported_bets`
```javascript
db.imported_bets.find({ source: "coolbet" }).limit(5)
```

**Sjekk at:**
- [ ] `imported_bets` collection har nye dokumenter
- [ ] `source` = "coolbet"
- [ ] `external_id` format: "coolbet-XXXX"
- [ ] `user_id` er satt
- [ ] `sport`, `league`, `event` vises
- [ ] `market`, `outcome` vises
- [ ] `imported_at` timestamp er satt

---

## 🧪 Test 5: Backend Endpoint (optional - hvis direkte test ønskes)

### Test med curl eller Postman

```bash
curl -X POST https://bet-tracker-backend-rqjp.onrender.com/api/bets/import/coolbet \
  -H "Content-Type: application/json" \
  -H "Cookie: session_token=YOUR_SESSION_TOKEN" \
  -d '{
    "source": "coolbet",
    "bets": [
      {
        "externalId": "coolbet-test123",
        "event": "Test Team A - Test Team B",
        "stake": 10.0,
        "odds": 2.5,
        "result": "pending",
        "placedAt": "2025-12-25T12:00:00Z",
        "selection": "Test Team A to win",
        "betType": "single",
        "sport": "basketball",
        "league": "NBA",
        "market": "Match Winner",
        "outcome": "Team A"
      }
    ]
  }'
```

### Forventet Response
```json
{
  "imported": 1,
  "skipped": 0,
  "total": 1
}
```

### ✅ Pass Kriterier
- [ ] HTTP 200 OK
- [ ] Response inneholder `imported`, `skipped`, `total`
- [ ] `imported` = 1 første gang
- [ ] Kjør igjen: `skipped` = 1, `imported` = 0

---

## 🔒 Test 6: Backend Security Checks

### Test 1: Authentication Required
```bash
curl -X POST https://bet-tracker-backend-rqjp.onrender.com/api/bets/import/coolbet \
  -H "Content-Type: application/json" \
  -d '{"source":"coolbet","bets":[]}'
```

**Forventet:** HTTP 401 Unauthorized

### Test 2: Invalid Source
```bash
curl -X POST https://bet-tracker-backend-rqjp.onrender.com/api/bets/import/coolbet \
  -H "Content-Type: application/json" \
  -H "Cookie: session_token=YOUR_SESSION_TOKEN" \
  -d '{"source":"notcoolbet","bets":[]}'
```

**Forventet:** HTTP 400 Bad Request

### Test 3: Empty Bets Array
```bash
curl -X POST https://bet-tracker-backend-rqjp.onrender.com/api/bets/import/coolbet \
  -H "Content-Type: application/json" \
  -H "Cookie: session_token=YOUR_SESSION_TOKEN" \
  -d '{"source":"coolbet","bets":[]}'
```

**Forventet:** HTTP 400 Bad Request

### ✅ Pass Kriterier
- [ ] Uautoriserte requests avvises
- [ ] Invalid source avvises
- [ ] Tomme arrays avvises

---

## 📊 Test Resultat Oppsummering

| Test | Status | Notater |
|------|--------|---------|
| 1. Første Import | ⬜ | |
| 2. Duplicate Detection | ⬜ | |
| 3. Dashboard Verification | ⬜ | |
| 4. MongoDB Verification | ⬜ | |
| 5. Backend Endpoint (opt) | ⬜ | |
| 6. Security Checks | ⬜ | |

**Alle tester må være ✅ før produksjon**

---

## 🚨 Hvis Tester Feiler

### Første Import Feiler
- Sjekk browser console for errors
- Verifiser at du er logget inn i Bet Tracker
- Sjekk at Coolbet bet history side er lastet
- Verifiser backend er oppe

### Duplicates Ikke Detektert
- Sjekk MongoDB index: `db.imported_bets.getIndexes()`
- Verifiser unique index på `(user_id, external_id, source)`
- Sjekk backend logs for errors

### Dashboard Viser Ikke Bets
- Verifiser at `bets` collection har nye dokumenter
- Sjekk at `user_id` matcher
- Refresh dashboard side
- Sjekk browser console for errors

### Sport Detection Feil
- Sjekk `sport` felt i `bets` collection
- Verifiser at sport mapping fungerer i backend
- Se backend logs for TheSportsDB API calls

---

## ✅ Produksjonsklare Kriterier

Før produksjon, verifiser at:

1. **Parsing**
   - [ ] Alle felt ekstraheres riktig (externalId, sport, league, event, market, outcome, stake, odds, result)
   - [ ] externalId er stabilt og unikt
   - [ ] Tall parsing fungerer (komma som decimal separator)

2. **Backend**
   - [ ] Endpoint krever autentisering
   - [ ] Validerer source = "coolbet"
   - [ ] Unique index finnes og fungerer
   - [ ] Returnerer korrekt response format
   - [ ] Logger errors

3. **Database**
   - [ ] `imported_bets` collection har riktig schema
   - [ ] `bets` collection oppdateres
   - [ ] Ingen duplikater
   - [ ] Indexes er opprettet

4. **UX**
   - [ ] Success/error meldinger vises
   - [ ] Import statistikk vises (imported/skipped/total)
   - [ ] Dashboard oppdateres med nye bets
   - [ ] Filtrering fungerer

5. **Dokumentasjon**
   - [ ] Bookmarklet instruksjoner er klare
   - [ ] Troubleshooting guide er tilgjengelig
   - [ ] Selectors er dokumentert

---

## 🎯 Estimert Total Test Tid

- Test 1-4: ~12 min
- Test 5-6 (optional): ~5 min
- **Total: 15-20 minutter**

Hvis alle tester passerer → **Produksjonsklart** ✅
