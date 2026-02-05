import { toIso } from '../util/time.mjs';

function mapStatus(s) {
  const v = String(s || '').toLowerCase();
  if (['success', 'succeeded', 'completed', 'complete', 'ok'].includes(v)) return 'success';
  if (['fail', 'failed', 'error', 'cancelled', 'canceled', 'timeout'].includes(v)) return 'fail';
  return 'unknown';
}

function errorClassFrom(rec) {
  const msg = (rec?.error?.message || rec?.error || rec?.summary || rec?.reason || '').toString().toLowerCase();
  if (!msg) return 'unknown';
  if (msg.includes('timeout')) return 'timeout';
  if (msg.includes('cancel')) return 'cancelled';
  if (msg.includes('rate limit')) return 'rate_limit';
  if (msg.includes('tool')) return 'tooling';
  if (msg.includes('exception') || msg.includes('stack') || msg.includes('trace')) return 'exception';
  return 'unknown';
}

export function parseSessions(json) {
  const warnings = [];
  const events = [];

  const arr = Array.isArray(json) ? json : (Array.isArray(json?.sessions) ? json.sessions : null);
  if (!arr) {
    warnings.push('sessions JSON: expected array or {sessions: []}');
    return { events, warnings };
  }

  for (const rec of arr) {
    const sessionId = rec.id || rec.sessionId || rec.sid || null;
    const startedAt = rec.startedAt || rec.tsStart || rec.start || rec.createdAt || rec.startTime;
    const endedAt = rec.endedAt || rec.tsEnd || rec.end || rec.completedAt || rec.endTime;

    const tsStart = startedAt ? new Date(startedAt) : null;
    const tsEnd = endedAt ? new Date(endedAt) : null;

    if (!tsStart || Number.isNaN(tsStart.getTime())) {
      warnings.push(`session missing/invalid startedAt: ${sessionId || '(no id)'}`);
      continue;
    }

    const durationMs = (tsEnd && !Number.isNaN(tsEnd.getTime())) ? Math.max(0, tsEnd.getTime() - tsStart.getTime()) : null;
    const status = mapStatus(rec.status);

    events.push({
      tsStart: toIso(tsStart),
      tsEnd: tsEnd && !Number.isNaN(tsEnd.getTime()) ? toIso(tsEnd) : null,
      sessionId: sessionId || '(unknown)',
      status,
      durationMs,
      errorClass: errorClassFrom(rec),
      raw: rec
    });
  }

  return { events, warnings };
}
