import * as vscode from 'vscode';
import { initialState, type ProgressState } from '../cli/progress';
import { nonce, webviewHtml } from './html';

export interface WritingHandlers { onCancel(): void; onSkip(): void }

export class WritingPanel {
  private panel: vscode.WebviewPanel | undefined;
  private state: ProgressState = initialState();
  private timer: NodeJS.Timeout | undefined;
  private lastPost = 0;
  private disposed = false;

  constructor(private extensionUri: vscode.Uri, private label: string, private canSkip: boolean, private handlers: WritingHandlers) {}

  get active(): boolean { return this.panel?.active ?? false; }

  show(): void {
    if (this.disposed) return;
    if (this.panel) { this.panel.reveal(undefined, true); return; }
    const u = this.extensionUri;
    const panel = vscode.window.createWebviewPanel('difftour.writing', vscode.l10n.t('Writing tour'), { viewColumn: vscode.ViewColumn.Active, preserveFocus: true }, {
      enableScripts: true,
      retainContextWhenHidden: false,
      localResourceRoots: [vscode.Uri.joinPath(u, 'dist', 'webview'), vscode.Uri.joinPath(u, 'media')],
    });
    this.panel = panel;
    const w = panel.webview;
    w.html = webviewHtml({
      cspSource: w.cspSource,
      nonce: nonce(),
      scriptUri: w.asWebviewUri(vscode.Uri.joinPath(u, 'dist', 'webview', 'writing.js')).toString(),
      styleUris: [w.asWebviewUri(vscode.Uri.joinPath(u, 'media', 'writing.css')).toString()],
      title: vscode.l10n.t('Writing tour'),
    });
    w.onDidReceiveMessage((m: { type?: string }) => {
      if (m?.type === 'ready') this.post();
      else if (m?.type === 'cancel') this.handlers.onCancel();
      else if (m?.type === 'skip') this.handlers.onSkip();
    });
    panel.onDidDispose(() => { if (this.panel === panel) this.panel = undefined; });
  }

  update(state: ProgressState): void {
    if (this.disposed) return;
    this.state = state;
    if (this.timer) return;
    const wait = Math.max(0, 100 - (Date.now() - this.lastPost));
    this.timer = setTimeout(() => { this.timer = undefined; this.post(); }, wait);
  }

  private post(): void {
    this.lastPost = Date.now();
    void this.panel?.webview.postMessage({ type: 'state', label: this.label, canSkip: this.canSkip, state: this.state });
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    const p = this.panel;
    this.panel = undefined;
    p?.dispose();
  }
}
