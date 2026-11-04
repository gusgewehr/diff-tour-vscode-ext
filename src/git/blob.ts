import { execFile } from 'node:child_process';

export const SCHEME = 'difftour-git';
export const PLACEHOLDER = '(binary or large file not shown)';
const MAX = 2 * 1024 * 1024;

export function buildQuery(q: { sha: string; cwd: string }): string {
  return new URLSearchParams({ sha: q.sha, cwd: q.cwd }).toString();
}

export type ParsedQuery = { empty: true } | { empty: false; sha: string; cwd: string };

export function parseQuery(query: string): ParsedQuery | undefined {
  const p = new URLSearchParams(query);
  if (p.get('empty') === '1') return { empty: true };
  const sha = p.get('sha') ?? '';
  const cwd = p.get('cwd') ?? '';
  if (!sha || sha.startsWith('-') || !cwd) return undefined;
  return { empty: false, sha, cwd };
}

export function guardBlob(b: Buffer): string {
  return b.length > MAX || b.includes(0) ? PLACEHOLDER : b.toString('utf8');
}

export function showBlob(cwd: string, sha: string, relPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!sha || sha.startsWith('-')) return reject(new Error('invalid ref'));
    execFile('git', ['show', `${sha}:${relPath}`], { cwd, encoding: 'buffer', maxBuffer: 3 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      if (!err) return resolve(guardBlob(stdout));
      if ((err as NodeJS.ErrnoException).code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') return resolve(PLACEHOLDER);
      reject(new Error(String(stderr).trim() || err.message));
    });
  });
}

export function blobExists(cwd: string, sha: string, relPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!sha || sha.startsWith('-')) return resolve(false);
    execFile('git', ['cat-file', '-e', `${sha}:${relPath}`], { cwd, windowsHide: true }, (err) => resolve(!err));
  });
}
