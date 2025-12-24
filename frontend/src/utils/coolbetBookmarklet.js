/**
 * Coolbet Bet History Import Bookmarklet
 *
 * VERIFIED SELECTORS - Based on actual Coolbet DOM structure (December 2025)
 *
 * This script extracts bet data from Coolbet's bet history page and sends it
 * to the betting analytics app for import.
 *
 * USAGE:
 * 1. Navigate to Coolbet's bet history page while logged in
 * 2. Click the bookmarklet
 * 3. Bets will be extracted and sent to your analytics app
 *
 * SAFETY:
 * - Runs entirely in your browser
 * - No credentials are stored or transmitted
 * - Only bet data is extracted and sent
 */

(async function () {
  'use strict';

  // Configuration - PRODUCTION URL
  const API_ENDPOINT = 'https://bet-tracker-backend-rqjp.onrender.com/api/bets/import/coolbet';
  // For local development: const API_ENDPOINT = 'http://localhost:8000/api/bets/import/coolbet';

  try {
    // Confirm with user
    if (!window.confirm('Import Coolbet bets into Bet Tracker?')) {
      return;
    }

    // Extract bets from DOM using verified selectors
    const rows = document.querySelectorAll('.bet-ticket');

    if (rows.length === 0) {
      alert(
        'No bets found on this page.\n\nPlease ensure:\n1. You are on the bet history page\n2. Bet history has loaded'
      );
      return;
    }

    const bets = Array.from(rows).map((row) => {
      // Extract ticket ID from the ticket-id element
      const ticketId = row.querySelector('.ticket-id')?.innerText.replace('#', '').trim();

      // Extract sport from SVG icon data-name attribute
      const sport = row.querySelector('svg[data-name]')?.getAttribute('data-name') ?? 'unknown';

      // Extract league name
      const league = row.querySelector('.match-league')?.innerText.trim();

      // Extract event/match name
      const event = row.querySelector('.match-name')?.innerText.trim();

      // Extract market type (e.g., "Total Points Over/Under 230")
      const market = row.querySelector('.market-name')?.innerText.trim();

      // Extract outcome/selection (e.g., "Over", "Home Win")
      const outcome = row.querySelector('.market-outcome')?.innerText.trim();

      // Extract odds - handle comma as decimal separator
      const oddsText = row.querySelector('.ticket-total-odds')?.innerText;
      const odds = parseFloat(oddsText?.replace(',', '.') || '1.0');

      // Extract stake - remove currency symbols and handle comma
      const stakeText = row.querySelector('.ticket-total-stake')?.innerText;
      const stake = parseFloat(stakeText?.replace(/[^\d,]/g, '').replace(',', '.') || '0');

      // Extract result status
      const statusText = row.querySelector('.bet-status')?.innerText.toLowerCase();
      const result = statusText?.includes('won') ? 'won' : statusText?.includes('lost') ? 'lost' : 'pending';

      // Build full bet description for the "bet" field
      const betDescription = market && outcome ? `${market} - ${outcome}` : market || outcome || event;

      return {
        externalId: `coolbet-${ticketId}`,
        event: event || 'Unknown Event',
        stake,
        odds,
        result,
        placedAt: new Date().toISOString(),
        selection: betDescription,
        betType: 'single',
        sport,
        league,
        market,
        outcome,
      };
    });

    // Filter out invalid bets
    const validBets = bets.filter((bet) => bet.externalId && bet.stake > 0 && bet.odds > 0);

    if (validBets.length === 0) {
      alert('No valid bets found to import.');
      return;
    }

    console.log(`Found ${validBets.length} valid bets to import:`, validBets);

    // Send to API
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'coolbet',
        bets: validBets,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      alert(`Import failed: ${response.status} ${response.statusText}\n\nCheck console for details.`);
      console.error('Import error:', errorText);
      return;
    }

    const result = await response.json();
    alert(
      `✅ Import Complete!\n\n` +
        `Total: ${result.total}\n` +
        `Imported: ${result.imported}\n` +
        `Skipped (duplicates): ${result.skipped}`
    );
  } catch (error) {
    alert(
      `❌ Import Failed\n\n` +
        `Error: ${error.message}\n\n` +
        `Please ensure:\n` +
        `1. You are logged into your Bet Tracker app\n` +
        `2. You are on the Coolbet bet history page\n` +
        `3. Your internet connection is working`
    );
    console.error('Bookmarklet error:', error);
  }
})();
