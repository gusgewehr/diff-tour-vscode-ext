import * as vscode from 'vscode';
import * as path from 'node:path';
import type { Settings } from '../settings';
import type { Target } from '../git/changes';
import { detectTools, envWithDir } from './detect';
import { run, cliArgs, type RunHandle } from './runner';
import { initialState, reduce, currentStage, type ProgressState } from './progress';
import { findExisting, saveTour } from './cache';
import { describeError, type ErrorAction } from './errors';
import { WritingPanel } from '../webview/writing';
import { missingNotice } from '../pick';

export interface WriteDeps {
  settings(): Settings;
  savedDir: string;
  extensionPath: string;
  extensionUri: vscode.Uri;
  cwd(): string | undefined;
  hideSmall(): void;
  refresh(): void;
  output: vscode.OutputChannel;
}

let current: { panel: WritingPanel } | undefined;

export function revealWriting(): void {
  current?.panel.show();
}

export async function startTour(target: Target, d: WriteDeps): Promise<void> {
  if (current) {
    current.panel.show();
    void vscode.window.showInformationMessage(vscode.l10n.t('A tour is already being written.'));
    return;
  }
  const settings = d.settings();
  const cwd = d.cwd();
  if (!cwd) throw new Error(vscode.l10n.t('Open a folder that contains a git repository.'));
  const roots = [...(vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath), d.extensionPath];
  const { cli, claude, missing } = await detectTools(settings, roots);
  if (missing.length || !cli) {
    await missingNotice(missing.map((m) => m.what), missing.map((m) => m.message), { settings: d.settings, savedDir: d.savedDir, extensionPath: d.extensionPath });
    return;
  }

  const existing = await findExisting(d.savedDir, target);
  d.hideSmall();
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  status.text = vscode.l10n.t('$(sync~spin) Writing tour…');
  status.tooltip = vscode.l10n.t('Writing tour: {0}. Click to show progress.', target.label);
  status.command = 'difftour.internal.revealWriting';
  status.show();

  let skipped = false;
  let state: ProgressState = initialState();
  let handle: RunHandle | undefined;
  const panel = new WritingPanel(d.extensionUri, target.label, !!existing, {
    onCancel: () => handle?.cancel(),
    onSkip: () => { skipped = true; handle?.cancel(); },
  });
  current = { panel };
  panel.show();

  const args = cliArgs(target, settings, cwd);
  d.output.appendLine(`> ${cli} ${args.join(' ')}`);

  let result;
  try {
    result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: vscode.l10n.t('Writing tour: {0}', target.label), cancellable: true },
      (progress, token) => {
        handle = run({ command: cli, args, cwd, env: claude ? envWithDir(path.dirname(claude)) : undefined }, (e) => {
          state = reduce(state, e);
          panel.update(state);
          progress.report({ message: currentStage(state) + (state.reads[0] ? ` · ${state.reads[0].path}` : '') });
        }, { log: (l) => d.output.appendLine(l) });
        token.onCancellationRequested(() => handle?.cancel());
        return handle.done;
      },
    );
  } finally {
    status.dispose();
    current = undefined;
  }

  if (skipped && existing) {
    panel.dispose();
    await vscode.commands.executeCommand('difftour.internal.openSavedTour', path.join(d.savedDir, `${existing.key}.json`));
    return;
  }

  if (result.done) {
    let tourPath: string;
    try {
      tourPath = await saveTour(d.savedDir, result.done, target.label, settings);
    } catch (e) {
      panel.dispose();
      void vscode.window.showErrorMessage(vscode.l10n.t('Could not save the tour: {0}', (e as Error).message));
      return;
    }
    const wasActive = panel.active;
    panel.dispose();
    d.refresh();
    const open = () => vscode.commands.executeCommand('difftour.internal.openSavedTour', tourPath);
    if (wasActive) await open();
    else {
      const openTour = vscode.l10n.t('Open tour');
      void vscode.window.showInformationMessage(vscode.l10n.t('Your tour is ready'), openTour).then((c) => { if (c === openTour) return open(); });
    }
    return;
  }

  panel.dispose();
  const info = describeError(result);
  if (!info) return;
  d.output.appendLine(`--- tour failed: ${result.error?.code ?? `exit ${result.exitCode}`}`);
  for (const p of result.error?.problems ?? []) d.output.appendLine(p);
  for (const l of result.stderrTail) d.output.appendLine(l);
  const labels: Record<ErrorAction, string> = {
    'Open Terminal': vscode.l10n.t('Open Terminal'), 'Try again': vscode.l10n.t('Try again'),
    'Show details': vscode.l10n.t('Show details'), 'Open Settings': vscode.l10n.t('Open Settings'),
  };
  const picked = await vscode.window.showErrorMessage(info.text, ...info.actions.map((a) => labels[a]));
  const choice = info.actions.find((a) => labels[a] === picked);
  switch (choice) {
    case 'Open Terminal': {
      const t = vscode.window.createTerminal({ name: 'Claude Code' });
      t.show();
      t.sendText('claude');
      break;
    }
    case 'Try again': await startTour(target, d); break;
    case 'Show details': d.output.show(); break;
    case 'Open Settings': await vscode.commands.executeCommand('workbench.action.openSettings', 'difftour'); break;
  }
}
