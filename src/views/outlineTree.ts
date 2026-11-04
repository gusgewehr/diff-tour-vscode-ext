import * as vscode from 'vscode';
import type { TourController } from '../tour/controller';

type Node = { type: 'chapter'; index: number } | { type: 'step'; index: number };

export class OutlineTree implements vscode.TreeDataProvider<Node> {
  private emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.emitter.event;
  constructor(private tours: TourController) { tours.onDidChange(() => this.emitter.fire()); }

  getChildren(n?: Node): Node[] {
    const s = this.tours.session;
    if (!s) return [];
    if (!n) return s.tour.chapters.map((_, index) => ({ type: 'chapter', index }));
    if (n.type === 'step') return [];
    return s.steps.filter((f) => f.chapterIndex === n.index).map((f) => ({ type: 'step', index: f.globalIndex }));
  }

  getTreeItem(n: Node): vscode.TreeItem {
    const s = this.tours.session!;
    if (n.type === 'chapter') {
      const item = new vscode.TreeItem(s.tour.chapters[n.index].title, vscode.TreeItemCollapsibleState.Expanded);
      item.id = 'ch-' + n.index;
      return item;
    }
    const f = s.steps[n.index];
    const item = new vscode.TreeItem(`${n.index + 1}. ${f.step.title}`);
    item.id = 'st-' + n.index;
    const icon = s.state.done[n.index] ? 'pass-filled' : n.index === s.index ? 'play-circle' : f.step.question ? 'question' : 'circle-large-outline';
    item.iconPath = new vscode.ThemeIcon(icon);
    if (s.state.notes[n.index]) item.description = vscode.l10n.t('✎ note');
    item.command = { command: 'difftour.internal.gotoStep', title: vscode.l10n.t('Go to step'), arguments: [n.index] };
    return item;
  }
}
