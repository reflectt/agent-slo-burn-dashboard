import fs from 'node:fs/promises';
import path from 'node:path';

function expandHome(p) {
  if (!p) return p;
  if (p.startsWith('~/')) return path.join(process.env.HOME || '', p.slice(2));
  return p;
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function loadConfig({ cwd }) {
  const cfgPath = path.join(cwd, 'config', 'default.json');
  const raw = JSON.parse(await fs.readFile(cfgPath, 'utf8'));

  const cfg = structuredClone(raw);
  cfg.paths = cfg.paths || {};

  // Resolve workdir relative to repo root.
  cfg.paths.workdirResolved = path.resolve(cwd, cfg.paths.workdir || '.');

  // Env overrides.
  const envAlerts = process.env.AGENT_SLO_ALERTS_PATH;
  const envCanary = process.env.AGENT_SLO_CANARY_PATH;
  const envSessMins = process.env.AGENT_SLO_SESSIONS_ACTIVE_MINUTES;
  if (envAlerts) cfg.paths.alertsLedger = envAlerts;
  if (envCanary) cfg.paths.canaryHistory = envCanary;
  if (envSessMins) cfg.collection.sessionsActiveMinutes = Number(envSessMins);

  // Resolve + select fallbacks when needed.
  const alertsPrimary = path.resolve(cwd, expandHome(cfg.paths.alertsLedger));
  const alertsFallback = path.resolve(cwd, expandHome(cfg.paths.alertsLedgerFallback));
  cfg.paths.alertsLedgerResolved = (await fileExists(alertsPrimary))
    ? alertsPrimary
    : (await fileExists(alertsFallback) ? alertsFallback : alertsPrimary);

  const canaryPrimary = path.resolve(cwd, expandHome(cfg.paths.canaryHistory));
  const canaryFallback = path.resolve(cwd, expandHome(cfg.paths.canaryHistoryFallback));
  cfg.paths.canaryHistoryResolved = (await fileExists(canaryPrimary))
    ? canaryPrimary
    : (await fileExists(canaryFallback) ? canaryFallback : canaryPrimary);

  return cfg;
}
