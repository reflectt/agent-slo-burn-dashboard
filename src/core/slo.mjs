import { inWindow } from './windows.mjs';

export function computeSessionSuccess({ sessions, win }) {
  const inWin = sessions.filter((s) => inWindow(s.tsStart, win));
  const n = inWin.length;
  const ok = inWin.filter((s) => s.status === 'success').length;
  const fail = inWin.filter((s) => s.status === 'fail').length;
  const unknown = n - ok - fail;
  const observed = n === 0 ? null : ok / n;
  return { n, ok, fail, unknown, observed, items: inWin };
}

export function computeAlertRates({ sessions, alerts, win }) {
  const sessInWin = sessions.filter((s) => inWindow(s.tsStart, win));
  const sessionCount = sessInWin.length;

  const alertsInWin = alerts.filter((a) => inWindow(a.ts, win));
  const stuck = alertsInWin.filter((a) => a.type === 'stuck').length;

  // If we have sessions, normalize by sessions; else fallback to per-hour style denominator.
  if (sessionCount > 0) {
    const observedRate = stuck / sessionCount;
    return { nSessions: sessionCount, stuck, observedRate, items: alertsInWin, denom: 'sessions' };
  }

  // Fallback: rate per alert events (gives something stable-ish).
  const denom = alertsInWin.length;
  const observedRate = denom === 0 ? null : stuck / denom;
  return { nSessions: 0, stuck, observedRate, items: alertsInWin, denom: 'alerts' };
}

export function computeCanaryPass({ canaries, win }) {
  const inWin = canaries.filter((c) => inWindow(c.ts, win));
  const n = inWin.length;
  const pass = inWin.filter((c) => c.status === 'pass').length;
  const fail = inWin.filter((c) => c.status === 'fail').length;
  const unknown = n - pass - fail;
  const observed = n === 0 ? null : pass / n;
  return { n, pass, fail, unknown, observed, items: inWin };
}

export function topCounts(items, keyFn, limit = 5) {
  const m = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (!k) continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}
