import type { ChangedFile } from '../git/changes';
import { t } from '../l10n';

/** Paths for the diff sides; undefined = empty side. */
export function sides(f: ChangedFile): { left?: string; right?: string } {
  if (f.status === 'A') return { right: f.path };
  if (f.status === 'D') return { left: f.path };
  if (f.status === 'R' || f.status === 'C') return { left: f.oldPath, right: f.path };
  return { left: f.path, right: f.path };
}

const files = (n: number) => (n === 1 ? t('{0} file', n) : t('{0} files', n));

export const noticeText = (n: number, min: number) =>
  t('{0} changed. Changes under {1} files open in the standard diff, without a tour.', files(n), min);

export const statusText = (n: number, min: number) => t('$(git-compare) No tour · {0} (under {1})', files(n), min);
