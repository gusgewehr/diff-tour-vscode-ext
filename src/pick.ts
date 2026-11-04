import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Settings } from './settings';
import {
  Candidate, Target, SavedTour, repoRoot, detectBase, compareCandidates, listPrs, fetchPr, resolveTarget,
  recentCommits, parseRange, refExists, describeCount, listSavedTours, mapLimit,
} from './git/changes';
import { detectTools } from './cli/detect';

export type Entry =
  | { kind: 'change'; candidate: Candidate; target?: Target; error?: string }
  | { kind: 'saved'; path: string; label: string; files?: number }
  | { kind: 'commit' } | { kind: 'range' } | { kind: 'file' }
  | { kind: 'info'; label: string };
export interface Group { id: 'compare' | 'prs' | 'saved' | 'other'; label: string; entries: Entry[] }
export interface Deps { settings(): Settings; savedDir: string; extensionPath: string }

export class ChangeModel {
  groups: Group[] = [];
  message?: string;
  counting = false;
  cwd?: string;
  base?: string;
  private gen = 0;
  private loaded?: Promise<void>;
  private emitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.emitter.event;
  constructor(private deps: Deps) {}

  ensureLoaded(): Promise<void> { return this.loaded ?? this.refresh(); }

  refresh(): Promise<void> {
    this.loaded = this.load();
    return this.loaded;
  }

  private async load(): Promise<void> {
    const gen = ++this.gen;
    const s = this.deps.settings();
    this.message = undefined;
    // shortcut: multi-root uses the first folder, upgrade when multi-root repos matter
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    try {
      if (!folder) throw new Error('no folder');
      this.cwd = await repoRoot(folder);
    } catch {
      this.cwd = undefined; this.groups = []; this.message = 'Open a folder that contains a git repository.';
      this.counting = false; this.emitter.fire(); return;
    }
    const cwd = this.cwd;
    let base: string;
    try { base = await detectBase(cwd, s.baseBranch); } catch (e) {
      this.groups = []; this.message = (e as Error).message; this.counting = false; this.emitter.fire(); return;
    }
    this.base = base;
    const [cmp, prs, saved] = await Promise.all([
      compareCandidates(cwd, base), listPrs(cwd), listSavedTours(this.deps.savedDir),
    ]);
    if (gen !== this.gen) return;
    const compare: Entry[] = cmp.candidates.map((candidate) => ({ kind: 'change', candidate }));
    if (cmp.onBase) compare.unshift({ kind: 'info', label: `You are on ${base}. Pick another branch, a commit or a range.` });
    const groups: Group[] = [{ id: 'compare', label: `COMPARED WITH ${base}`, entries: compare }];
    if (prs.length) groups.push({ id: 'prs', label: 'REVIEW REQUESTED', entries: prs.map((candidate) => ({ kind: 'change', candidate })) });
    groups.push({
      id: 'saved', label: 'SAVED',
      entries: saved.length ? saved.map((t: SavedTour) => ({ kind: 'saved', path: t.path, label: t.label, files: t.files } as Entry)) : [{ kind: 'info', label: 'No saved tours yet' }],
    });
    groups.push({ id: 'other', label: 'OTHER', entries: [{ kind: 'commit' }, { kind: 'range' }, { kind: 'file' }] });
    this.groups = groups;
    this.counting = true;
    this.emitter.fire();
    const todo = compare.filter((e): e is Extract<Entry, { kind: 'change' }> => e.kind === 'change');
    await mapLimit(todo, 6, async (e) => {
      try { e.target = await resolveTarget(cwd, 'branch', e.candidate.label, e.candidate.base, e.candidate.head); } catch (err) { e.error = (err as Error).message; }
      if (gen === this.gen) this.emitter.fire();
    });
    if (gen === this.gen) { this.counting = false; this.emitter.fire(); }
  }
}

export function present(e: Entry, minFiles: number): { label: string; description?: string; detail?: string; icon: string } {
  switch (e.kind) {
    case 'change': {
      const c = e.candidate;
      return {
        label: c.label, detail: c.detail, icon: c.kind === 'pr' ? 'git-pull-request' : 'git-branch',
        description: e.target ? describeCount(e.target.files, minFiles) : e.error ? e.error : c.kind === 'pr' ? 'counted when picked' : 'counting…',
      };
    }
    case 'saved': return { label: e.label, icon: 'bookmark', description: e.files !== undefined ? `${e.files} files · saved` : 'saved' };
    case 'commit': return { label: 'A single commit…', icon: 'git-commit' };
    case 'range': return { label: 'A range…', icon: 'diff' };
    case 'file': return { label: 'A saved tour file…', icon: 'file' };
    case 'info': return { label: e.label, icon: 'info' };
  }
}

interface PickItem extends vscode.QuickPickItem { entry?: Entry }

