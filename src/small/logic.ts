import type { ChangedFile } from '../git/changes';

/** Paths for the diff sides; undefined = empty side. */
export function sides(f: ChangedFile): { left?: string; right?: string } {
  if (f.status === 'A') return { right: f.path };
  if (f.status === 'D') return { left: f.path };
  if (f.status === 'R' || f.status === 'C') return { left: f.oldPath, right: f.path };
  return { left: f.path, right: f.path };
}

const files = (n: number) => `${n} ${n === 1 ? 'file' : 'files'}`;

export const noticeText = (n: number, min: number) =>
  `${files(n)} changed. Changes under ${min} files open in the standard diff, without a tour.`;

export const statusText = (n: number, min: number) => `$(git-compare) No tour · ${files(n)} (under ${min})`;
