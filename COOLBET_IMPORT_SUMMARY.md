# Coolbet Import - Quick Implementation Summary

## ✅ What Was Implemented

### Backend (FastAPI)

**File**: `backend/server.py`

1. **New Pydantic Models** (lines ~527-555):
   - `CoolbetImportedBet`: Represents bet data from bookmarklet
   - `CoolbetImportRequest`: Import request payload
   - `CoolbetImportResponse`: Import response with counts

2. **New API Endpoint**: `POST /api/bets/import/coolbet` (lines ~1460-1605)
   - Requires authentication
   - Validates source = "coolbet"
   - Creates unique index for duplicate prevention
   - Auto-detects sport using TheSportsDB
   - Stores in both `imported_bets` and `bets` collections
   - Returns summary: `{imported, skipped, total}`

### Bookmarklet (JavaScript)

**Files Created**:
1. `frontend/src/utils/coolbetBookmarklet.js` - Readable version with comments
2. `frontend/src/utils/coolbetBookmarkletMinified.js` - Minified for browser use

**Key Functions**:
- `extractBets()`: DOM extraction with defensive selectors
- `generateExternalId()`: Stable hash-based ID generation
- `parseResult()`: Status normalization (won/lost/pending)
- `parseOdds()` / `parseStake()`: Number parsing
- `parseDateTime()`: ISO timestamp conversion
- `sendBets()`: API communication with fetch

### Frontend (React)

**Files**:
1. `frontend/src/pages/CoolbetImportPage.jsx` - Full import page
2. `frontend/src/App.js` - Added route `/import/coolbet`
3. `frontend/src/components/Sidebar.jsx` - Added navigation link

**Features**:
- Multiple installation methods (drag-drop, manual, copy)
- Step-by-step instructions
- Security disclaimer
- Troubleshooting guide
- Environment-aware (dev vs production endpoint)

## 🔑 Key Features

### Security
- ✅ Client-side extraction only
- ✅ No credential storage
- ✅ User-initiated imports
- ✅ Authenticated API endpoint
- ✅ Duplicate prevention

### Robustness
- ✅ Multiple DOM selector fallbacks
- ✅ Defensive parsing (continues on errors)
- ✅ Validates minimum required data
- ✅ Comprehensive error handling
- ✅ User feedback at each step

### Production Quality
- ✅ Pydantic validation
- ✅ MongoDB indexes for performance
- ✅ Async/await throughout
- ✅ Proper error logging
- ✅ Type hints in backend
- ✅ PropTypes optional (React best practices)

## ⚠️ Critical Pre-Deployment Tasks

### 1. Update Coolbet DOM Selectors

**File**: `frontend/src/utils/coolbetBookmarklet.js` (lines ~122-140)

The current selectors are **templates**:
```javascript
const betRowSelectors = [
  '.bet-history-item',
  '.bet-row',
  '[data-bet-id]',
  'tr.bet',
  '.history-bet'
];
```

**Action Required**:
1. Open Coolbet.com bet history page
2. Inspect HTML structure
3. Update selectors to match actual elements
4. Test extraction in browser console
5. Update minified version

### 2. Update Production API Endpoint

**File**: `frontend/src/utils/coolbetBookmarkletMinified.js` (line 18)

Change:
```javascript
const API = 'https://your-domain.com/api/bets/import/coolbet';
```

To your actual production domain.

### 3. Test End-to-End

1. Deploy backend
2. Run MongoDB index creation
3. Test with real Coolbet account
4. Verify duplicate prevention
5. Test error scenarios

## 📊 Database Schema

### Collection: `imported_bets`

```javascript
{
  user_id: "user_abc123",          // User who imported
  source: "coolbet",               // Always "coolbet"
  external_id: "coolbet_xyz789",   // Hash-based unique ID
  event: "Liverpool - Man City",   // Event name
  selection: "Liverpool to win",   // What was bet on
  stake: 10.0,                     // Bet amount
  odds: 2.5,                       // Decimal odds
  result: "won",                   // won/lost/pending
  bet_type: "single",              // Type of bet
  placed_at: ISODate("..."),       // When bet was placed
  imported_at: ISODate("...")      // When imported to app
}
```

**Unique Index**: `(user_id, external_id, source)`

### Collection: `bets` (also populated)

