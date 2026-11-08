export function niceStep(range, count = 4) {
  if (!(range > 0)) return 1;
  const raw = range / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

/** Ticks inside [min, max] on a round step, always including 0 when it is in range. */
export function niceTicks(min, max, count = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min === max) return [min];
  const step = niceStep(max - min, count);
  const ticks = [];
  for (let value = Math.ceil(min / step) * step; value <= max + step * 1e-9; value += step) {
    ticks.push(Math.abs(value) < step * 1e-9 ? 0 : Number(value.toFixed(10)));
  }
  return ticks;
}

/**
 * Domain for a secondary axis that keeps its bars inside the bottom `band` of the plot,
 * with zero in the middle of that band.
 */
export function bandDomain(maxAbsValue, band = 0.2) {
  const a = maxAbsValue > 0 ? maxAbsValue : 1;
  return [-a, a * (2 / band - 1)];
}

/** Domain for the main series that leaves room below for the band and a little air above. */
export function curveDomain(min, max, { bottom = 0.08, top = 0.1 } = {}) {
  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  const range = hi - lo || 1;
  return [lo - range * bottom, hi + range * top];
}
