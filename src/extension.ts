import * as vscode from 'vscode';
import * as path from 'node:path';
import { readSettings } from './settings';
import { ChangeModel, Deps, Entry, choose, setCurrentModel, showPicker } from './pick';
import { ChangesTree } from './views/changesTree';
import type { Target } from './git/changes';

export function activate(context: vscode.ExtensionContext): void {
  const deps: Deps = {
    settings: () => readSettings(vscode.workspace.getConfiguration('difftour'), vscode.env.language),
    savedDir: path.join(context.globalStorageUri.fsPath, 'tours'),
    extensionPath: context.extensionPath,
  };
  const model = new ChangeModel(deps);
  setCurrentModel(model);
  const err = (e: unknown) => vscode.window.showErrorMessage(String((e as Error).message ?? e));
  const range = (t: Target) => `${t.baseSha.slice(0, 7)}..${t.headSha.slice(0, 7)}`;
  const reg = (id: string, fn: (...a: any[]) => unknown) => context.subscriptions.push(vscode.commands.registerCommand(id, fn));

  reg('difftour.tourChange', () => showPicker(model, deps));
  reg('difftour.refreshChanges', () => model.refresh());
  reg('difftour.internal.choose', (entry: Entry) => choose(entry, deps, model).catch(err));
  // Stubs: replaced in Phases 3, 4 and 5.
  reg('difftour.internal.openSmallChange', (t: Target) => vscode.window.showInformationMessage(`Small change: ${t.label}, ${t.files} files (${range(t)}). The standard diff opens here in Phase 3.`));
  reg('difftour.internal.startTour', (t: Target) => vscode.window.showInformationMessage(`Tour: ${t.label}, ${t.files} files (${range(t)}). Tour writing arrives in Phase 4.`));
  reg('difftour.internal.openSavedTour', (p: string) => vscode.window.showInformationMessage(`Saved tour: ${p}. The tour document arrives in Phase 5.`));

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
