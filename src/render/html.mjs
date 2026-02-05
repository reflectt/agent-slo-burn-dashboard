import { fmtPct, fmtNum, localDateTime } from '../util/format.mjs';

function esc(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function statusColor(s) {
  if (s === 'OK') return '#16a34a';
  if (s === 'WARN') return '#f59e0b';
  if (s === 'ALERT') return '#dc2626';
  return '#6b7280';
}

function fmtBurn(val) {
  if (val == null) return '—';
  if (!Number.isFinite(val)) return '∞';
  return fmtNum(val, 2);
}

function observedOrDash(v, kind = 'pct') {
  if (v == null) return '—';
  return kind === 'pct' ? fmtPct(v) : String(v);
}

export function renderHtml({ rollup }) {
  const short = Object.keys(rollup.slos.session_success.burnRate)[0] || '1h';
  const long = Object.keys(rollup.slos.session_success.burnRate)[1] || '6h';
  const win = '6h';

  const overall = rollup.overall?.status || 'UNKNOWN';
  const updated = localDateTime(new Date(rollup.generatedAt));

  const cards = [
    {
      title: 'SLO1 Sessions',
      key: 'session_success',
      status: rollup.slos.session_success.status,
      main: `${observedOrDash(rollup.slos.session_success.observed?.[win])} / ${fmtPct(rollup.slos.session_success.target)}`,
      burn: `${short} ${fmtBurn(rollup.slos.session_success.burnRate?.[short])}  ${long} ${fmtBurn(rollup.slos.session_success.burnRate?.[long])}`
    },
    {
      title: 'SLO2 Stuck Alerts',
      key: 'stuck_alert_rate',
      status: rollup.slos.stuck_alert_rate.status,
      main: `${observedOrDash(rollup.slos.stuck_alert_rate.observed?.[win])} / ≤${fmtPct(rollup.slos.stuck_alert_rate.targetMax)}`,
      burn: `${short} ${fmtBurn(rollup.slos.stuck_alert_rate.burnRate?.[short])}  ${long} ${fmtBurn(rollup.slos.stuck_alert_rate.burnRate?.[long])}`
    },
    {
      title: 'SLO3 Canaries',
      key: 'canary_pass',
      status: rollup.slos.canary_pass.status,
      main: `${observedOrDash(rollup.slos.canary_pass.observed?.[win])} / ${fmtPct(rollup.slos.canary_pass.target)}`,
      burn: `${short} ${fmtBurn(rollup.slos.canary_pass.burnRate?.[short])}  ${long} ${fmtBurn(rollup.slos.canary_pass.burnRate?.[long])}`
    }
  ];

  const top = rollup.topFailures || {};

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Agent SLOs + Burn Dashboard</title>
<style>
  body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; margin: 24px; color: #111827; }
  .bar { padding: 14px 16px; border-radius: 10px; color: white; background: ${statusColor(overall)}; display: flex; justify-content: space-between; align-items: baseline; }
  .bar h1 { font-size: 18px; margin: 0; }
  .bar .meta { font-size: 13px; opacity: 0.9; }
  .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
  .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; }
  .card .title { display: flex; justify-content: space-between; font-weight: 600; }
  .pill { padding: 2px 8px; border-radius: 999px; font-size: 12px; color: white; background: #6b7280; }
  .main { font-size: 22px; margin-top: 10px; }
  .sub { margin-top: 8px; font-size: 13px; color: #374151; }
  .section { margin-top: 18px; }
  .section h2 { font-size: 14px; margin: 0 0 6px; }
  ul { margin: 0; padding-left: 18px; }
  code { background: #f3f4f6; padding: 1px 4px; border-radius: 4px; }
  @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
</style>
</head>
<body>
  <div class="bar">
    <h1>Agent SLOs + Burn Dashboard</h1>
    <div class="meta">overall=<b>${esc(overall)}</b> &nbsp; updated=${esc(updated)}</div>
  </div>

  <div class="grid">
    ${cards
      .map((c) => {
        return `<div class="card">
          <div class="title">
            <div>${esc(c.title)}</div>
            <span class="pill" style="background:${statusColor(c.status)}">${esc(c.status)}</span>
          </div>
          <div class="main">${esc(c.main)}</div>
          <div class="sub">burn: ${esc(c.burn)}</div>
        </div>`;
      })
      .join('')}
  </div>

  <div class="section">
    <h2>Top failures (best-effort)</h2>
    <ul>
      <li>Sessions: ${esc(fmtTop(top.sessions))}</li>
      <li>Canaries: ${esc(fmtTop(top.canaries))}</li>
      <li>Alerts: ${esc(fmtTop(top.alerts))}</li>
    </ul>
  </div>

  <div class="section">
    <h2>Data sources</h2>
    <ul>
      <li>generatedAt: <code>${esc(rollup.generatedAt)}</code></li>
    </ul>
  </div>
</body>
</html>`;
}

function fmtTop(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '—';
  return arr.map((x) => `${x.key}(${x.count})`).join(', ');
}