Standard bet format with:
- `bookie: "Coolbet"`
- `sport: [auto-detected]`
- `notes: "Imported from Coolbet (ID: ...)"`

## 🚀 How to Use (User Perspective)

### Setup (One-Time)

1. Navigate to `/import/coolbet` in the app
2. Drag bookmarklet button to bookmarks bar
   - OR manually create bookmark with copied code
3. Done!

### Import Bets (Repeatable)

1. Log into Coolbet.com
2. Go to bet history page
3. Make sure you're logged into analytics app (in another tab)
4. Click the "Import Coolbet Bets" bookmarklet
5. Review found bets and confirm
6. See import summary

## 🛠️ Customization Points

### Add Support for Other Bookmakers

Use this as a template:

1. **Backend**: Copy endpoint, change models
2. **Bookmarklet**: Update DOM selectors
3. **Frontend**: Clone page, update branding
4. **Sidebar**: Add new navigation link

### Adjust Sport Detection

Leverages existing `detect_sport_from_game_async()` in backend.
No changes needed unless sport detection fails.

### Modify Duplicate Logic

Currently based on `(user_id, external_id, source)`.
Can be adjusted in MongoDB index definition.

## 📝 Code Locations

```
backend/
  server.py
    Lines ~527-555:   Pydantic models
    Lines ~1460-1605: Import endpoint

frontend/
  src/
    utils/
      coolbetBookmarklet.js          # Readable bookmarklet
      coolbetBookmarkletMinified.js  # Minified for use
    pages/
      CoolbetImportPage.jsx          # Import page UI
    App.js                            # Route added
    components/
      Sidebar.jsx                     # Nav link added

COOLBET_IMPORT_DOCUMENTATION.md     # Full documentation
```

## 🧪 Testing Checklist

- [ ] Test endpoint with Postman/curl
- [ ] Verify authentication required
- [ ] Test duplicate prevention (import twice)
- [ ] Test with various bet statuses
- [ ] Test sport auto-detection
- [ ] Test bookmarklet on real Coolbet page
- [ ] Test in Chrome, Firefox, Safari
- [ ] Test drag-and-drop installation
- [ ] Test manual bookmark creation
- [ ] Verify CORS settings
- [ ] Load test with large import (50+ bets)

## 💡 Design Rationale

### Why Two Collections?

- `imported_bets`: Track import source and prevent duplicates
- `bets`: Main analytics collection (normalized format)

This allows:
- Easy duplicate detection
- Source tracking
- Future bulk operations on imports
- Compatibility with existing analytics

### Why Hash-Based IDs?

- Stable across imports
- No reliance on Coolbet's internal IDs
- Consistent duplicate detection
- Privacy-friendly (no Coolbet IDs stored)

### Why Client-Side Extraction?

- No backend scraping (legal/ethical)
- No credential storage
- User controls when to import
- Scales to any number of users
- No rate limiting issues

## 🔒 Security Notes

### What's Safe
- ✅ All extraction in user's browser
- ✅ No credentials transmitted
- ✅ Backend validates all input
- ✅ Requires user authentication

### What Users Must Protect
- 🔐 Their analytics app session
- 🔐 Their Coolbet login
- 🔐 Their browser security

## 📈 Performance

- **Client-side**: Zero backend load for extraction
- **Batch import**: Single request per import session
- **Index optimization**: Fast duplicate detection
- **Async operations**: Non-blocking backend processing

## 🚨 Known Limitations

1. **DOM dependency**: Breaks if Coolbet redesigns
2. **Pagination**: Only imports visible bets
3. **Browser only**: No mobile app support
4. **Manual trigger**: User must click bookmarklet
5. **Date parsing**: May need adjustment per Coolbet's format

---

## Quick Start Commands

```bash
# No new dependencies needed - already in requirements.txt

# Backend is ready - just need to test the endpoint

# Frontend - the page is ready at /import/coolbet
```

## Next Steps

1. ✅ Review this summary
2. ⚠️ Update Coolbet DOM selectors
3. ⚠️ Update production API endpoint
4. 🧪 Test on real Coolbet account
5. 🚀 Deploy and monitor

---

**Status**: ✅ Implementation Complete  
**Ready for**: Testing & Deployment  
**Critical**: Update selectors before use
