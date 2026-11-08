// Recharts needs literal colors; keep these in step with the tokens in index.css.
export const CHART = {
  positive: '#27D3A2',
  positiveSoft: '#6CEAC4',
  negative: '#F06A72',
  negativeSoft: '#FF9EA3',
  info: '#74AAFF',
  warning: '#F2B84B',
  neutral: '#95A3AA',
  grid: '#1D272C',
  axis: '#7A8990',
  zero: '#3A4A52',
  surface: '#11171B',
  background: '#090D10',
  text: '#F2F5F4',
};

export const STATUS_COLORS = {
  won: CHART.positive,
  lost: CHART.negative,
  push: CHART.neutral,
  cashed: CHART.warning,
  pending: CHART.info,
};

export const AXIS_TICK = {
  fill: CHART.axis,
  fontSize: 11,
  fontFamily: 'Inter, ui-sans-serif, sans-serif',
};
