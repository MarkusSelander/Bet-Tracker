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
  pdf.text('Bet Tracker-rapport', pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 10;
  pdf.setFontSize(10);
  pdf.setFont(undefined, 'normal');
  pdf.setTextColor(128);
  pdf.text(`Generert ${new Date().toLocaleDateString('nb-NO')}`, pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 15;
  pdf.setTextColor(0);

  // Summary Stats
  pdf.setFontSize(16);
  pdf.setFont(undefined, 'bold');
  pdf.text('Nøkkeltall', 15, yPosition);

  yPosition += 10;
  pdf.setFontSize(11);
  pdf.setFont(undefined, 'normal');

  const leftCol = 15;
  const rightCol = pageWidth / 2 + 10;

  // Left column stats
  pdf.setFont(undefined, 'bold');
  pdf.text('Spill totalt:', leftCol, yPosition);
  pdf.setFont(undefined, 'normal');
  pdf.text(`${stats?.total_bets || 0}`, leftCol + 40, yPosition);

  yPosition += 7;
  pdf.setFont(undefined, 'bold');
  pdf.text('Treffprosent:', leftCol, yPosition);
  pdf.setFont(undefined, 'normal');
  pdf.text(`${(stats?.win_rate || 0).toFixed(1)}%`, leftCol + 40, yPosition);

  // Right column stats
  yPosition = yPosition - 7;
  pdf.setFont(undefined, 'bold');
  pdf.text('ROI:', rightCol, yPosition);
  pdf.setFont(undefined, 'normal');
  const roiColor = (stats?.roi || 0) >= 0 ? [16, 185, 129] : [239, 68, 68];
  pdf.setTextColor(...roiColor);
  pdf.text(`${(stats?.roi || 0).toFixed(2)}%`, rightCol + 40, yPosition);
  pdf.setTextColor(0);

  yPosition += 7;
  pdf.setFont(undefined, 'bold');
  pdf.text('Resultat:', rightCol, yPosition);
  pdf.setFont(undefined, 'normal');
  const plColor = (stats?.total_profit_loss || 0) >= 0 ? [16, 185, 129] : [239, 68, 68];
  pdf.setTextColor(...plColor);
  pdf.text(formatCurrency(stats?.total_profit_loss || 0), rightCol + 40, yPosition);
  pdf.setTextColor(0);

  yPosition += 15;

  // Outcome Breakdown
  pdf.setFontSize(16);
  pdf.setFont(undefined, 'bold');
  pdf.text('Utfall', 15, yPosition);

  yPosition += 10;
  pdf.setFontSize(11);
  pdf.setFont(undefined, 'normal');

  pdf.text(`Vunnet: ${stats?.won_count || 0}`, leftCol, yPosition);
  pdf.text(`Tapt: ${stats?.lost_count || 0}`, leftCol + 40, yPosition);
  pdf.text(`Push: ${stats?.push_count || 0}`, leftCol + 80, yPosition);
  pdf.text(`Apne: ${stats?.pending_count || 0}`, leftCol + 120, yPosition);

  yPosition += 15;

  // Recent Bets Table
  if (recentBets && recentBets.length > 0) {
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('Siste spill', 15, yPosition);

    yPosition += 8;

    // Table headers
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'bold');
    pdf.text('Dato', 15, yPosition);
    pdf.text('Kamp', 35, yPosition);
    pdf.text('Odds', 100, yPosition);
    pdf.text('Innsats', 120, yPosition);
    pdf.text('Status', 145, yPosition);
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
    pdf.text('Resultatutvikling', 15, yPosition);

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
    pdf.text(`Side ${i} av ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    pdf.text('Generert av Bet Tracker', pageWidth / 2, pageHeight - 6, { align: 'center' });
  }

  // Save the PDF
  pdf.save(`bet-tracker-report-${new Date().toISOString().split('T')[0]}.pdf`);
};

export const exportAnalyticsToPDF = async (stats, currency) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let yPosition = 20;

  const formatCurrency = (value) => {
    if (currency === 'UNITS') return `${value.toFixed(2)} U`;
    if (currency === 'NOK') return `${value.toFixed(2)} kr`;
    return `$${value.toFixed(2)}`;
  };

  pdf.setFontSize(24);
  pdf.setFont(undefined, 'bold');
  pdf.text('Analyserapport', pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 10;
  pdf.setFontSize(10);
  pdf.setFont(undefined, 'normal');
  pdf.setTextColor(128);
  pdf.text(`Generert ${new Date().toLocaleDateString('nb-NO')}`, pageWidth / 2, yPosition, { align: 'center' });
  pdf.setTextColor(0);

  yPosition += 15;
  pdf.setFontSize(16);
  pdf.setFont(undefined, 'bold');
  pdf.text('Nøkkeltall', 15, yPosition);

  yPosition += 10;
  pdf.setFontSize(11);
  pdf.setFont(undefined, 'normal');

  const leftCol = 15;
  const rightCol = pageWidth / 2 + 10;

  pdf.setFont(undefined, 'bold');
  pdf.text('Spill totalt:', leftCol, yPosition);
  pdf.setFont(undefined, 'normal');
  pdf.text(`${stats?.total_bets || 0}`, leftCol + 40, yPosition);

  yPosition += 7;
  pdf.setFont(undefined, 'bold');
  pdf.text('Treffprosent:', leftCol, yPosition);
  pdf.setFont(undefined, 'normal');
  pdf.text(`${(stats?.win_rate || 0).toFixed(1)}%`, leftCol + 40, yPosition);

  yPosition -= 7;
  pdf.setFont(undefined, 'bold');
  pdf.text('ROI:', rightCol, yPosition);
  pdf.setFont(undefined, 'normal');
  const roiColor = (stats?.roi || 0) >= 0 ? [16, 185, 129] : [239, 68, 68];
  pdf.setTextColor(...roiColor);
  pdf.text(`${(stats?.roi || 0).toFixed(2)}%`, rightCol + 40, yPosition);
  pdf.setTextColor(0);

  yPosition += 7;
  pdf.setFont(undefined, 'bold');
  pdf.text('Resultat:', rightCol, yPosition);
  pdf.setFont(undefined, 'normal');
  const plColor = (stats?.total_profit_loss || 0) >= 0 ? [16, 185, 129] : [239, 68, 68];
  pdf.setTextColor(...plColor);
  pdf.text(formatCurrency(stats?.total_profit_loss || 0), rightCol + 40, yPosition);
  pdf.setTextColor(0);

  const pageCount = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(128);
    pdf.text(`Side ${i} av ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    pdf.text('Generert av Bet Tracker', pageWidth / 2, pageHeight - 6, { align: 'center' });
  }

  pdf.save(`bet-tracker-analytics-${new Date().toISOString().split('T')[0]}.pdf`);
};
