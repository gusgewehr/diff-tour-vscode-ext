// Loads dist/extension.js against a mock 'vscode' and checks activate() wiring.
import Module, { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const commands = [];
const views = [];
let failed = '';
process.on('unhandledRejection', (e) => { failed = `unhandledRejection: ${e}`; process.exitCode = 1; });

const loose = () => new Proxy(function () {}, { get: (_t, k) => (k === 'then' ? undefined : loose()), apply: () => loose(), construct: () => loose() });
const dispose = { dispose() {} };
class EventEmitter {
  event = () => dispose;
  fire() {}
  dispose() {}
}
const base = {
  commands: { registerCommand: (id) => { commands.push(id); return dispose; }, executeCommand: async () => undefined },
  window: { createTreeView: (id) => { views.push(id); return { message: '', dispose() {} }; } },
  workspace: {
    workspaceFolders: undefined,
    getConfiguration: () => ({ get: (_k, d) => d }),
    onDidChangeConfiguration: () => dispose,
    onDidChangeWorkspaceFolders: () => dispose,
  },
  env: { language: 'en' },
  EventEmitter,
  TreeItem: class { constructor(label, collapsibleState) { this.label = label; this.collapsibleState = collapsibleState; } },
  ThemeIcon: class { constructor(id) { this.id = id; } },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  QuickPickItemKind: { Separator: -1, Default: 0 },
  Uri: { file: (p) => ({ fsPath: p }) },
};
const mock = new Proxy(base, { get: (t, k) => (k in t ? t[k] : loose()) });

const origRequire = Module.prototype.require;
Module.prototype.require = function (id) { return id === 'vscode' ? mock : origRequire.apply(this, arguments); };

try {
  const ext = createRequire(import.meta.url)(path.join(root, 'dist', 'extension.js'));
  await ext.activate({ subscriptions: [], globalStorageUri: { fsPath: os.tmpdir() }, extensionPath: root });
  await new Promise((r) => setTimeout(r, 50));
} catch (e) { failed = `exception: ${e?.stack ?? e}`; }

const want = ['difftour.tourChange', 'difftour.refreshChanges', 'difftour.internal.choose', 'difftour.internal.openSmallChange', 'difftour.internal.startTour', 'difftour.internal.openSavedTour'];
const missing = want.filter((c) => !commands.includes(c)).concat(views.includes('difftour.changes') ? [] : ['view difftour.changes']);
if (failed || missing.length) {
  console.error(`smoke FAILED: ${failed} missing: ${missing.join(', ')}`);
  process.exitCode = 1;
} else console.log('smoke ok: 6 commands, 1 view');
