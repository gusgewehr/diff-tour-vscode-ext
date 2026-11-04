import * as vscode from 'vscode';
import * as path from 'node:path';
import { ChangedFile, Target, listChangedFiles } from '../git/changes';
import { tourUri } from '../git/contentProvider';
import { noticeText, sides, statusText } from './logic';

type Node = { root: true } | { file: ChangedFile; index: number };

export class SmallChange implements vscode.TreeDataProvider<Node> {
  private files: ChangedFile[] = [];
  private target?: Target;
  private cwd = '';
  private status?: vscode.StatusBarItem;
  private tree?: vscode.TreeView<Node>;
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;
  private readonly rootNode: Node = { root: true };

  constructor(private getCwd: () => string | undefined, private minFiles: () => number) {}

  register(context: vscode.ExtensionContext): void {
    this.tree = vscode.window.createTreeView<Node>('difftour.smallChange', { treeDataProvider: this });
    context.subscriptions.push(
      vscode.commands.registerCommand('difftour.internal.openSmallChangeFile', (i: number) => this.openFile(i)),
      this.tree, this.changed,
    );
  }

  private uri(p: string | undefined, sha: string): vscode.Uri {
    if (p === undefined) return tourUri(undefined, sha, this.cwd);
    try {
      const api = vscode.extensions.getExtension('vscode.git')?.exports?.getAPI(1);
      if (api) return api.toGitUri(vscode.Uri.file(path.join(this.cwd, p)), sha) as vscode.Uri;
    } catch { /* fall back to our provider */ }
    return tourUri(p, sha, this.cwd);
  }

  private async openFile(i: number): Promise<void> {
    const f = this.files[i];
    const t = this.target;
    if (!f || !t) return;
    const s = sides(f);
    const title = `${f.path} (${t.baseSha.slice(0, 7)} ↔ ${t.headSha.slice(0, 7)})`;
    await vscode.commands.executeCommand('vscode.diff', this.uri(s.left, t.baseSha), this.uri(s.right, t.headSha), title, { preview: true });
  }

  async open(target: Target): Promise<void> {
    const cwd = this.getCwd();
    if (!cwd) throw new Error(vscode.l10n.t('Open a folder that contains a git repository.'));
    this.files = await listChangedFiles(cwd, target.baseSha, target.headSha);
    this.cwd = cwd;
    this.target = target;
    await vscode.commands.executeCommand('setContext', 'difftour.hasSmallChange', true);
    this.changed.fire();
    try {
      await vscode.commands.executeCommand('workbench.view.extension.difftour');
      await this.tree?.reveal(this.rootNode, { expand: true });
    } catch { /* view focus is best effort */ }

    const n = this.files.length;
    const min = this.minFiles();
    if (!this.status) {
      this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
      this.status.command = 'difftour.tourChange';
    }
    this.status.text = statusText(n, min);
    this.status.tooltip = vscode.l10n.t('Changes under difftour.minFiles files open in the standard diff without a tour. Change the setting to tour smaller changes. Click to pick a change.');
    this.status.show();
    const openSettings = vscode.l10n.t('Open Settings');
    void vscode.window.showInformationMessage(noticeText(n, min), openSettings).then((c) => {
      if (c === openSettings) void vscode.commands.executeCommand('workbench.action.openSettings', 'difftour.minFiles');
    });
    await this.openFile(0);
  }

  hide(): void {
    this.status?.hide();
    void vscode.commands.executeCommand('setContext', 'difftour.hasSmallChange', false);
  }

  getParent(node: Node): Node | undefined { return 'root' in node ? undefined : this.rootNode; }

  getChildren(node?: Node): Node[] {
    if (!this.target) return [];
    if (!node) return [this.rootNode];
    return 'root' in node ? this.files.map((file, index) => ({ file, index })) : [];
  }

  getTreeItem(node: Node): vscode.TreeItem {
    if ('root' in node) {
      return Object.assign(new vscode.TreeItem(`${this.target?.base} ↔ ${this.target?.head}`, vscode.TreeItemCollapsibleState.Expanded), { id: 'root' });
    }
    const item = new vscode.TreeItem(node.file.path, vscode.TreeItemCollapsibleState.None);
    item.description = node.file.status;
    item.resourceUri = vscode.Uri.file(path.join(this.cwd, node.file.path));
    item.command = { command: 'difftour.internal.openSmallChangeFile', title: vscode.l10n.t('Open diff'), arguments: [node.index] };
    return item;
  }
}
