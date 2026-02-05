export function toIso(d) {
  return d.toISOString();
}

export function isoDay(d) {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
}

export function durationMsFrom(spec) {
  const m = String(spec).trim().match(/^([0-9]+)\s*([smhd])$/i);
  if (!m) throw new Error(`Invalid duration: ${spec} (expected e.g. 1h, 6h, 24h)`);
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const mult = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return n * mult;
}
