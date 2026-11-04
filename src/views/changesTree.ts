import * as vscode from 'vscode';
import { ChangeModel, Entry, Group, present } from '../pick';

type Node = Group | Entry;
const isGroup = (n: Node): n is Group => 'entries' in n;

export class ChangesTree implements vscode.TreeDataProvider<Node> {
  private emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.emitter.event;
  constructor(private model: ChangeModel, private minFiles: () => number) {
    model.onDidChange(() => this.emitter.fire());
  }

  async getChildren(n?: Node): Promise<Node[]> {
    if (!n) { await this.model.ensureLoaded(); return this.model.groups; }
    return isGroup(n) ? n.entries : [];
  }

  getTreeItem(n: Node): vscode.TreeItem {
    if (isGroup(n)) {
      const item = new vscode.TreeItem(n.label, vscode.TreeItemCollapsibleState.Expanded);
      item.contextValue = 'group';
      return item;
    }
    const p = present(n, this.minFiles());
    const item = new vscode.TreeItem(p.label);
    item.description = p.description;
    item.tooltip = p.detail;
    item.iconPath = new vscode.ThemeIcon(p.icon);
    if (n.kind !== 'info') item.command = { command: 'difftour.internal.choose', title: 'Tour', arguments: [n] };
    return item;
  }
}