export async function showPicker(model: ChangeModel, deps: Deps): Promise<void> {
  const qp = vscode.window.createQuickPick<PickItem>();
  qp.title = 'diff-tour: Tour a change';
  qp.placeholder = 'A new tour takes 2 to 5 minutes. A saved tour opens instantly and costs nothing.';
  qp.matchOnDescription = true;
  const build = () => {
    const active = qp.activeItems[0]?.entry;
    const items: PickItem[] = [];
    for (const g of model.groups) {
      items.push({ label: g.label, kind: vscode.QuickPickItemKind.Separator });
      for (const entry of g.entries) {
        const p = present(entry, deps.settings().minFiles);
        items.push({ label: `$(${p.icon}) ${p.label}`, description: p.description, detail: p.detail, entry });
      }
    }
    qp.items = items;
    if (active) { const keep = items.find((i) => i.entry === active); if (keep) qp.activeItems = [keep]; }
    qp.busy = model.counting;
    if (model.message) qp.placeholder = model.message;
  };
  const sub = model.onDidChange(build);
  qp.onDidAccept(() => {
    const entry = qp.selectedItems[0]?.entry;
    if (!entry || entry.kind === 'info') return;
    qp.hide();
    choose(entry, deps).catch((e) => vscode.window.showErrorMessage(String((e as Error).message ?? e)));
  });
  qp.onDidHide(() => { sub.dispose(); qp.dispose(); });
  qp.show();
  build();
  void model.refresh();
}

export async function choose(entry: Entry, deps: Deps, model?: ChangeModel): Promise<void> {
  const cwd = model?.cwd ?? currentModel?.cwd;
  switch (entry.kind) {
    case 'info': return;
    case 'saved': await vscode.commands.executeCommand('difftour.internal.openSavedTour', entry.path); return;
    case 'file': {
      const [uri] = (await vscode.window.showOpenDialog({ canSelectMany: false, filters: { 'Tour JSON': ['json'] } })) ?? [];
      if (uri) await vscode.commands.executeCommand('difftour.internal.openSavedTour', uri.fsPath);
      return;
    }
    case 'change': {
      if (!cwd) throw new Error('Open a folder that contains a git repository.');
      let target = entry.target;
      if (!target) {
        let c = entry.candidate;
        if (c.kind === 'pr') c = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Fetching PR #${c.pr}…` }, () => fetchPr(cwd, c));
        target = await resolveTarget(cwd, c.kind === 'pr' ? 'pr' : 'branch', entry.candidate.label, c.base, c.head);
      }
      return routeTarget(target, deps);
    }
    case 'commit': {
      if (!cwd) throw new Error('Open a folder that contains a git repository.');
      const commits = await recentCommits(cwd, 50);
      const pick = await vscode.window.showQuickPick(commits.map((c) => ({ label: c.subject, description: `${c.sha.slice(0, 7)} · ${c.when}`, sha: c.sha })), { title: 'Pick a commit' });
      if (!pick) return;
      let t: Target;
      try { t = await resolveTarget(cwd, 'commit', `${pick.sha.slice(0, 7)} ${pick.label}`, `${pick.sha}^`, pick.sha); } catch {
        throw new Error('This commit has no parent to compare with.');
      }
      return routeTarget(t, deps);
    }
    case 'range': {
      if (!cwd) throw new Error('Open a folder that contains a git repository.');
      const input = await vscode.window.showInputBox({
        prompt: 'Range as <base>..<head>',
        validateInput: async (v) => {
          const r = parseRange(v);
          if (!r) return 'Use <base>..<head>';
          for (const ref of [r.base, r.head]) if (!(await refExists(cwd, ref))) return `"${ref}" is not a commit in this repository`;
          return undefined;
        },
      });
      if (!input) return;
      const r = parseRange(input)!;
      return routeTarget(await resolveTarget(cwd, 'range', input.trim(), r.base, r.head), deps);
    }
  }
}

// The tree click command has no model argument; extension.ts registers the active model here.
let currentModel: ChangeModel | undefined;
export function setCurrentModel(m: ChangeModel) { currentModel = m; }

export async function routeTarget(target: Target, deps: Deps): Promise<void> {
  const s = deps.settings();
  if (target.files === 0) { void vscode.window.showInformationMessage(`${target.label}: no changes between ${target.base} and ${target.head}.`); return; }
  if (target.files < s.minFiles) { await vscode.commands.executeCommand('difftour.internal.openSmallChange', target); return; }
  const roots = [...(vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath), deps.extensionPath];
  const { missing } = await detectTools(s, roots);
  if (missing.length) { await missingNotice(missing.map((m) => m.what), missing.map((m) => m.message), deps); return; }
  await vscode.commands.executeCommand('difftour.internal.startTour', target);
}

async function missingNotice(what: string[], messages: string[], deps: Deps): Promise<void> {
  const choice = await vscode.window.showErrorMessage(messages.join('\n'), 'Open Settings', 'How to install');
  if (choice === 'Open Settings') { await vscode.commands.executeCommand('workbench.action.openSettings', 'difftour.cliPath'); return; }
  if (choice !== 'How to install') return;
  const dirs = [deps.extensionPath, ...(vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath)];
  const fork = dirs.map((d) => path.join(d, 'cli', 'FORK.md')).find((p) => fs.existsSync(p));
  if (fork) { await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(fork)); return; }
  const lines = ['Build the fork: cd cli && go build -o bin/tour.exe ./cmd/tour, then set difftour.cliPath.'];
  if (what.includes('claude')) lines.push('Install Claude Code: npm install -g @anthropic-ai/claude-code, then run claude once.');
  void vscode.window.showInformationMessage(lines.join(' '), { modal: true });
}
