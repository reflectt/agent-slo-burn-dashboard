import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import { parseSessions } from '../src/adapters/openclawSessions.mjs';
import { parseAlertsLedger } from '../src/adapters/alertsLedger.mjs';
import { parseCanaryHistory } from '../src/adapters/canaryHistory.mjs';
import { computeRollup } from '../src/core/rollup.mjs';

const FIX = path.join(new URL('.', import.meta.url).pathname, '..', 'fixtures');

async function main() {
  const cfg = {
    windows: { short: '1h', long: '6h', report: ['1h', '6h', '24h'] },
    slos: {
      session_success: { target: 0.99 },
      stuck_alert_rate: { targetMax: 0.005 },
      canary_pass: { target: 0.98 }
    },
    burn: { warn: 1, alertShort: 2, alertLong: 1 }
  };

  const now = new Date('2026-02-05T21:00:00.000Z');

  const sessionsRaw = JSON.parse(await fs.readFile(path.join(FIX, 'sessions.json'), 'utf8'));
  const sessions = parseSessions(sessionsRaw).events;

  const alerts = (await parseAlertsLedger(path.join(FIX, 'alerts.jsonl'))).events;
  const canaries = (await parseCanaryHistory(path.join(FIX, 'canary-history.jsonl'))).events;

  const rollup = computeRollup({ now, cfg, sessions, alerts, canaries, dataHealth: {} });

  // Window sanity.
  assert.equal(rollup.windows['1h'].to, now.toISOString());

  // SLO1: sessions in last 1h: 10 total, 9 success, 1 fail => 90%
  assert.equal(rollup.slos.session_success.counts['1h'].n, 10);
  assert.equal(rollup.slos.session_success.counts['1h'].ok, 9);
  assert.equal(rollup.slos.session_success.observed['1h'].toFixed(2), '0.90');
  assert.equal(rollup.slos.session_success.status, 'ALERT');

  // SLO2: stuck alerts in last 6h: 1 stuck / 100 sessions => 1% (burn=2) => ALERT
  assert.equal(rollup.slos.stuck_alert_rate.counts['6h'].stuck, 1);
  assert.equal(rollup.slos.stuck_alert_rate.counts['6h'].nSessions, 100);
  assert.equal(rollup.slos.stuck_alert_rate.status, 'ALERT');

  // SLO3: canaries in last 6h (15:00-21:00): 19 total, 18 pass => ~94.7%
  assert.equal(rollup.slos.canary_pass.counts['6h'].n, 19);
  assert.equal(rollup.slos.canary_pass.counts['6h'].fail, 1);
  assert.equal(rollup.slos.canary_pass.observed['6h'].toFixed(2), '0.95');
  assert.equal(rollup.slos.canary_pass.status, 'ALERT');

  // Overall worst should be ALERT due to sessions.
  assert.equal(rollup.overall.status, 'ALERT');

  console.log('selftest: OK');
}

main().catch((e) => {
  console.error(e.stack || String(e));
  process.exitCode = 1;
});
