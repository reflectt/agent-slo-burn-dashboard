import path from 'node:path';

import { readJsonSafe } from '../util/fs.mjs';
import { renderCli } from '../render/cli.mjs';

export async function show({ cfg, flags }) {
  const workdir = cfg.paths.workdirResolved;
  const rollupPath = path.join(workdir, cfg.paths.rollupsDir, 'latest.json');
  const r = await readJsonSafe(rollupPath);
  if (!r.ok) {
    throw new Error(`No rollup found at ${rollupPath}. Run: agent-slo refresh`);
  }

  const window = flags.window || cfg.windows?.long || '6h';
  if (!['1h', '6h', '24h'].includes(window)) throw new Error(`Unsupported --window: ${window}`);

  if (flags.json) {
    process.stdout.write(JSON.stringify({ window, rollup: r.value }, null, 2) + '\n');
    return;
  }

  process.stdout.write(renderCli({ rollup: r.value, window, cfg }));
}
