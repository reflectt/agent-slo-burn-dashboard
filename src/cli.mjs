import fs from 'node:fs/promises';
import path from 'node:path';

import { loadConfig } from './config.mjs';
import { refresh } from './commands/refresh.mjs';
import { show } from './commands/show.mjs';

function usage() {
  return `agent-slo (thin-slice v1)

Usage:
  agent-slo refresh [--now <iso>] [--html]
  agent-slo show [--window 1h|6h|24h] [--json]

Env overrides:
  AGENT_SLO_ALERTS_PATH
  AGENT_SLO_CANARY_PATH
  AGENT_SLO_SESSIONS_ACTIVE_MINUTES
`;
}

export async function main(argv) {
  const cmd = argv[0];
  if (!cmd || cmd === '-h' || cmd === '--help') {
    process.stdout.write(usage());
    return;
  }

  const args = argv.slice(1);
  const flags = parseArgs(args);
  const cfg = await loadConfig({ cwd: process.cwd() });

  await ensureDirs(cfg);

  if (cmd === 'refresh') {
    await refresh({ cfg, flags });
    return;
  }
  if (cmd === 'show') {
    await show({ cfg, flags });
    return;
  }

  throw new Error(`Unknown command: ${cmd}\n\n${usage()}`);
}

function parseArgs(args) {
  const out = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--window') out.window = args[++i];
    else if (a === '--json') out.json = true;
    else if (a === '--html') out.html = true;
    else if (a === '--now') out.now = args[++i];
    else out._.push(a);
  }
  return out;
}

async function ensureDirs(cfg) {
  const workdir = cfg.paths.workdirResolved;
  await fs.mkdir(path.join(workdir, cfg.paths.rawDir), { recursive: true });
  await fs.mkdir(path.join(workdir, cfg.paths.rollupsDir), { recursive: true });
  await fs.mkdir(path.join(workdir, cfg.paths.reportsDir), { recursive: true });
}
