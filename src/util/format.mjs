export function fmtPct(x) {
  if (x == null) return '—';
  return `${(x * 100).toFixed(1)}%`;
}

export function fmtNum(x, digits = 2) {
  if (x == null) return '—';
  return Number(x).toFixed(digits);
}

export function fmtAge(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 120) return `${Math.round(s)}s`;
  const m = s / 60;
  if (m < 120) return `${Math.round(m)}m`;
  const h = m / 60;
  return `${h.toFixed(1)}h`;
}

export function localDateTime(d) {
  try {
    return d.toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return d.toISOString();
  }
}
