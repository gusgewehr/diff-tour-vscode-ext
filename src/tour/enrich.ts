import { git, listChangedFiles, type ChangedFile } from '../git/changes';
import { PLACEHOLDER, showBlob } from '../git/blob';
import { codeView, diffView, parseHunks, splitLines, type Row } from './align';
import { flowPaths, nodeTargets, type NodeTarget } from './flow';
import type { At, FileRole, FlatStep } from './model';
import { t } from '../l10n';

export interface CodeData { kind: 'code'; file: string; sections: Row[][]; lines?: [number, number]; added: number; removed: number; newFile: boolean; deleted: boolean; unchanged: boolean; approximate: boolean; missing?: string }
export interface TourCommit { sha: string; subject: string; ai: boolean }
export interface TargetData { kind: 'target'; commits: TourCommit[] }
export interface FileRow { file: string; added: number | null; removed: number | null; note?: string; at: At }
export interface FilesData { kind: 'files'; groups: { label: string; files: FileRow[] }[] }
export interface FlowData { kind: 'flow'; paths: number[][]; nodes: NodeTarget[] }
export interface ErrorData { kind: 'error'; message: string }
export type BlockData = CodeData | TargetData | FilesData | FlowData | ErrorData;
export type NumStat = Map<string, { added: number | null; removed: number | null }>;

export function parseNumstat(out: string): NumStat {
  const m: NumStat = new Map();
  const t = out.split('\0');
  for (let i = 0; i < t.length; i++) {
    const x = /^(-|\d+)\t(-|\d+)\t(.*)$/s.exec(t[i]);
    if (!x) continue;
    let p = x[3];
    if (p === '') { p = t[i + 2] ?? ''; i += 2; }
    m.set(p, { added: x[1] === '-' ? null : +x[1], removed: x[2] === '-' ? null : +x[2] });
  }
  return m;
}

export function isAiCoAuthor(body: string): boolean {
  return /^co-authored-by:.*\b(claude|copilot|codex|gemini|cursor|ai)\b/im.test(body);
}

export function parseCommits(out: string): TourCommit[] {
  const t = out.split('\0');
  const r: TourCommit[] = [];
  for (let i = 0; i + 2 < t.length; i += 3) {
    const sha = t[i].replace(/^\s+/, '');
    if (sha) r.push({ sha, subject: t[i + 1], ai: isAiCoAuthor(t[i + 2]) });
  }
  return r;
}

const GROUPS: [string, string][] = [['core', 'CORE'], ['mechanical', 'MECHANICAL'], ['test', 'TESTS'], ['config', 'CONFIG'], ['docs', 'DOCS']];

export function groupFiles(roles: FileRole[], stats: NumStat, deleted: Set<string>): FilesData['groups'] {
  return GROUPS.map(([role, label]) => ({
    label,
    files: roles.filter((r) => r.role === role).map((r): FileRow => {
      const s = stats.get(r.file);
      const row: FileRow = { file: r.file, added: s?.added ?? null, removed: s?.removed ?? null, at: deleted.has(r.file) ? 'base' : 'head' };
      if (r.note) row.note = r.note;
      return row;
    }),
  })).filter((g) => g.files.length);
}

export interface EnrichInput { cwd?: string; baseSha: string; headSha: string; base: string; head: string; steps: FlatStep[] }


export class StepEnricher {
  private cache = new Map<number, Promise<(BlockData | null)[]>>();
  private memo = new Map<string, Promise<unknown>>();
  private ok: boolean;
  constructor(private i: EnrichInput) {
    const bad = (s: string) => !s || s.startsWith('-');
    this.ok = !!i.cwd && !bad(i.baseSha) && !bad(i.headSha);
  }

  forStep(index: number): Promise<(BlockData | null)[]> {
    let p = this.cache.get(index);
    if (!p) { p = this.build(index); this.cache.set(index, p); }
    return p;
  }

  private once<T>(key: string, f: () => Promise<T>): Promise<T> {
    let p = this.memo.get(key);
    if (!p) { p = f(); this.memo.set(key, p); }
    return p as Promise<T>;
  }

