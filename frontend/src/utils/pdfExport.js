import html2canvas from 'html2canvas';
// eslint-disable-next-line import/no-named-as-default
import jsPDF from 'jspdf';

export const exportDashboardToPDF = async (stats, chartData, recentBets, currency) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let yPosition = 20;

  // Helper function to format currency
  const formatCurrency = (value) => {
    if (currency === 'UNITS') return `${value.toFixed(2)} U`;
    if (currency === 'NOK') return `${value.toFixed(2)} kr`;
    return `$${value.toFixed(2)}`;
  };

  // Title
  pdf.setFontSize(24);
  pdf.setFont(undefined, 'bold');
  pdf.text('Bet Tracker Report', pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 10;
  pdf.setFontSize(10);
  pdf.setFont(undefined, 'normal');
  pdf.setTextColor(128);
  pdf.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 15;
  pdf.setTextColor(0);

  // Summary Stats
  pdf.setFontSize(16);
  pdf.setFont(undefined, 'bold');
  pdf.text('Summary Statistics', 15, yPosition);

  yPosition += 10;
  pdf.setFontSize(11);
  pdf.setFont(undefined, 'normal');

  const leftCol = 15;
  const rightCol = pageWidth / 2 + 10;

  // Left column stats
  pdf.setFont(undefined, 'bold');
  pdf.text('Total Bets:', leftCol, yPosition);
  pdf.setFont(undefined, 'normal');
  pdf.text(`${stats?.total_bets || 0}`, leftCol + 40, yPosition);

  yPosition += 7;
  pdf.setFont(undefined, 'bold');
  pdf.text('Win Rate:', leftCol, yPosition);
  pdf.setFont(undefined, 'normal');
  pdf.text(`${(stats?.win_rate || 0).toFixed(1)}%`, leftCol + 40, yPosition);

  // Right column stats
  yPosition = yPosition - 7;
  pdf.setFont(undefined, 'bold');
  pdf.text('Total ROI:', rightCol, yPosition);
  pdf.setFont(undefined, 'normal');
  const roiColor = (stats?.roi || 0) >= 0 ? [16, 185, 129] : [239, 68, 68];
  pdf.setTextColor(...roiColor);
  pdf.text(`${(stats?.roi || 0).toFixed(2)}%`, rightCol + 40, yPosition);
  pdf.setTextColor(0);

  yPosition += 7;
  pdf.setFont(undefined, 'bold');
  pdf.text('Total Result:', rightCol, yPosition);
  pdf.setFont(undefined, 'normal');
  const plColor = (stats?.total_profit_loss || 0) >= 0 ? [16, 185, 129] : [239, 68, 68];
  pdf.setTextColor(...plColor);
  pdf.text(formatCurrency(stats?.total_profit_loss || 0), rightCol + 40, yPosition);
  pdf.setTextColor(0);

  yPosition += 15;

  // Outcome Breakdown
  pdf.setFontSize(16);
  pdf.setFont(undefined, 'bold');
  pdf.text('Outcome Breakdown', 15, yPosition);

  yPosition += 10;
  pdf.setFontSize(11);
  pdf.setFont(undefined, 'normal');

  pdf.text(`Won: ${stats?.won_count || 0}`, leftCol, yPosition);
  pdf.text(`Lost: ${stats?.lost_count || 0}`, leftCol + 40, yPosition);
  pdf.text(`Push: ${stats?.push_count || 0}`, leftCol + 80, yPosition);
  pdf.text(`Pending: ${stats?.pending_count || 0}`, leftCol + 120, yPosition);

  yPosition += 15;

  // Recent Bets Table
  if (recentBets && recentBets.length > 0) {
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('Recent Bets', 15, yPosition);

    yPosition += 8;

    // Table headers
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'bold');
    pdf.text('Date', 15, yPosition);
    pdf.text('Match', 35, yPosition);
    pdf.text('Odds', 100, yPosition);
    pdf.text('Stake', 120, yPosition);
    pdf.text('Result', 145, yPosition);
    pdf.text('P/L', 170, yPosition);

    yPosition += 2;
    pdf.line(15, yPosition, pageWidth - 15, yPosition);
    yPosition += 5;

    // Table rows
    pdf.setFont(undefined, 'normal');
    const maxRows = Math.min(recentBets.length, 15);

    for (let i = 0; i < maxRows; i++) {
      const bet = recentBets[i];

      if (yPosition > pageHeight - 20) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.text(bet.date, 15, yPosition);
      pdf.text(bet.match.substring(0, 30), 35, yPosition);
      pdf.text(bet.odds.toFixed(2), 100, yPosition);
      pdf.text(formatCurrency(bet.stake), 120, yPosition);

      // Result with color
      if (bet.result === 'won') {
        pdf.setTextColor(16, 185, 129);
      } else if (bet.result === 'lost') {
        pdf.setTextColor(239, 68, 68);
      }
      pdf.text(bet.result.toUpperCase(), 145, yPosition);

      // P/L with color
      const plText = (bet.profit_loss >= 0 ? '+' : '') + formatCurrency(bet.profit_loss);
      pdf.text(plText, 170, yPosition);
      pdf.setTextColor(0);

      yPosition += 6;
    }
  }

  // Chart page
  const chartElement = document.querySelector('.recharts-wrapper');
  if (chartElement) {
    pdf.addPage();
    yPosition = 20;

    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('Profit/Loss Chart', 15, yPosition);

    yPosition += 10;

    try {
      const canvas = await html2canvas(chartElement, {
        backgroundColor: '#09090B',
        scale: 2,
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pageWidth - 30;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 15, yPosition, imgWidth, imgHeight);
    } catch (error) {
      console.error('Error capturing chart:', error);
    }
  }

  // Footer on all pages
  const pageCount = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(128);
    pdf.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    pdf.text('Generated by Bet Tracker', pageWidth / 2, pageHeight - 6, { align: 'center' });
  }

  // Save the PDF
  pdf.save(`bet-tracker-report-${new Date().toISOString().split('T')[0]}.pdf`);
};

