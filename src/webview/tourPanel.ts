import * as vscode from 'vscode';
import { parseIntent, type Intent, type RenderMsg } from '../tour/messages';
import { nonce, webviewHtml } from './html';

export class TourPanel {
  private panel: vscode.WebviewPanel;
  private closed = false;

  constructor(extensionUri: vscode.Uri, title: string, onIntent: (i: Intent) => void, private onClosed: () => void, existing?: vscode.WebviewPanel) {
    const roots = [vscode.Uri.joinPath(extensionUri, 'dist', 'webview'), vscode.Uri.joinPath(extensionUri, 'media')];
    const panel = existing ?? vscode.window.createWebviewPanel('difftour.tour', title, { viewColumn: vscode.ViewColumn.Active }, {
      enableScripts: true, retainContextWhenHidden: true, localResourceRoots: roots,
    });
    this.panel = panel;
    const w = panel.webview;
    if (existing) { w.options = { enableScripts: true, localResourceRoots: roots }; panel.title = title; }
    w.html = webviewHtml({
      cspSource: w.cspSource,
      nonce: nonce(),
      scriptUri: w.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'tour.js')).toString(),
      styleUris: [w.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'tour.css')).toString()],
      title,
    });
    w.onDidReceiveMessage((m: unknown) => {
      const i = parseIntent(m);
      if (i) onIntent(i);
    });
    panel.onDidDispose(() => { if (!this.closed) { this.closed = true; this.onClosed(); } });
  }

  post(msg: RenderMsg): void { void this.panel.webview.postMessage(msg); }
  setTitle(t: string): void { this.panel.title = t; }
  reveal(): void { this.panel.reveal(undefined, false); }
  dispose(): void { this.closed = true; this.panel.dispose(); }
}
