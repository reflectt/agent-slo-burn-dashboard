import fs from 'node:fs/promises';
import { toIso } from '../util/time.mjs';

function mapStatus(s) {
  const v = String(s || '').toLowerCase();
  if (['pass', 'passed', 'ok', 'success', 'green'].includes(v)) return 'pass';
  if (['fail', 'failed', 'error', 'red'].includes(v)) return 'fail';
  return 'unknown';
}

export async function parseCanaryHistory(filePath) {
  const events = [];
  const warnings = [];
  let parseErrors = 0;

  let text;
  try {
    text = await fs.readFile(filePath, 'utf8');
  } catch (e) {
    return { ok: false, events, warnings: [`missing canary history: ${filePath}`], parseErrors: 0 };
  }

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      parseErrors++;
      continue;
    }

    const ts = rec.ts || rec.timestamp || rec.time || rec.startedAt || rec.createdAt;
    const d = ts ? new Date(ts) : null;
    if (!d || Number.isNaN(d.getTime())) {
      parseErrors++;
      continue;
    }

    const canary = rec.canaryId || rec.name || rec.canary || rec.id || '(unknown)';
    const status = mapStatus(rec.status || rec.result || rec.outcome);
    const durationMs = Number.isFinite(rec.durationMs) ? rec.durationMs : (Number.isFinite(rec.duration) ? rec.duration : null);

    events.push({
      ts: toIso(d),
      canary,
      status,
      durationMs,
      raw: rec
    });
  }

  if (parseErrors > 0) warnings.push(`canaries: skipped ${parseErrors} invalid line(s)`);

  return { ok: true, events, warnings, parseErrors };
}
