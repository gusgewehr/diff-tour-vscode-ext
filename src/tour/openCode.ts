import * as vscode from 'vscode';
import { blobExists } from '../git/blob';
import { ChangedFile, listChangedFiles } from '../git/changes';
import { DiffTourContentProvider, SCHEME, tourUri } from '../git/contentProvider';
import type { TourController } from './controller';
import { planOpen } from './openPlan';

interface Args { tourId: string; file: string; at: 'base' | 'head'; lines: [number, number] }

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
function parseArgs(a: unknown): Args | undefined {
  const o = a as Partial<Args> | undefined;
  if (!o || typeof o.tourId !== 'string' || typeof o.file !== 'string' || !o.file) return undefined;
  if (o.at !== 'base' && o.at !== 'head') return undefined;
  if (!Array.isArray(o.lines) || !num(o.lines[0]) || !num(o.lines[1])) return undefined;
  return { tourId: o.tourId, file: o.file, at: o.at, lines: [o.lines[0], o.lines[1]] };
}

export function registerCodeOpen(context: vscode.ExtensionContext, tours: TourController, cwd: () => string | undefined): void {
  const cache = new Map<string, ChangedFile[]>();
  const warn = (m: string) => void vscode.window.showWarningMessage(m);

  async function openCode(raw: unknown): Promise<void> {
    const a = parseArgs(raw);
    const s = tours.session;
    const root = cwd();
    if (!a || !s || s.id !== a.tourId || !s.meta.baseSha || !s.meta.headSha || !root) {
      return warn(vscode.l10n.t('Cannot open code: no matching tour with toured commits.'));
    }
    const { baseSha, headSha } = s.meta;
    const ck = `${s.id}:${baseSha}:${headSha}`;
    let changes = cache.get(ck);
    if (!changes) { changes = await listChangedFiles(root, baseSha, headSha); cache.set(ck, changes); }
    const plan = planOpen({ file: a.file, at: a.at, lines: a.lines, baseSha, headSha, changes });
    if (plan.missing) return warn(plan.missing);
    if (plan.unchanged) {
      const sha = a.at === 'base' ? baseSha : headSha;
      if (!(await blobExists(root, sha, a.file))) return warn(vscode.l10n.t('{0} is not in {1} at this commit', a.file, sha.slice(0, 7)));
    }
    const left = tourUri(plan.left, baseSha, root);
    const right = tourUri(plan.right, headSha, root);
    const range = new vscode.Range(plan.startLine, 0, plan.endLine, 0);
    await vscode.commands.executeCommand('vscode.diff', left, right, plan.title, { preview: true, preserveFocus: false, selection: range });
    if (plan.revealSide !== 'left' || !plan.left) return;
    for (let i = 0; i < 6; i++) {
      const ed = vscode.window.visibleTextEditors.find((e) => e.document.uri.toString() === left.toString());
      if (ed) { ed.selection = new vscode.Selection(range.start, range.end); ed.revealRange(range, vscode.TextEditorRevealType.InCenter); return; }
      await new Promise((r) => setTimeout(r, 50));
    }
    console.log('diff-tour: base-side editor not found, left right-side reveal');
  }

  const bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
  bar.command = 'difftour.backToStep';
  const update = () => {
    const s = tours.session;
    const on = !!s && vscode.window.activeTextEditor?.document.uri.scheme === SCHEME;
    void vscode.commands.executeCommand('setContext', 'difftour.inTourCode', on);
    if (on && s) { bar.text = vscode.l10n.t('$(arrow-left) Back to step {0}', s.index + 1); bar.show(); } else bar.hide();
  };
  const reg = (id: string, fn: (...a: any[]) => unknown) => vscode.commands.registerCommand(id, fn);
  context.subscriptions.push(
    bar,
    vscode.workspace.registerTextDocumentContentProvider(SCHEME, new DiffTourContentProvider()),
    reg('difftour.internal.openCode', (a: unknown) => openCode(a).catch((e) => vscode.window.showErrorMessage(String((e as Error).message ?? e)))),
    reg('difftour.backToStep', () => tours.reveal()),
    reg('difftour.prevStep', () => { tours.session?.prev(); tours.reveal(); }),
    reg('difftour.nextStep', () => { tours.session?.next(); tours.reveal(); }),
    vscode.window.onDidChangeActiveTextEditor(update),
    tours.onDidChange(update),
  );
}
