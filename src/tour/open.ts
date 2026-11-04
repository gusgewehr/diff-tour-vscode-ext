import * as fs from 'node:fs';
import * as path from 'node:path';
import type { TourMeta } from '../cli/cache';
import { git } from '../git/changes';
import { fileTourId, loadTour, metaPathFor, type Tour } from './model';

export interface OpenedTour { tour: Tour; meta: TourMeta; id: string; path: string }

const s = (v: unknown): string => (typeof v === 'string' ? v : '');
const okRef = (r: string) => r !== '' && !r.startsWith('-');

async function readMeta(p: string): Promise<TourMeta | undefined> {
  try {
    const m = JSON.parse(await fs.promises.readFile(metaPathFor(p), 'utf8')) as Record<string, unknown>;
    if (typeof m.key !== 'string' || !m.key) return undefined;
    return { key: m.key, label: s(m.label), base: s(m.base), head: s(m.head), baseSha: s(m.baseSha), headSha: s(m.headSha),
      files: typeof m.files === 'number' ? m.files : 0, lang: s(m.lang), llm: s(m.llm), createdAt: s(m.createdAt) };
  } catch { return undefined; }
}

async function sha(cwd: string, args: string[]): Promise<string> {
  try { return (await git(cwd, args)).trim(); } catch { return ''; }
}

export async function resolveTour(tourPath: string, cwd?: string): Promise<OpenedTour> {
  const abs = path.resolve(tourPath);
  const tour = loadTour(await fs.promises.readFile(abs, 'utf8'));
  let meta = await readMeta(abs);
  if (!meta) {
    const id = fileTourId(abs);
    let baseSha = ''; let headSha = '';
    if (cwd && okRef(tour.head)) {
      headSha = await sha(cwd, ['rev-parse', '--verify', `${tour.head}^{commit}`]);
      if (okRef(tour.base)) {
        baseSha = headSha ? await sha(cwd, ['merge-base', tour.base, tour.head]) : '';
        if (!baseSha) baseSha = await sha(cwd, ['rev-parse', '--verify', `${tour.base}^{commit}`]);
      }
    }
    meta = { key: id, label: tour.title, base: tour.base, head: tour.head, baseSha, headSha, files: 0, lang: '', llm: '', createdAt: '' };
  }
  return { tour, meta, id: meta.key, path: abs };
}
