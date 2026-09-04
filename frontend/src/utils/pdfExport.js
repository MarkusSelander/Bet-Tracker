// eslint-disable-next-line import/no-named-as-default
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { STATUS_LABELS, formatCurrency } from '../lib/format';

const INK = [24, 24, 27];
const MUTED = [113, 113, 122];
const LINE = [228, 228, 231];
const GREEN = [16, 185, 129];
const RED = [239, 68, 68];
const HEADER = [9, 9, 11];
const MARGIN = 16;
const BOTTOM = 18;

function money(value, currency) {
  return formatCurrency(value, currency, 2);
}

function signedMoney(value, currency) {
  const amount = Number(value) || 0;
  return `${amount >= 0 ? '+' : ''}${money(amount, currency)}`;
}

function signedPct(value) {
  const amount = Number(value) || 0;
  return `${amount >= 0 ? '+' : ''}${amount.toFixed(1)}%`;
}

function plColor(value) {
  return (Number(value) || 0) >= 0 ? GREEN : RED;
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status || '-';
}

function ensureSpace(pdf, y, needed = 24) {
  const pageHeight = pdf.internal.pageSize.getHeight();
  if (y + needed <= pageHeight - BOTTOM) return y;
  pdf.addPage();
  return 20;
}

function drawHeader(pdf, { title, subtitle, meta }) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  pdf.setFillColor(...HEADER);
  pdf.rect(0, 0, pageWidth, 32, 'F');
  pdf.setFillColor(...GREEN);
  pdf.rect(0, 32, pageWidth, 1.4, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('BET TRACKER', MARGIN, 12);
  pdf.setFontSize(16);
  pdf.text(title, MARGIN, 21);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(161, 161, 170);
  pdf.text(subtitle, MARGIN, 28);

  if (meta) {
    pdf.setTextColor(212, 212, 216);
    pdf.text(meta, pageWidth - MARGIN, 21, { align: 'right' });
  }
}

function drawFooters(pdf, generatedAt) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageCount = pdf.internal.getNumberOfPages();

  for (let i = 1; i <= pageCount; i += 1) {
    pdf.setPage(i);
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.3);
    pdf.line(MARGIN, pageHeight - 12, pageWidth - MARGIN, pageHeight - 12);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.text(`Bet Tracker  ·  ${generatedAt}`, MARGIN, pageHeight - 7);
    pdf.text(`Side ${i} av ${pageCount}`, pageWidth - MARGIN, pageHeight - 7, { align: 'right' });
  }
}

function sectionTitle(pdf, title, y) {
  const nextY = ensureSpace(pdf, y, 14);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(...INK);
  pdf.text(title, MARGIN, nextY);
  pdf.setDrawColor(...GREEN);
  pdf.setLineWidth(0.6);
  pdf.line(MARGIN, nextY + 1.6, MARGIN + 18, nextY + 1.6);
  return nextY + 8;
}

function drawKpis(pdf, items, y) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const gap = 3.5;
  const cols = 3;
  const boxW = (pageWidth - MARGIN * 2 - gap * (cols - 1)) / cols;
  const boxH = 18;
  let nextY = ensureSpace(pdf, y, boxH + 2);

  items.forEach((item, index) => {
    if (index > 0 && index % cols === 0) {
      nextY += boxH + gap;
      nextY = ensureSpace(pdf, nextY, boxH + 2);
    }
    const col = index % cols;
    const x = MARGIN + col * (boxW + gap);
    pdf.setFillColor(250, 250, 250);
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(x, nextY, boxW, boxH, 1.5, 1.5, 'FD');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    pdf.text(item.label, x + 3, nextY + 6);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(...(item.color || INK));
    pdf.text(String(item.value), x + 3, nextY + 13.5);
  });

  return nextY + boxH + 8;
}

