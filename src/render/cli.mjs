import { fmtPct, fmtNum, fmtAge, localDateTime } from '../util/format.mjs';

const ANSI = {
  reset: '\u001b[0m',
  gray: '\u001b[90m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m'
};

function colorStatus(s) {
  if (s === 'OK') return ANSI.green + s + ANSI.reset;
  if (s === 'WARN') return ANSI.yellow + s + ANSI.reset;
  if (s === 'ALERT') return ANSI.red + s + ANSI.reset;
  return ANSI.gray + (s || 'UNKNOWN') + ANSI.reset;
}

function fmtObserved(val) {
  return val == null ? '—' : fmtPct(val);
}

function fmtBurn(val) {
  if (val == null) return '—';
  if (!Number.isFinite(val)) return '∞';
  return fmtNum(val, 2);
}

export function renderCli({ rollup, window, cfg }) {
  const updated = localDateTime(new Date(rollup.generatedAt));
  const overall = rollup.overall?.status || 'UNKNOWN';

  const short = cfg.windows?.short || '1h';
  const long = cfg.windows?.long || '6h';

  const s1 = rollup.slos.session_success;
  const s2 = rollup.slos.stuck_alert_rate;
  const s3 = rollup.slos.canary_pass;

  const lines = [];
  lines.push(`Agent SLOs + Burn Dashboard   window=${window}   updated=${updated}`);
  lines.push(`Overall: ${colorStatus(overall)}`);
  lines.push('');

  lines.push('SLOs');

  const c1 = s1.counts?.[window] || { n: 0, ok: 0, fail: 0 };
  lines.push(
    `- SLO1 session_success     ${fmtObserved(s1.observed?.[window])} (target ${fmtPct(s1.target)})   ` +
      `n=${c1.n} ok=${c1.ok} fail=${c1.fail}   burn ${short}=${fmtBurn(s1.burnRate?.[short])} ${long}=${fmtBurn(s1.burnRate?.[long])}   ${colorStatus(s1.status)}`
  );

  const c2 = s2.counts?.[window] || { nSessions: 0, stuck: 0, denom: 'sessions' };
  const observed2 = s2.observed?.[window];
  lines.push(
    `- SLO2 stuck_alert_rate    ${observed2 == null ? '—' : fmtPct(observed2)} (max ${fmtPct(s2.targetMax)})      ` +
      `stuck=${c2.stuck} denom=${c2.denom} sessions=${c2.nSessions}   burn ${short}=${fmtBurn(s2.burnRate?.[short])} ${long}=${fmtBurn(s2.burnRate?.[long])}   ${colorStatus(s2.status)}`
  );

  const c3 = s3.counts?.[window] || { n: 0, pass: 0, fail: 0 };
  lines.push(
    `- SLO3 canary_pass         ${fmtObserved(s3.observed?.[window])} (target ${fmtPct(s3.target)})   ` +
      `n=${c3.n} pass=${c3.pass} fail=${c3.fail}   burn ${short}=${fmtBurn(s3.burnRate?.[short])} ${long}=${fmtBurn(s3.burnRate?.[long])}   ${colorStatus(s3.status)}`
  );

  lines.push('');
  lines.push('Top failures (best-effort, ~24h)');
  const tf = rollup.topFailures || {};
  lines.push(`- Sessions: ${fmtTop(tf.sessions)}`);
  lines.push(`- Canaries: ${fmtTop(tf.canaries)}`);
  lines.push(`- Alerts:   ${fmtTop(tf.alerts)}`);

  lines.push('');
  lines.push('Data health');
  const inputs = rollup.dataHealth?.inputs || {};
  lines.push(`- sessions.latest.json: ${inputs.sessions?.ok ? 'OK' : 'MISSING'} age=${fmtAge(inputs.sessions?.ageMs)}${inputs.sessions?.collectError ? ` collectErr=${inputs.sessions.collectError}` : ''}`);
  lines.push(`- alerts-ledger.jsonl:  ${inputs.alerts?.ok ? 'OK' : 'MISSING'} age=${fmtAge(inputs.alerts?.ageMs)} parseErrors=${inputs.alerts?.parseErrors ?? 0}`);
  lines.push(`- canary-history.jsonl: ${inputs.canaries?.ok ? 'OK' : 'MISSING'} age=${fmtAge(inputs.canaries?.ageMs)} parseErrors=${inputs.canaries?.parseErrors ?? 0}`);

  return lines.join('\n') + '\n';
}

function fmtTop(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '—';
  return arr.map((x) => `${x.key}=${x.count}`).join(', ');
}
