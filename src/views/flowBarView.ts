import * as vscode from 'vscode';
import { buildBar, resolveClick, type BarState } from '../tour/flowBar';
import type { TourSession } from '../tour/session';
import { nonce, webviewHtml } from '../webview/html';

export class FlowBarView implements vscode.WebviewViewProvider {
  static readonly viewType = 'difftour.flowBar';
  private view: vscode.WebviewView | undefined;
  private last: BarState = { paths: [], active: false };

  constructor(private extensionUri: vscode.Uri, private getSession: () => TourSession | undefined, private onReveal: () => void) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    const roots = [vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'), vscode.Uri.joinPath(this.extensionUri, 'media')];
    const w = view.webview;
    w.options = { enableScripts: true, localResourceRoots: roots };
    w.html = webviewHtml({
      cspSource: w.cspSource,
      nonce: nonce(),
      scriptUri: w.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'flow.js')).toString(),
      styleUris: [w.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'flow.css')).toString()],
      title: 'Tour flow',
    });
    w.onDidReceiveMessage((m: unknown) => this.onMessage(m));
    view.onDidDispose(() => { if (this.view === view) this.view = undefined; });
  }

  private onMessage(m: unknown): void {
    const o = m as { type?: unknown; path?: unknown; node?: unknown } | null;
    if (!o || typeof o !== 'object') return;
    if (o.type === 'ready') { this.refresh(); return; }
    if (o.type !== 'click') return;
    const { path: p, node: n } = o;
    if (!Number.isInteger(p) || !Number.isInteger(n)) return;
    const node = this.last.paths[p as number]?.[n as number];
    const s = this.getSession();
    if (!node || !s) return;
    const r = resolveClick(node, s.index);
    if (!r) return;
    if ('goto' in r) { s.goto(r.goto); this.onReveal(); } else {
      void vscode.commands.executeCommand('difftour.internal.openCode', { tourId: s.id, file: r.open.file, at: 'head', lines: r.open.lines });
    }
  }

  refresh(): void {
    const s = this.getSession();
    if (!this.view) return;
    if (!s) { void this.view.webview.postMessage({ type: 'clear' }); return; }
    this.last = buildBar(s.steps.map((x) => x.step), s.index, s.state.visited);
    void this.view.webview.postMessage({ type: 'bar', ...this.last });
  }

  show(): void {
    if (this.view) this.view.show(true);
    else void Promise.resolve(vscode.commands.executeCommand('difftour.flowBar.focus')).then(() => this.onReveal());
  }
}
