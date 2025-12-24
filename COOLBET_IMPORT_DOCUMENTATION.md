# Coolbet Bookmarklet Import Feature

## Overview

This document describes the production-quality bookmarklet solution for importing bet history from Coolbet into the betting analytics application.

## Architecture

```
Coolbet Bet History Page (user's browser)
           ↓
    JavaScript Bookmarklet (client-side extraction)
           ↓
    POST /api/bets/import/coolbet
           ↓
    FastAPI Backend (validation & storage)
           ↓
    MongoDB (imported_bets + bets collections)
```

## Security Model

### What is Safe

✅ **Client-side extraction**: All bet data extraction happens in the user's browser
✅ **No credential storage**: No Coolbet passwords or tokens are stored
✅ **User-initiated**: Import only happens when user clicks the bookmarklet
✅ **Authenticated API**: Backend requires valid session token
✅ **Duplicate prevention**: Uses compound unique index to prevent duplicate imports

### What We Don't Do

❌ No backend scraping of Coolbet
❌ No storing of Coolbet login credentials
❌ No automated polling or scraping
❌ No cross-origin requests without user action

## Implementation Details

### 1. Backend (FastAPI)

#### New Models

**File**: `backend/server.py`

```python
class CoolbetImportedBet(BaseModel):
    """Represents a single bet extracted from Coolbet via bookmarklet"""
    externalId: str  # Unique identifier from Coolbet
    event: str  # Event/game name
    stake: float  # Bet amount
    odds: float  # Decimal odds
    result: str  # "won", "lost", or "pending"
    placedAt: str  # ISO timestamp when bet was placed
    selection: Optional[str] = None  # What was bet on
    betType: Optional[str] = None  # Type of bet

class CoolbetImportRequest(BaseModel):
    """Request payload for importing Coolbet bets via bookmarklet"""
    source: str  # Must be "coolbet"
    bets: List[CoolbetImportedBet]

class CoolbetImportResponse(BaseModel):
    """Response after importing Coolbet bets"""
    imported: int  # Number of bets successfully imported
    skipped: int  # Number of duplicates skipped
    total: int  # Total bets received
```

#### API Endpoint

**Endpoint**: `POST /api/bets/import/coolbet`

**Authentication**: Required (session token via cookie or Authorization header)

**Request Body**:
```json
{
  "source": "coolbet",
  "bets": [
    {
      "externalId": "coolbet_abc123",
      "event": "Liverpool - Manchester City",
      "stake": 10.0,
      "odds": 2.5,
      "result": "won",
      "placedAt": "2023-12-24T18:30:00Z",
      "selection": "Liverpool to win",
      "betType": "single"
    }
  ]
}
```

**Response**:
```json
{
  "imported": 12,
  "skipped": 3,
  "total": 15
}
```

#### Database Schema

**Collection**: `imported_bets`

```javascript
{
  "user_id": "user_abc123",
  "source": "coolbet",
  "external_id": "coolbet_xyz789",
  "event": "Liverpool - Manchester City",
  "selection": "Liverpool to win",
  "stake": 10.0,
  "odds": 2.5,
  "result": "won",
  "bet_type": "single",
  "placed_at": ISODate("2023-12-24T18:30:00Z"),
  "imported_at": ISODate("2023-12-24T20:00:00Z")
}
```

**Unique Index**: `(user_id, external_id, source)` - prevents duplicates

**Collection**: `bets` (also populated for analytics)

Bets are also inserted into the main `bets` collection with:
- Auto-detected sport using TheSportsDB API
- Calculated result value (profit/loss)
- Bookie set to "Coolbet"
- Notes indicating import source

#### Key Features

1. **Duplicate Prevention**:
   - Compound unique index on `(user_id, external_id, source)`
   - Silently skips duplicates without error
   - Returns count of skipped vs imported

2. **Data Validation**:
   - Validates result status (won/lost/pending)
   - Ensures stake and odds are positive numbers
   - Handles invalid timestamps gracefully

3. **Sport Detection**:
   - Uses existing `detect_sport_from_game_async()` function
   - Leverages TheSportsDB API for accurate sport categorization
   - Falls back to local pattern matching

4. **Error Handling**:
   - Continues processing even if individual bets fail
   - Logs errors without stopping entire import
   - Returns partial success results

### 2. Bookmarklet (JavaScript)

#### Files

- **Readable version**: `frontend/src/utils/coolbetBookmarklet.js`
- **Minified version**: `frontend/src/utils/coolbetBookmarkletMinified.js`

