import type { ChangedFile } from '../git/changes';
import type { At } from './model';
import { t } from '../l10n';

export interface OpenInput { file: string; at: At; lines: [number, number]; baseSha: string; headSha: string; changes: ChangedFile[] }
export interface OpenPlan {
  left?: string; right?: string; title: string; startLine: number; endLine: number; revealSide: 'left' | 'right'; missing?: string;
  unchanged?: boolean;
}

export function planOpen(i: OpenInput): OpenPlan {
  const b = i.baseSha.slice(0, 7);
  const h = i.headSha.slice(0, 7);
  const f = i.file;
  const c = i.changes.find((x) => x.path === f || x.oldPath === f);
  const tail = t(' · read-only tour copy');
  const out: OpenPlan = {
    title: '', startLine: Math.max(0, i.lines[0] - 1), endLine: Math.max(0, i.lines[1] - 1),
    revealSide: i.at === 'base' ? 'left' : 'right',
  };
  const miss = (ref: string) => ({ ...out, missing: t('{0} is not in {1} at this commit', f, ref) });
  if (!c) return { ...out, left: f, right: f, unchanged: true, title: t('{0} · same in {1} and {2}{3}', f, b, h, tail) };
  if (c.status === 'A') {
    if (i.at === 'base') return miss(b);
    return { ...out, right: c.path, title: t('{0} · BEFORE {1} (did not exist) ↔ AFTER {2}{3}', f, b, h, tail) };
  }
  if (c.status === 'D') {
    if (i.at === 'head') return miss(h);
    return { ...out, left: c.path, title: t('{0} · BEFORE {1} ↔ AFTER {2} (deleted){3}', f, b, h, tail) };
  }
  return { ...out, left: c.oldPath ?? c.path, right: c.path, title: t('{0} · BEFORE {1} ↔ AFTER {2}{3}', c.path, b, h, tail) };
}
