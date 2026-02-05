import fs from 'node:fs/promises';
import { toIso } from '../util/time.mjs';

function mapType(t, msg = '') {
  const v = String(t || '').toLowerCase();
  const m = String(msg || '').toLowerCase();
  if (v.includes('stuck') || v.includes('hung') || v.includes('no_progress')) return 'stuck';
  if (m.includes('stuck') || m.includes('hung') || m.includes('no progress')) return 'stuck';
  if (v.includes('degrad')) return 'degraded';
  if (v.includes('error') || v.includes('incident')) return 'error';
  return v ? v : 'unknown';
}

function mapSeverity(s) {
  const v = String(s || '').toLowerCase();
  if (['critical', 'fatal', 'sev1'].includes(v)) return 'critical';
  if (['error', 'err', 'sev2'].includes(v)) return 'error';
  if (['warn', 'warning', 'sev3'].includes(v)) return 'warn';
  if (['info', 'debug', 'trace'].includes(v)) return 'info';
  return v ? v : 'info';
}

export async function parseAlertsLedger(filePath) {
  const events = [];
  const warnings = [];
  let parseErrors = 0;

  let text;
  try {
    text = await fs.readFile(filePath, 'utf8');
  } catch (e) {
    return { ok: false, events, warnings: [`missing alerts ledger: ${filePath}`], parseErrors: 0 };
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

    const ts = rec.ts || rec.timestamp || rec.time || rec.createdAt;
    const d = ts ? new Date(ts) : null;
    if (!d || Number.isNaN(d.getTime())) {
      parseErrors++;
      continue;
    }

    const message = rec.message || rec.msg || rec.summary || '';
    events.push({
      ts: toIso(d),
      type: mapType(rec.type || rec.category || rec.kind, message),
      severity: mapSeverity(rec.severity || rec.level),
      sessionId: rec.sessionId || rec.sid || rec.session || null,
      raw: rec
    });
  }

  if (parseErrors > 0) warnings.push(`alerts: skipped ${parseErrors} invalid line(s)`);

  return { ok: true, events, warnings, parseErrors };
}