#### How It Works

1. **Extraction**:
   - Queries DOM for bet rows using multiple selectors
   - Defensive extraction with fallbacks
   - Validates minimum required data

2. **ID Generation**:
   - Creates stable `externalId` based on bet properties
   - Uses simple hash function for consistency
   - Format: `coolbet_[hash]`

3. **Data Normalization**:
   - Parses stake and odds from text
   - Maps result status to standard values
   - Converts dates to ISO format

4. **API Communication**:
   - Uses `fetch()` with `credentials: 'include'`
   - Sends JSON payload to backend
   - Handles authentication via cookies

5. **User Feedback**:
   - Shows loading alert during extraction
   - Confirms before sending data
   - Reports success/failure with details

#### DOM Selectors (Template)

The bookmarklet includes multiple selector patterns:

```javascript
const betRowSelectors = [
  '.bet-history-item',
  '.bet-row',
  '[data-bet-id]',
  'tr.bet',
  '.history-bet'
];
```

**⚠️ Important**: These selectors are **templates** based on common betting site patterns. They will likely need adjustment based on Coolbet's actual HTML structure.

#### Customization Guide

To adapt the bookmarklet to Coolbet's actual structure:

1. **Inspect Coolbet's HTML**:
   - Open bet history page
   - Right-click on a bet → Inspect
   - Note the class names and structure

2. **Update Selectors**:
   - Modify `betRowSelectors` array
   - Update element selectors for event, stake, odds, etc.
   - Test extraction in browser console

3. **Adjust Parsing**:
   - Update `parseDateTime()` for Coolbet's date format
   - Modify currency/number parsing if needed
   - Adapt result status mapping

### 3. Frontend (React)

#### Component

**File**: `frontend/src/pages/CoolbetImportPage.jsx`

**Route**: `/import/coolbet`

#### Features

1. **Multi-Method Installation**:
   - Drag-and-drop bookmarklet button
   - Manual bookmark creation with copy/paste
   - Development testing mode

2. **Clear Instructions**:
   - Step-by-step setup guide
   - Visual workflow (1-2-3 steps)
   - Browser-specific instructions

3. **Security Information**:
   - Prominent security disclaimer
   - Explanation of how it works
   - Privacy guarantees

4. **Troubleshooting Guide**:
   - Common issues and solutions
   - Authentication problems
   - DOM extraction failures

#### Environment Detection

The component automatically selects the appropriate bookmarklet:
- **Development**: Uses `http://localhost:8000` endpoint
- **Production**: Uses production domain endpoint

**⚠️ Important**: Update the production API endpoint in `coolbetBookmarkletMinified.js` before deployment:

```javascript
const API = 'https://your-domain.com/api/bets/import/coolbet';
```

## Deployment Checklist

### Backend

- [x] Pydantic models added to `server.py`
- [x] Import endpoint implemented
- [x] Duplicate prevention via unique index
- [x] Error handling and logging
- [x] Integration with existing sport detection
- [ ] Test endpoint with authentication
- [ ] Verify MongoDB index creation

### Bookmarklet

- [ ] **CRITICAL**: Update Coolbet DOM selectors based on actual HTML
- [ ] Test extraction on real Coolbet bet history page
- [ ] Update production API endpoint URL
- [ ] Test minified version works correctly
- [ ] Verify hash-based ID generation is stable

### Frontend

- [x] Import page component created
- [x] Route added to App.js
- [x] Navigation link added to Sidebar
- [ ] Test drag-and-drop bookmarklet installation
- [ ] Verify copy-to-clipboard functionality
- [ ] Test on multiple browsers

### Testing

- [ ] End-to-end test: Extract → Import → Verify in database
- [ ] Test duplicate prevention
- [ ] Test with various bet statuses (won/lost/pending)
- [ ] Test error handling (invalid data, auth failure)
- [ ] Test with empty bet history
- [ ] Test with pagination (multiple pages)

## Usage Flow

### User Perspective

1. **Setup (one-time)**:
   - Navigate to `/import/coolbet` in analytics app
   - Add bookmarklet to browser bookmarks bar
   - Keep analytics app tab open

2. **Import (repeatable)**:
   - Log into Coolbet
   - Navigate to bet history
   - Click bookmarklet
   - Confirm import
   - View results

### Technical Flow

