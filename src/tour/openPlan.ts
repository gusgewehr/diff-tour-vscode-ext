import type { ChangedFile } from '../git/changes';
import type { At } from './model';

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
  const tail = ' · read-only tour copy';
  const out: OpenPlan = {
    title: '', startLine: Math.max(0, i.lines[0] - 1), endLine: Math.max(0, i.lines[1] - 1),
    revealSide: i.at === 'base' ? 'left' : 'right',
  };
  const miss = (ref: string) => ({ ...out, missing: `${f} is not in ${ref} at this commit` });
  if (!c) return { ...out, left: f, right: f, unchanged: true, title: `${f} · same in ${b} and ${h}${tail}` };
  if (c.status === 'A') {
    if (i.at === 'base') return miss(b);
    return { ...out, right: c.path, title: `${f} · BEFORE ${b} (did not exist) ↔ AFTER ${h}${tail}` };
  }
  if (c.status === 'D') {
    if (i.at === 'head') return miss(h);
    return { ...out, left: c.path, title: `${f} · BEFORE ${b} ↔ AFTER ${h} (deleted)${tail}` };
  }
  return { ...out, left: c.oldPath ?? c.path, right: c.path, title: `${c.path} · BEFORE ${b} ↔ AFTER ${h}${tail}` };
}
