import { durationMsFrom } from '../util/time.mjs';

export function computeWindows({ now, windowSpecs }) {
  const out = {};
  for (const w of windowSpecs) {
    const ms = durationMsFrom(w);
    const from = new Date(now.getTime() - ms);
    out[w] = { from: from.toISOString(), to: now.toISOString(), ms };
  }
  return out;
}

export function inWindow(tsIso, win) {
  const t = new Date(tsIso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= new Date(win.from).getTime() && t <= new Date(win.to).getTime();
}