1. **Extraction**:
   ```
   User clicks bookmarklet
   → Bookmarklet runs in Coolbet page context
   → DOM queries extract bet data
   → Data normalized to JSON
   ```

2. **Validation**:
   ```
   User confirms import
   → Bookmarklet validates minimum data
   → External IDs generated
   ```

3. **Import**:
   ```
   POST to /api/bets/import/coolbet
   → Backend validates session token
   → Backend validates source = "coolbet"
   → For each bet:
       → Check for duplicate (user_id + external_id)
       → If duplicate: skip
       → If new: insert to imported_bets
       → Insert to bets collection
   → Return summary
   ```

4. **Feedback**:
   ```
   Backend returns {imported, skipped, total}
   → Bookmarklet shows success alert
   → User can view imported bets
   ```

## Maintenance

### Common Issues

**1. "No bets found"**
- Cause: DOM selectors don't match Coolbet's HTML
- Solution: Update selectors in bookmarklet
- Debug: Check browser console for logged selector attempts

**2. "Import failed - Authentication error"**
- Cause: User not logged into analytics app
- Solution: Ensure user has valid session
- Debug: Check session token in request cookies

**3. "All bets skipped"**
- Cause: Bets already imported (duplicates)
- Solution: This is expected behavior
- Debug: Check imported_bets collection for existing records

**4. "Wrong sport detected"**
- Cause: Sport detection algorithm doesn't recognize team/event
- Solution: Relies on existing TheSportsDB integration
- Debug: Check event name format and sport detection logs

### Extending to Other Bookmakers

This architecture can be adapted for other bookmakers:

1. **Create new models**: `{Bookmaker}ImportedBet`, etc.
2. **Create new endpoint**: `/api/bets/import/{bookmaker}`
3. **Create new bookmarklet**: Update DOM selectors
4. **Create new frontend page**: Clone and customize
5. **Add navigation link**: Update Sidebar

## Security Considerations

### Threat Model

**What we protect against**:
- Credential theft (no credentials stored)
- Unauthorized imports (requires authentication)
- Data tampering (server-side validation)
- Duplicate imports (unique indexes)

**What users must protect**:
- Their analytics app session token
- Their Coolbet login session
- Their browser security

### Best Practices

1. **Always use HTTPS** in production
2. **Validate all input** server-side
3. **Rate limit** the import endpoint (future enhancement)
4. **Log import activity** for audit trail
5. **Allow users to delete** imported data

## Performance

### Scalability

- **Client-side extraction**: No load on backend for scraping
- **Batch import**: All visible bets sent in single request
- **Async processing**: Backend handles each bet independently
- **Index optimization**: Unique index for fast duplicate detection

### Limitations

- **Pagination**: Only imports visible bets (user must load more)
- **DOM changes**: Requires bookmarklet updates if Coolbet redesigns
- **Browser compatibility**: Modern browsers only
- **Rate limits**: No built-in throttling (future enhancement)

## Future Enhancements

1. **Auto-update mechanism**: Check for bookmarklet updates
2. **Batch pagination**: Automatically trigger "load more" on Coolbet
3. **Import history**: Track when imports occurred
4. **Selective import**: Allow filtering which bets to import
5. **Progress indicator**: Show import progress for large batches
6. **Export feature**: Allow exporting imported bets
7. **Undo import**: Bulk delete an import session
8. **Multi-bookmaker support**: Import from multiple sites

## Code Quality

### Design Decisions

1. **Separate collections**: `imported_bets` vs `bets` for tracking source
2. **Hash-based IDs**: Stable external IDs without relying on Coolbet's IDs
3. **Defensive parsing**: Continue on errors, return partial success
4. **Progressive enhancement**: Multiple installation methods for bookmarklet
5. **Environment detection**: Auto-select dev vs prod endpoint

### Testing Strategy

- **Unit tests**: Validation functions, ID generation
- **Integration tests**: Endpoint with mock data
- **E2E tests**: Full flow with test bookmaker
- **Manual tests**: Real Coolbet import

## License & Legal

**Important**: This is a client-side tool for personal data portability. Users:
- Must have legitimate access to their Coolbet account
- Must comply with Coolbet's Terms of Service
- Use this tool at their own risk
- Should verify legality in their jurisdiction

This tool does not:
- Violate Coolbet's systems
- Access data the user doesn't own
- Bypass security measures
- Automate actions without user consent

---

**Document Version**: 1.0  
**Last Updated**: December 24, 2025  
**Author**: Betting Analytics Development Team