function drawSummary(pdf, text, y) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const nextY = ensureSpace(pdf, y, 16);
  pdf.setFillColor(236, 253, 245);
  pdf.roundedRect(MARGIN, nextY, pageWidth - MARGIN * 2, 12, 1.5, 1.5, 'F');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...INK);
  const lines = pdf.splitTextToSize(text, pageWidth - MARGIN * 2 - 8);
  pdf.text(lines, MARGIN + 4, nextY + 7.5);
  return nextY + Math.max(12, lines.length * 4.5 + 6) + 6;
}

function drawLineChart(pdf, data, y, valueKey, title) {
  if (!data?.length) return y;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const width = pageWidth - MARGIN * 2;
  const height = 48;
  let nextY = sectionTitle(pdf, title, y);
  nextY = ensureSpace(pdf, nextY, height + 8);

  const values = data.map((row) => Number(row[valueKey]) || 0);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const plotX = MARGIN + 2;
  const plotY = nextY;
  const plotW = width - 4;
  const plotH = height;

  pdf.setDrawColor(...LINE);
  pdf.setLineWidth(0.3);
  pdf.rect(plotX, plotY, plotW, plotH);

  const zeroY = plotY + plotH - ((0 - min) / span) * plotH;
  pdf.setDrawColor(212, 212, 216);
  pdf.line(plotX, zeroY, plotX + plotW, zeroY);

  const points = values.map((value, index) => {
    const x = plotX + (index / Math.max(values.length - 1, 1)) * plotW;
    const py = plotY + plotH - ((value - min) / span) * plotH;
    return [x, py];
  });

  pdf.setDrawColor(...GREEN);
  pdf.setLineWidth(0.7);
  points.forEach((point, index) => {
    if (index === 0) return;
    pdf.line(points[index - 1][0], points[index - 1][1], point[0], point[1]);
  });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(...MUTED);
  pdf.text(data[0].date || '', plotX, plotY + plotH + 4);
  pdf.text(data[data.length - 1].date || '', plotX + plotW, plotY + plotH + 4, { align: 'right' });

  return nextY + height + 10;
}

function addTable(pdf, y, columns, rows, { colorColumn } = {}) {
  if (!rows.length) return y;
  autoTable(pdf, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, bottom: BOTTOM + 2 },
    head: [columns.map((col) => col.header)],
    body: rows.map((row) => columns.map((col) => row[col.key])),
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 },
      textColor: INK,
      lineColor: LINE,
      lineWidth: 0.15,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: HEADER,
      textColor: [250, 250, 250],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: columns.reduce((acc, col, index) => {
      if (col.align) acc[index] = { halign: col.align };
      return acc;
    }, {}),
    didParseCell: (data) => {
      if (!colorColumn || data.section !== 'body') return;
      const column = columns[data.column.index];
      if (column?.key !== colorColumn) return;
      const raw = rows[data.row.index]?.[`${colorColumn}Raw`];
      if (typeof raw === 'number') {
        data.cell.styles.textColor = plColor(raw);
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });
  return pdf.lastAutoTable.finalY + 8;
}

function streakText(stats) {
  const count = stats?.current_streak || 0;
  if (!count || !stats?.current_streak_type) return 'Ingen aktiv streak';
  const label = stats.current_streak_type === 'won' ? 'vunnet' : 'tapt';
  return `${count} ${label} på rad. Beste ${stats.best_win_streak || 0}V, verst ${stats.worst_loss_streak || 0}T`;
}

function chartExtremes(chartData) {
  if (!chartData?.length) return null;
  return {
    best: chartData.reduce((acc, row) => (row.daily_pl > acc.daily_pl ? row : acc), chartData[0]),
    worst: chartData.reduce((acc, row) => (row.daily_pl < acc.daily_pl ? row : acc), chartData[0]),
  };
}

function buildKpis(stats, currency) {
  const stake = stats?.total_stake || 0;
  const bets = stats?.total_bets || 0;
  return [
    {
      label: 'Resultat',
      value: signedMoney(stats?.total_profit_loss, currency),
      color: plColor(stats?.total_profit_loss),
    },
    { label: 'ROI', value: signedPct(stats?.roi), color: plColor(stats?.roi) },
    { label: 'Treffprosent', value: `${(stats?.win_rate || 0).toFixed(1)}%` },
    { label: 'Spill totalt', value: String(bets) },
    { label: 'Innsats', value: money(stake, currency) },
    { label: 'Snittinnsats', value: money(stake / (bets || 1), currency) },
  ];
}

