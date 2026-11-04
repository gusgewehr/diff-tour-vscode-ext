import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DoneEvent } from './progress';
import type { Target } from '../git/changes';
import type { Settings } from '../settings';

export interface TourMeta { key: string; label: string; base: string; head: string; baseSha: string; headSha: string; files: number; lang: string; llm: string; createdAt: string }

export async function saveTour(dir: string, done: DoneEvent, label: string, s: Pick<Settings, 'llm' | 'language'>): Promise<string> {
  await fs.promises.mkdir(dir, { recursive: true });
  const dest = path.join(dir, `${done.key}.json`);
  if (!done.cached || !fs.existsSync(dest)) {
    await fs.promises.copyFile(done.path, dest + '.tmp');
    await fs.promises.rename(dest + '.tmp', dest);
  }
  const meta: TourMeta = {
    key: done.key, label, base: done.base, head: done.head, baseSha: done.baseSha, headSha: done.headSha,
    files: done.files, lang: s.language, llm: s.llm, createdAt: new Date().toISOString(),
  };
  const metaPath = path.join(dir, `${done.key}.meta.json`);
  await fs.promises.writeFile(metaPath + '.tmp', JSON.stringify(meta, null, 2));
  await fs.promises.rename(metaPath + '.tmp', metaPath);
  return dest;
}

/** Deletes a saved tour and its meta; missing files are fine. */
export async function removeTour(dir: string, key: string): Promise<void> {
  for (const f of [`${key}.json`, `${key}.meta.json`]) await fs.promises.rm(path.join(dir, f), { force: true });
}

export async function findExisting(dir: string, t: Pick<Target, 'label' | 'baseSha' | 'headSha'>): Promise<TourMeta | undefined> {
  let names: string[];
  try { names = await fs.promises.readdir(dir); } catch { return undefined; }
  let best: TourMeta | undefined;
  for (const n of names.filter((x) => x.endsWith('.meta.json'))) {
    try {
      const m = JSON.parse(await fs.promises.readFile(path.join(dir, n), 'utf8')) as TourMeta;
      const match = m.label === t.label || (m.baseSha === t.baseSha && m.headSha === t.headSha);
      if (!match || !fs.existsSync(path.join(dir, `${m.key}.json`))) continue;
      if (!best || m.createdAt > best.createdAt) best = m;
    } catch { /* skip broken meta */ }
  }
  return best;
}