export const exportAnalyticsToPDF = async (stats, bookmakerStats, tipsterStats, currency) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let yPosition = 20;

  const formatCurrency = (value) => {
    if (currency === 'UNITS') return `${value.toFixed(2)} U`;
    if (currency === 'NOK') return `${value.toFixed(2)} kr`;
    return `$${value.toFixed(2)}`;
  };

  // Title
  pdf.setFontSize(24);
  pdf.setFont(undefined, 'bold');
  pdf.text('Analytics Report', pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 10;
  pdf.setFontSize(10);
  pdf.setFont(undefined, 'normal');
  pdf.setTextColor(128);
  pdf.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, yPosition, { align: 'center' });
  pdf.setTextColor(0);

  yPosition += 15;

  // Bookmaker Performance
  if (bookmakerStats && bookmakerStats.length > 0) {
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('Bookmaker Performance', 15, yPosition);

    yPosition += 8;

    // Table headers
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'bold');
    pdf.text('Bookmaker', 15, yPosition);
    pdf.text('Bets', 70, yPosition);
    pdf.text('Win Rate', 95, yPosition);
    pdf.text('P/L', 130, yPosition);
    pdf.text('ROI', 165, yPosition);

    yPosition += 2;
    pdf.line(15, yPosition, pageWidth - 15, yPosition);
    yPosition += 5;

    // Table rows
    pdf.setFont(undefined, 'normal');

    for (let i = 0; i < bookmakerStats.length; i++) {
      const bm = bookmakerStats[i];

      if (yPosition > pageHeight - 20) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.text(bm.name || 'Unknown', 15, yPosition);
      pdf.text((bm.bets || 0).toString(), 70, yPosition);
      pdf.text(`${(bm.win_rate || 0).toFixed(1)}%`, 95, yPosition);

      // P/L with color
      if ((bm.profit_loss || 0) >= 0) {
        pdf.setTextColor(16, 185, 129);
      } else {
        pdf.setTextColor(239, 68, 68);
      }
      pdf.text(formatCurrency(bm.profit_loss || 0), 130, yPosition);
      pdf.text(`${(bm.roi || 0) >= 0 ? '+' : ''}${(bm.roi || 0).toFixed(2)}%`, 165, yPosition);
      pdf.setTextColor(0);

      yPosition += 6;
    }
  }

  yPosition += 10;

  // Tipster Performance
  if (tipsterStats && tipsterStats.length > 0) {
    if (yPosition > pageHeight - 60) {
      pdf.addPage();
      yPosition = 20;
    }

    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('Tipster Performance', 15, yPosition);

    yPosition += 8;

    // Table headers
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'bold');
    pdf.text('Tipster', 15, yPosition);
    pdf.text('Bets', 70, yPosition);
    pdf.text('Win Rate', 95, yPosition);
    pdf.text('P/L', 130, yPosition);
    pdf.text('ROI', 165, yPosition);

    yPosition += 2;
    pdf.line(15, yPosition, pageWidth - 15, yPosition);
    yPosition += 5;

    // Table rows
    pdf.setFont(undefined, 'normal');

    for (let i = 0; i < tipsterStats.length; i++) {
      const tip = tipsterStats[i];

      if (yPosition > pageHeight - 20) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.text(tip.name || 'Unknown', 15, yPosition);
      pdf.text((tip.bets || 0).toString(), 70, yPosition);
      pdf.text(`${(tip.win_rate || 0).toFixed(1)}%`, 95, yPosition);

      // P/L with color
      if ((tip.profit_loss || 0) >= 0) {
        pdf.setTextColor(16, 185, 129);
      } else {
        pdf.setTextColor(239, 68, 68);
      }
      pdf.text(formatCurrency(tip.profit_loss || 0), 130, yPosition);
      pdf.text(`${(tip.roi || 0) >= 0 ? '+' : ''}${(tip.roi || 0).toFixed(2)}%`, 165, yPosition);
      pdf.setTextColor(0);

      yPosition += 6;
    }
  }

  // Footer
  const pageCount = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(128);
    pdf.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    pdf.text('Generated by Bet Tracker', pageWidth / 2, pageHeight - 6, { align: 'center' });
  }

  pdf.save(`bet-tracker-analytics-${new Date().toISOString().split('T')[0]}.pdf`);
};