function outcomeRows(stats) {
  const total = stats?.total_bets || 0;
  return [
    ['Vunnet', stats?.won_count || 0],
    ['Tapt', stats?.lost_count || 0],
    ['Push', stats?.push_count || 0],
    ['Cashout', stats?.cashed_count || 0],
    ['Åpne', stats?.pending_count || 0],
  ].map(([name, count]) => ({
    name,
    count: String(count),
    share: total ? `${((count / total) * 100).toFixed(1)}%` : '0.0%',
  }));
}

function breakdownRows(rows, currency) {
  return [...(rows || [])]
    .filter((row) => row.bets > 0)
    .sort((a, b) => (b.profit_loss || 0) - (a.profit_loss || 0))
    .map((row) => ({
      name: row.name || '-',
      bets: String(row.bets || 0),
      winRate: `${(row.win_rate || 0).toFixed(1)}%`,
      stake: money(row.stake, currency),
      result: signedMoney(row.profit_loss, currency),
      resultRaw: Number(row.profit_loss) || 0,
      roi: signedPct(row.roi),
    }));
}

function betRows(bets, currency) {
  return (bets || []).map((bet) => ({
    date: bet.date || '-',
    game: (bet.game || bet.match || '-').slice(0, 42),
    market: (bet.bet || '-').slice(0, 28),
    odds: Number(bet.odds || 0).toFixed(2),
    stake: money(bet.stake, currency),
    status: statusLabel(typeof bet.status === 'string' ? bet.status : ''),
    result: signedMoney(bet.result ?? bet.profit_loss, currency),
    resultRaw: Number(bet.result ?? bet.profit_loss) || 0,
  }));
}

const BET_COLUMNS = [
  { header: 'Dato', key: 'date' },
  { header: 'Kamp', key: 'game' },
  { header: 'Marked', key: 'market' },
  { header: 'Odds', key: 'odds', align: 'right' },
  { header: 'Innsats', key: 'stake', align: 'right' },
  { header: 'Status', key: 'status' },
  { header: 'Resultat', key: 'result', align: 'right' },
];

const BREAKDOWN_COLUMNS = [
  { header: 'Navn', key: 'name' },
  { header: 'Spill', key: 'bets', align: 'right' },
  { header: 'Treff %', key: 'winRate', align: 'right' },
  { header: 'Innsats', key: 'stake', align: 'right' },
  { header: 'Resultat', key: 'result', align: 'right' },
  { header: 'ROI', key: 'roi', align: 'right' },
];

function startReport({ title, subtitle, meta, stats, currency }) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  drawHeader(pdf, { title, subtitle, meta });
  let y = 42;
  y = drawSummary(
    pdf,
    `Resultat ${signedMoney(stats?.total_profit_loss, currency)} (${signedPct(stats?.roi)} ROI) på ${
      stats?.total_bets || 0
    } spill. ${streakText(stats)}.`,
    y
  );
  y = drawKpis(pdf, buildKpis(stats, currency), y);
  y = sectionTitle(pdf, 'Utfall', y);
  y = addTable(
    pdf,
    y,
    [
      { header: 'Status', key: 'name' },
      { header: 'Antall', key: 'count', align: 'right' },
      { header: 'Andel', key: 'share', align: 'right' },
    ],
    outcomeRows(stats)
  );
  return { pdf, y };
}

