import * as vscode from 'vscode';
import { TourPanel } from '../webview/tourPanel';
import { codeTargetForBlock, primaryCode, renderMessage, type Intent } from './messages';
import { StepEnricher } from './enrich';
import { resolveTour } from './open';
import { TourSession } from './session';
import { StateStore } from './state';

let current: TourSession | undefined;
export function activeSession(): TourSession | undefined { return current; }

export class TourController implements vscode.Disposable {
  private emitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.emitter.event;
  private status: vscode.StatusBarItem;
  private panel: TourPanel | undefined;
  private sub: { dispose(): void } | undefined;
  private _session: TourSession | undefined;
  private enricher: StepEnricher | undefined;

  constructor(private context: vscode.ExtensionContext, private cwd: () => string | undefined) {
    this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.status.command = 'difftour.internal.revealTour';
    this.status.tooltip = vscode.l10n.t('Show the tour');
  }

  get session(): TourSession | undefined { return this._session; }

  async open(tourPath: string, existing?: vscode.WebviewPanel): Promise<void> {
    let r;
    try { r = await resolveTour(tourPath, this.cwd()); } catch (e) {
      void vscode.window.showErrorMessage(vscode.l10n.t('Could not open the tour: {0}', String((e as Error).message ?? e)));
      existing?.dispose();
      return;
    }
    this.endSession();
    const s = new TourSession(r.tour, r.meta, r.id, r.path, new StateStore(this.context.workspaceState, r.id));
    this._session = current = s;
    this.enricher = new StepEnricher({ cwd: this.cwd(), baseSha: r.meta.baseSha, headSha: r.meta.headSha, base: r.tour.base, head: r.tour.head, steps: s.steps });
    this.sub = s.onDidChange((k) => {
      if (k !== 'text') void this.postRender();
      this.updateStatus();
      this.emitter.fire();
    });
    void vscode.commands.executeCommand('setContext', 'difftour.tourActive', true);
    const title = r.tour.title || vscode.l10n.t('Tour');
    if (!this.panel) {
      this.panel = new TourPanel(this.context.extensionUri, title, (i) => this.handle(i), () => this.end(), existing);
    } else { this.panel.setTitle(title); this.panel.reveal(); }
    void this.postRender();
    this.updateStatus();
    this.status.show();
    this.emitter.fire();
  }

  private async postRender(): Promise<void> {
    const s = this._session;
    if (!s) return;
    const i = s.index;
    const data = await (this.enricher?.forStep(i) ?? Promise.resolve([])).catch(() => []);
    if (this._session !== s || s.index !== i) return; // stale: the step moved while git was running
    this.panel?.post(renderMessage(s, data));
  }
  private updateStatus(): void { if (this._session) this.status.text = vscode.l10n.t('$(book) Step {0} / {1}', this._session.index + 1, this._session.steps.length); }

  private handle(i: Intent): void {
    const s = this._session;
    if (!s) return;
    switch (i.type) {
      case 'ready': void this.postRender(); break;
      case 'next': s.next(); break;
      case 'prev': s.prev(); break;
      case 'goto': s.goto(i.index); break;
      case 'understood': s.toggleUnderstood(); break;
      case 'note': s.setNote(i.text); break;
      case 'guess': s.setGuess(i.text); break;
      case 'openCode': {
        const step = s.current.step;
        const t = i.block !== undefined ? codeTargetForBlock(step, i.block) : primaryCode(step);
        if (t) void vscode.commands.executeCommand('difftour.internal.openCode', { tourId: s.id, ...t });
        else void vscode.window.showInformationMessage(vscode.l10n.t('This step has no code to open.'));
        break;
      }
      case 'copy':
        void vscode.env.clipboard.writeText(i.text).then(() => vscode.window.setStatusBarMessage(vscode.l10n.t('$(check) Snippet copied'), 2000));
        break;
      case 'openFile':
        void vscode.commands.executeCommand('difftour.internal.openCode', { tourId: s.id, file: i.file, at: i.at ?? 'head', lines: [i.line, i.end ?? i.line] });
        break;
    }
  }

  goto(i: number): void { this._session?.goto(i); this.reveal(); }
  reveal(): void { this.panel?.reveal(); }

  private endSession(): void {
    this.sub?.dispose(); this.sub = undefined; this.enricher = undefined;
    this._session?.dispose();
    this._session = current = undefined;
  }

  end(): void {
    this.endSession();
    this.panel = undefined;
    void vscode.commands.executeCommand('setContext', 'difftour.tourActive', false);
    this.status.hide();
    this.emitter.fire();
  }

  dispose(): void {
    const p = this.panel;
    this.end();
    p?.dispose();
    this.status.dispose();
    this.emitter.dispose();
  }
}
