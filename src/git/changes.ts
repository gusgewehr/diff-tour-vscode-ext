import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type TargetKind = 'branch' | 'pr' | 'commit' | 'range';
export interface Target { label: string; base: string; head: string; baseSha: string; headSha: string; files: number; kind: TargetKind }
export interface Candidate { kind: 'branch' | 'pr'; label: string; base: string; head: string; detail?: string; pr?: number }
export interface Commit { sha: string; subject: string; when: string }
export interface SavedTour { path: string; metaPath: string; label: string; files?: number }

export function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', ['-c', 'core.quotepath=false', ...args], { cwd, maxBuffer: 16 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      if (err) reject(new Error(String(stderr).trim() || err.message));
      else resolve(String(stdout));
    });
  });
}

export async function repoRoot(cwd: string): Promise<string> {
  return (await git(cwd, ['rev-parse', '--show-toplevel'])).trim();
}

export async function refExists(cwd: string, ref: string): Promise<boolean> {
  if (!ref || ref.startsWith('-')) return false;
  try { await git(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]); return true; } catch { return false; }
}

export async function detectBase(cwd: string, setting: string): Promise<string> {
  if (setting) {
    if (!(await refExists(cwd, setting))) throw new Error(`Base branch "${setting}" not found`);
    return setting;
  }
  try {
    const name = (await git(cwd, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])).trim().replace(/^origin\//, '');
    if (await refExists(cwd, name)) return name;
    if (await refExists(cwd, `origin/${name}`)) return `origin/${name}`;
  } catch { /* no origin/HEAD */ }
  for (const b of ['main', 'master']) if (await refExists(cwd, b)) return b;
  throw new Error('No base branch found. Set difftour.baseBranch.');
}

export async function currentBranch(cwd: string): Promise<string | undefined> {
  try { return (await git(cwd, ['symbolic-ref', '--short', '-q', 'HEAD'])).trim() || undefined; } catch { return undefined; }
}

export async function uncommittedCount(cwd: string): Promise<number> {
  return (await git(cwd, ['status', '--porcelain'])).split(/\r?\n/).filter((l) => l.trim()).length;
}

export async function localBranches(cwd: string, exclude: string[], limit = 15): Promise<string[]> {
  const out = await git(cwd, ['for-each-ref', '--sort=-committerdate', '--format=%(refname:short)', 'refs/heads/']);
  return out.split(/\r?\n/).filter((b) => b && !exclude.includes(b)).slice(0, limit);
}

export async function compareCandidates(cwd: string, base: string): Promise<{ candidates: Candidate[]; onBase: boolean }> {
  const branch = await currentBranch(cwd);
  const stripped = base.replace(/^origin\//, '');
  const onBase = branch !== undefined && (branch === base || branch === stripped);
  const candidates: Candidate[] = [];
  if (!onBase) {
    const n = await uncommittedCount(cwd);
    candidates.push({
      kind: 'branch', label: branch ?? 'HEAD (detached)', base, head: branch ?? 'HEAD',
      detail: n > 0 ? `+${n} uncommitted (not toured)` : 'current branch',
    });
  }
  const ex = [base, stripped, ...(branch ? [branch] : [])];
  for (const b of await localBranches(cwd, ex)) candidates.push({ kind: 'branch', label: b, base, head: b });
  return { candidates, onBase };
}

interface GhPr { number?: unknown; title?: unknown; headRefName?: unknown; baseRefName?: unknown }

export function listPrs(cwd: string): Promise<Candidate[]> {
  return new Promise((resolve) => {
    execFile('gh', ['pr', 'list', '--search', 'review-requested:@me', '--json', 'number,title,headRefName,baseRefName', '--limit', '20'],
      { cwd, timeout: 15000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (err, stdout) => {
        if (err) return resolve([]);
        try {
          const list = JSON.parse(String(stdout)) as GhPr[];
          resolve(list.filter((p) => Number.isInteger(p.number) && (p.number as number) > 0).map((p) => ({
            kind: 'pr' as const, label: `#${p.number} ${String(p.title)}`, base: String(p.baseRefName), head: String(p.headRefName),
            pr: p.number as number, detail: String(p.headRefName),
          })));
        } catch { resolve([]); }
      });
  });
}

export async function fetchPr(cwd: string, c: Candidate): Promise<Candidate> {
  if (!Number.isInteger(c.pr) || (c.pr as number) <= 0) throw new Error('Invalid PR number');
  try {
    await git(cwd, ['fetch', 'origin', `pull/${c.pr}/head`]);
  } catch (e) {
    throw new Error(`Could not fetch PR #${c.pr}: ${(e as Error).message}`);
  }
  const head = (await git(cwd, ['rev-parse', '--verify', 'FETCH_HEAD'])).trim();
  const base = (await refExists(cwd, `origin/${c.base}`)) ? `origin/${c.base}` : c.base;
  return { ...c, head, base };
}

export async function countFiles(cwd: string, baseSha: string, headSha: string): Promise<number> {
  return (await git(cwd, ['diff', '--name-only', '-z', baseSha, headSha])).split('\0').filter(Boolean).length;
}

export async function resolveTarget(cwd: string, kind: TargetKind, label: string, base: string, head: string): Promise<Target> {
  if (base.startsWith('-') || head.startsWith('-')) throw new Error(`${label}: invalid ref`);
  const headSha = (await git(cwd, ['rev-parse', '--verify', `${head}^{commit}`])).trim();
  let baseSha: string;
  try { baseSha = (await git(cwd, ['merge-base', base, head])).trim(); } catch { throw new Error(`${label}: no common history with ${base}`); }
  return { label, base, head, baseSha, headSha, files: await countFiles(cwd, baseSha, headSha), kind };
}

export function parseLog(out: string): Commit[] {
  return out.split(/\r?\n/).filter(Boolean).map((l) => {
    const [sha, subject, when] = l.split('\0');
    return { sha, subject: subject ?? '', when: when ?? '' };
  });
}

export async function recentCommits(cwd: string, n = 50): Promise<Commit[]> {
  return parseLog(await git(cwd, ['log', `-${n}`, '--format=%H%x00%s%x00%cr']));
}

export function parseRange(input: string): { base: string; head: string } | undefined {
  const m = /^([^.\s][^\s]*?)\.{2,3}([^\s]+)$/.exec(input.trim());
  if (!m || m[1].startsWith('-') || m[2].startsWith('-')) return undefined;
  return { base: m[1], head: m[2] };
}

export function describeCount(files: number, minFiles: number): string {
  if (files === 0) return 'no changes';
  return `${files} ${files === 1 ? 'file' : 'files'} · ${files < minFiles ? 'opens git diff' : 'tour'}`;
}

export async function listSavedTours(dir: string): Promise<SavedTour[]> {
  let names: string[];
  try { names = await fs.promises.readdir(dir); } catch { return []; }
  const out: SavedTour[] = [];
  for (const n of names.filter((x) => x.endsWith('.meta.json'))) {
    const metaPath = path.join(dir, n);
    try {
      const m = JSON.parse(await fs.promises.readFile(metaPath, 'utf8')) as { label?: unknown; files?: unknown };
      const key = n.slice(0, -'.meta.json'.length);
      out.push({
        path: path.join(dir, `${key}.json`), metaPath,
        label: typeof m.label === 'string' ? m.label : key,
        files: typeof m.files === 'number' ? m.files : undefined,
      });
    } catch { /* skip broken meta */ }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const res: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; res[i] = await fn(items[i], i); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return res;
}