  private get cwd(): string { return this.i.cwd as string; }
  private changes() { return this.once('changes', () => listChangedFiles(this.cwd, this.i.baseSha, this.i.headSha)); }
  private numstat() { return this.once('numstat', async () => parseNumstat(await git(this.cwd, ['diff', '--numstat', '-z', '-M', this.i.baseSha, this.i.headSha]))); }
  private commits() { return this.once('commits', async () => parseCommits(await git(this.cwd, ['log', '--max-count=100', '--format=%h%x00%s%x00%b%x00', `${this.i.baseSha}..${this.i.headSha}`]))); }
  private blob(sha: string, p: string) {
    return this.once(`${sha}:${p}`, () => showBlob(this.cwd, sha, p).then((t) => (t === PLACEHOLDER ? t : splitLines(t)), () => undefined));
  }

  private async build(index: number): Promise<(BlockData | null)[]> {
    const fs = this.i.steps[index];
    if (!fs) return [];
    const out: (BlockData | null)[] = [];
    for (const b of fs.step.blocks) {
      try { out.push(await this.one(b, fs)); } catch (e) { out.push({ kind: 'error', message: (e as Error).message ?? String(e) }); }
    }
    return out;
  }

  private async one(b: FlatStep['step']['blocks'][number], fs: FlatStep): Promise<BlockData | null> {
    const { baseSha, headSha } = this.i;
    switch (b.kind) {
      case 'code': case 'diff': {
        const file = b.kind === 'code' ? b.code.file : b.diff.file;
        const fail = (missing: string, approximate = false): CodeData => ({ kind: 'code', file, sections: [], added: 0, removed: 0, newFile: false, deleted: false, unchanged: false, approximate, missing });
        if (!this.ok) return fail(t('Code unavailable: this tour has no toured commits'));
        const changes: ChangedFile[] = await this.changes();
        const c = changes.find((x) => x.path === file || x.oldPath === file);
        const oldPath = c?.status === 'A' ? undefined : (c?.oldPath ?? file);
        const newPath = c?.status === 'D' ? undefined : (c?.path ?? file);
        const at: At = b.kind === 'code' ? b.code.at || 'head' : 'head';
        const get = async (sha: string, p?: string) => (p ? this.blob(sha, p) : undefined) as Promise<string[] | string | undefined>;
        const [ol, nl] = await Promise.all([get(baseSha, oldPath), get(headSha, newPath)]);
        if (ol === PLACEHOLDER || nl === PLACEHOLDER) return fail(PLACEHOLDER);
        const newFile = c?.status === 'A';
        const deleted = c?.status === 'D';
        const hunksOf = async (u: number) => {
          if (!c) return [];
          const paths = oldPath && newPath && oldPath !== newPath ? [oldPath, newPath] : [oldPath ?? newPath ?? file];
          return parseHunks(await git(this.cwd, ['diff', `-U${u}`, '--no-color', '--no-ext-diff', '-M', baseSha, headSha, '--', ...paths]));
        };
        if (b.kind === 'diff') {
          if (!c) return fail(t('no changes in {0}', file));
          const v = diffView(await hunksOf(3), b.diff.hunks);
          if (!v.sections.length) return fail(t('no changes in {0}', file));
          return { kind: 'code', file, sections: v.sections, added: v.added, removed: v.removed, newFile, deleted, unchanged: false, approximate: v.approximate };
        }
        const side = at === 'base' ? ol : nl;
        if (!Array.isArray(side)) return fail(t('{0} not found at {1}', file, at === 'base' ? this.i.base : this.i.head), true);
        const other = (at === 'base' ? nl : ol) as string[] | undefined;
        const arr = (x: string[] | undefined) => x ?? [];
        const v = codeView({
          oldLines: at === 'base' ? side : c ? arr(other) : side, newLines: at === 'base' ? (c ? arr(other) : side) : side,
          hunks: c ? await hunksOf(0) : [], at, lines: b.code.lines, show: b.code.show, marks: b.code.marks,
        });
        return { kind: 'code', file, sections: [v.rows], lines: v.lines, added: v.added, removed: v.removed, newFile, deleted, unchanged: !newFile && !deleted && v.added === 0 && v.removed === 0, approximate: v.approximate };
      }
      case 'target': return { kind: 'target', commits: this.ok ? await this.commits() : [] };
      case 'files': {
        const deleted = this.ok ? new Set((await this.changes()).filter((x) => x.status === 'D').map((x) => x.path)) : new Set<string>();
        return { kind: 'files', groups: groupFiles(b.files.roles ?? [], this.ok ? await this.numstat() : new Map(), deleted) };
      }
      case 'flow': return { kind: 'flow', paths: flowPaths(b.flow.nodes), nodes: nodeTargets(b.flow.nodes, this.i.steps.map((s) => s.step)) };
      default: void fs; return null;
    }
  }
}
