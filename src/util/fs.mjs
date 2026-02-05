import fs from 'node:fs/promises';
import path from 'node:path';

export async function readJsonSafe(p) {
  try {
    const s = await fs.readFile(p, 'utf8');
    return { ok: true, value: JSON.parse(s) };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export async function writeJsonAtomic(p, obj) {
  const dir = path.dirname(p);
  await fs.mkdir(dir, { recursive: true });
  const tmp = p + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2) + '\n');
  await fs.rename(tmp, p);
}

export async function statSafe(p) {
  try {
    const st = await fs.stat(p);
    return { ok: true, ageMs: Date.now() - st.mtimeMs, mtimeMs: st.mtimeMs };
  } catch {
    return { ok: false, ageMs: null, mtimeMs: null };
  }
}

export async function copyFileSafe(src, dst) {
  try {
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.copyFile(src, dst);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
