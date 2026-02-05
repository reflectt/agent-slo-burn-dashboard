import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { parseSessions } from '../adapters/openclawSessions.mjs';
import { parseAlertsLedger } from '../adapters/alertsLedger.mjs';
import { parseCanaryHistory } from '../adapters/canaryHistory.mjs';
import { computeRollup } from '../core/rollup.mjs';
import { renderHtml } from '../render/html.mjs';
import { isoDay } from '../util/time.mjs';
import { statSafe, readJsonSafe, writeJsonAtomic, copyFileSafe } from '../util/fs.mjs';

export async function refresh({ cfg, flags }) {
  const now = flags.now ? new Date(flags.now) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`Invalid --now: ${flags.now}`);

  const workdir = cfg.paths.workdirResolved;
  const rawDir = path.join(workdir, cfg.paths.rawDir);
  const rollupsDir = path.join(workdir, cfg.paths.rollupsDir);
  const reportsDir = path.join(workdir, cfg.paths.reportsDir);

  const sessionsSnapshotPath = path.join(rawDir, 'sessions.latest.json');
  const alertsCopyPath = path.join(rawDir, 'alerts-ledger.latest.jsonl');
  const canaryCopyPath = path.join(rawDir, 'canary-history.latest.jsonl');

  // 1) Collect sessions via openclaw.
  const activeMins = cfg.collection?.sessionsActiveMinutes ?? 1440;
  const cmd = ['openclaw', 'sessions', '--json', '--active', String(activeMins)];
  const res = spawnSync(cmd[0], cmd.slice(1), { encoding: 'utf8' });
  let sessionsRaw = null;
  let sessionsCollectError = null;
  if (res.status === 0 && res.stdout) {
    sessionsRaw = res.stdout;
    await fs.writeFile(sessionsSnapshotPath, sessionsRaw);
  } else {
    sessionsCollectError = (res.stderr || '').trim() || `openclaw sessions exited ${res.status}`;
  }

  // 2) Copy other inputs into var/raw (best-effort).
  const alertsSrc = cfg.paths.alertsLedgerResolved;
  const canarySrc = cfg.paths.canaryHistoryResolved;

  await copyFileSafe(alertsSrc, alertsCopyPath);
  await copyFileSafe(canarySrc, canaryCopyPath);

  // 3) Parse normalized events.
  const sessionsJson = await readJsonSafe(sessionsSnapshotPath);
  const sessions = sessionsJson.ok ? parseSessions(sessionsJson.value) : { events: [], warnings: [sessionsJson.error] };

  const alerts = await parseAlertsLedger(alertsCopyPath);
  const canaries = await parseCanaryHistory(canaryCopyPath);

  // 4) Rollup.
  const rollup = computeRollup({
    now,
    cfg,
    sessions: sessions.events,
    alerts: alerts.events,
    canaries: canaries.events,
    dataHealth: {
      inputs: {
        sessions: {
          path: sessionsSnapshotPath,
          ok: sessionsJson.ok,
          ageMs: (await statSafe(sessionsSnapshotPath)).ageMs,
          warnings: sessions.warnings,
          collectError: sessionsCollectError
        },
        alerts: {
          path: alertsSrc,
          copiedTo: alertsCopyPath,
          ok: alerts.ok,
          ageMs: (await statSafe(alertsCopyPath)).ageMs,
          parseErrors: alerts.parseErrors,
          warnings: alerts.warnings
        },
        canaries: {
          path: canarySrc,
          copiedTo: canaryCopyPath,
          ok: canaries.ok,
          ageMs: (await statSafe(canaryCopyPath)).ageMs,
          parseErrors: canaries.parseErrors,
          warnings: canaries.warnings
        }
      }
    }
  });

  const day = isoDay(now);
  const rollupPath = path.join(rollupsDir, `${day}.json`);
  await writeJsonAtomic(rollupPath, rollup);
  await writeJsonAtomic(path.join(rollupsDir, 'latest.json'), rollup);

  if (flags.html) {
    const html = renderHtml({ rollup });
    await fs.writeFile(path.join(reportsDir, 'latest.html'), html);
  }

  process.stdout.write(`Wrote ${path.relative(workdir, rollupPath)}\n`);
}
