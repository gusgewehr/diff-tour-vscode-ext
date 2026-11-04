import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { readSettings } from './settings';
import { setTranslator } from './l10n';
import { ChangeModel, Deps, Entry, choose, setCurrentModel, showPicker } from './pick';
import { ChangesTree } from './views/changesTree';
import type { Target } from './git/changes';
import { SmallChange } from './small/smallChange';
import { startTour, revealWriting } from './cli/startTour';
import { TourController } from './tour/controller';
import { registerCodeOpen } from './tour/openCode';
import { OutlineTree } from './views/outlineTree';
import { FlowBarView } from './views/flowBarView';

export function activate(context: vscode.ExtensionContext): void {
  setTranslator((m, ...a) => vscode.l10n.t(m, ...a), vscode.env.language);
  // a VSIX packed on Windows loses the exec bit, so restore it on the bundled CLI
  if (process.platform !== 'win32') fs.chmod(path.join(context.extensionPath, 'cli', 'bin', 'tour'), 0o755, () => {});
  const deps: Deps = {
    settings: () => readSettings(vscode.workspace.getConfiguration('difftour'), vscode.env.language),
    savedDir: path.join(context.globalStorageUri.fsPath, 'tours'),
    extensionPath: context.extensionPath,
  };
  const model = new ChangeModel(deps);
  setCurrentModel(model);
  const err = (e: unknown) => vscode.window.showErrorMessage(String((e as Error).message ?? e));
  const reg = (id: string, fn: (...a: any[]) => unknown) => context.subscriptions.push(vscode.commands.registerCommand(id, fn));

  reg('difftour.tourChange', () => showPicker(model, deps));
  reg('difftour.refreshChanges', () => model.refresh());
  reg('difftour.internal.choose', (entry: Entry) => choose(entry, deps, model).catch(err));
  const tours = new TourController(context, () => model.cwd);
  context.subscriptions.push(tours);
  const small = new SmallChange(() => model.cwd, () => deps.settings().minFiles);
  small.register(context);
  reg('difftour.internal.openSmallChange', (t: Target) => small.open(t).catch(err));
  const output = vscode.window.createOutputChannel('diff-tour');
  context.subscriptions.push(output);
  reg('difftour.internal.startTour', (t: Target) => startTour(t, {
    settings: deps.settings, savedDir: deps.savedDir, extensionPath: deps.extensionPath, extensionUri: context.extensionUri,
    cwd: () => model.cwd, hideSmall: () => small.hide(), refresh: () => void model.refresh(), output,
  }).catch(err));
  reg('difftour.internal.revealWriting', () => revealWriting());
  // the tour reads code from model.cwd, so wait for the repo root (not the whole branch/PR list)
  reg('difftour.internal.openSavedTour', (p: string) => model.ensureRoot().then(() => tours.open(p)).catch(err));
  reg('difftour.internal.revealTour', () => tours.reveal());
  reg('difftour.internal.gotoStep', (i: unknown) => { if (typeof i === 'number' && Number.isInteger(i)) tours.goto(i); });
  registerCodeOpen(context, tours, () => model.cwd);
  const flowBar = new FlowBarView(context.extensionUri, () => tours.session, () => tours.reveal());
  let wasActive = false;
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(FlowBarView.viewType, flowBar, { webviewOptions: { retainContextWhenHidden: true } }), tours.onDidChange(() => {
    flowBar.refresh();
    const active = !!tours.session;
    if (active && !wasActive) flowBar.show();
    wasActive = active;
  }));
  const outline = vscode.window.createTreeView('difftour.outline', { treeDataProvider: new OutlineTree(tours) });
  context.subscriptions.push(outline, tours.onDidChange(() => {
    const t = tours.session;
    outline.description = t ? vscode.l10n.t('{0} of {1} understood', t.understoodCount(), t.steps.length) : undefined;
  }), vscode.window.registerWebviewPanelSerializer('difftour.tour', {
    async deserializeWebviewPanel(panel: vscode.WebviewPanel, state: unknown) {
      const p = (state as { path?: unknown } | undefined)?.path;
      if (typeof p === 'string' && fs.existsSync(p)) { await model.ensureRoot(); await tours.open(p, panel); } else panel.dispose();
    },
  }));

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => { if (e.affectsConfiguration('difftour')) void model.refresh(); }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => void model.refresh()),
  );
  const treeView = vscode.window.createTreeView('difftour.changes', {
    treeDataProvider: new ChangesTree(model, () => deps.settings().minFiles),
  });
  context.subscriptions.push(treeView, model.onDidChange(() => { treeView.message = model.message; }));
}

export function deactivate(): void {}
