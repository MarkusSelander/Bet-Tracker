const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const NBSP = '\u00A0';

function capturePdfWrites(run) {
  const original = fs.writeFileSync;
  const files = [];
  fs.writeFileSync = (filename, data) => {
    files.push({ filename: String(filename), data: Buffer.from(data) });
  };
  return Promise.resolve()
    .then(run)
    .finally(() => {
      fs.writeFileSync = original;
    })
    .then(() => files);
}

function pdfText(file) {
  return file.data.toString('latin1');
}

test('svakeste dag i rapporten er et negativt beløp uten anførselstegn', async () => {
  const { exportDashboardToPDF, exportAnalyticsToPDF } = await import('./pdfExport.js');
  const chartData = [
    { date: '2026-09-09', daily_pl: 11542.75, cumulative_pl: 11542.75 },
    { date: '2026-10-10', daily_pl: -4346.47, cumulative_pl: 7196.28 },
  ];

  const files = await capturePdfWrites(async () => {
    await exportDashboardToPDF(
      { total_profit_loss: 7196.28, total_bets: 2, total_stake: 1000, roi: 12 },
      chartData,
      [
        {
          date: '2026-10-10',
          game: 'Kamp',
          bet: '1',
          odds: 1.8,
          stake: 100,
          status: 'lost',
          result: -250,
        },
      ],
      'NOK',
      {}
    );
    await exportAnalyticsToPDF({ total_profit_loss: -4346.47, total_bets: 2, total_stake: 1000, roi: -10 }, 'NOK', {
      chartData,
      sportStats: [{ name: 'Fotball', bets: 2, win_rate: 50, stake: 1000, profit_loss: -4346.47, roi: -10 }],
    });
  });

  assert.equal(files.length, 2);
  for (const file of files) {
    const text = pdfText(file);
    assert.equal(text.includes('"\x12'), false, `${file.filename} koder minus som anførselstegn`);
    assert.ok(text.includes(`(-4${NBSP}346,47 kr)`), `${file.filename} mangler −4 346,47 kr`);
  }

  const dashboard = pdfText(files[0]);
  assert.ok(dashboard.includes(`(+11${NBSP}542,75 kr)`), 'beste dag skal fortsatt ha plusstegn');
  assert.ok(dashboard.includes('(-250,00 kr)'), 'negativt spillresultat skal være et tall');
});