export const exportDashboardToPDF = async (stats, chartData, recentBets, currency, extra = {}) => {
  const generatedAt = new Date().toLocaleString('nb-NO');
  const { pdf, y: startY } = startReport({
    title: 'Resultatrapport',
    subtitle: extra.userName ? `${extra.userName}  ·  Siste 30 dager og åpne spill` : 'Siste 30 dager og åpne spill',
    meta: generatedAt,
    stats,
    currency,
  });
  let y = startY;

  const extremes = chartExtremes(chartData);
  if (extremes) {
    y = sectionTitle(pdf, 'Periode', y);
    y = addTable(
      pdf,
      y,
      [
        { header: 'Dag', key: 'label' },
        { header: 'Dato', key: 'date' },
        { header: 'Resultat', key: 'result', align: 'right' },
      ],
      [
        {
          label: 'Beste dag',
          date: extremes.best.date,
          result: signedMoney(extremes.best.daily_pl, currency),
          resultRaw: extremes.best.daily_pl,
        },
        {
          label: 'Svakeste dag',
          date: extremes.worst.date,
          result: signedMoney(extremes.worst.daily_pl, currency),
          resultRaw: extremes.worst.daily_pl,
        },
      ],
      { colorColumn: 'result' }
    );
  }

  y = drawLineChart(pdf, chartData, y, 'cumulative_pl', 'Akkumulert resultat');

  const pendingBets = extra.pendingBets || [];
  if (pendingBets.length) {
    const pendingStake = pendingBets.reduce((sum, bet) => sum + (Number(bet.stake) || 0), 0);
    y = sectionTitle(pdf, `Åpne spill (${pendingBets.length} · ${money(pendingStake, currency)})`, y);
    y = addTable(pdf, y, BET_COLUMNS, betRows(pendingBets, currency), { colorColumn: 'result' });
  }

  if (recentBets?.length) {
    y = sectionTitle(pdf, 'Siste spill', y);
    addTable(pdf, y, BET_COLUMNS, betRows(recentBets, currency), { colorColumn: 'result' });
  }

  drawFooters(pdf, generatedAt);
  pdf.save(`bet-tracker-rapport-${new Date().toISOString().split('T')[0]}.pdf`);
};

export const exportAnalyticsToPDF = async (stats, currency, extra = {}) => {
  const generatedAt = new Date().toLocaleString('nb-NO');
  const period = extra.periodLabel || 'Valgt periode';
  const sport = extra.sportLabel || 'Alle sporter';
  const { pdf, y: startY } = startReport({
    title: 'Analyserapport',
    subtitle: extra.userName ? `${extra.userName}  ·  ${period}  ·  ${sport}` : `${period}  ·  ${sport}`,
    meta: generatedAt,
    stats,
    currency,
  });
  let y = startY;

  const extremes = chartExtremes(extra.chartData);
  if (extremes) {
    y = sectionTitle(pdf, 'Periode', y);
    y = addTable(
      pdf,
      y,
      [
        { header: 'Dag', key: 'label' },
        { header: 'Dato', key: 'date' },
        { header: 'Resultat', key: 'result', align: 'right' },
      ],
      [
        {
          label: 'Beste dag',
          date: extremes.best.date,
          result: signedMoney(extremes.best.daily_pl, currency),
          resultRaw: extremes.best.daily_pl,
        },
        {
          label: 'Svakeste dag',
          date: extremes.worst.date,
          result: signedMoney(extremes.worst.daily_pl, currency),
          resultRaw: extremes.worst.daily_pl,
        },
      ],
      { colorColumn: 'result' }
    );
  }

  y = drawLineChart(pdf, extra.chartData, y, 'cumulative_pl', 'Akkumulert resultat');

  const sports = breakdownRows(extra.sportStats, currency);
  if (sports.length) {
    y = sectionTitle(pdf, 'Per sport', y);
    y = addTable(pdf, y, BREAKDOWN_COLUMNS, sports, { colorColumn: 'result' });
  }

  const odds = breakdownRows(extra.oddsRangeStats, currency);
  if (odds.length) {
    y = sectionTitle(pdf, 'Per oddsintervall', y);
    addTable(pdf, y, BREAKDOWN_COLUMNS, odds, { colorColumn: 'result' });
  }

  drawFooters(pdf, generatedAt);
  pdf.save(`bet-tracker-analyse-${new Date().toISOString().split('T')[0]}.pdf`);
};
