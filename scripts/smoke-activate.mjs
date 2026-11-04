// Loads dist/extension.js against a mock 'vscode' and checks activate() wiring.
import Module, { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const commands = [];
const views = [];
const handlers = new Map();
const execs = [];
const posts = [];
const warnings = [];
const clipboard = [];
const panel = { title: '', onMsg: undefined, onDispose: undefined };
const memento = new Map();
const viewProviders = new Map();
const flowPosts = [];
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
  commands: { registerCommand: (id, fn) => { commands.push(id); handlers.set(id, fn); return dispose; }, executeCommand: async (...a) => { execs.push(a); return undefined; } },
  window: {
    registerWebviewPanelSerializer: () => dispose,
    registerWebviewViewProvider: (id, p) => { viewProviders.set(id, p); return dispose; },
    setStatusBarMessage: () => dispose,
    showErrorMessage: async (m) => { console.error('showErrorMessage:', m); },
    showInformationMessage: async () => undefined,
    showWarningMessage: async (m) => { warnings.push(m); },
    onDidChangeActiveTextEditor: () => dispose,
    visibleTextEditors: [],
    createWebviewPanel: (_t, title) => {
      panel.title = title;
      panel.html = '';
      return {
        set title(v) { panel.title = v; }, get title() { return panel.title; },
        webview: {
          cspSource: 'vscode-resource:', options: {},
          set html(v) { panel.html = v; }, get html() { return panel.html; },
          asWebviewUri: (u) => ({ toString: () => 'vscode-resource:' + u.fsPath }),
          postMessage: async (m) => { posts.push(m); return true; },
          onDidReceiveMessage: (fn) => { panel.onMsg = fn; return dispose; },
        },
        reveal() {}, onDidDispose: (fn) => { panel.onDispose = fn; return dispose; }, dispose() { panel.onDispose?.(); },
      };
    },
    createOutputChannel: () => ({ appendLine() {}, show() {}, dispose() {} }), createStatusBarItem: () => ({ show() {}, hide() {}, dispose() {} }), createTreeView: (id) => { views.push(id); return { message: '', dispose() {} }; } },
  workspace: {
    workspaceFolders: undefined,
    registerTextDocumentContentProvider: () => dispose,
    getConfiguration: () => ({ get: (_k, d) => d }),
    onDidChangeConfiguration: () => dispose,
    onDidChangeWorkspaceFolders: () => dispose,
  },
  env: { language: 'en', clipboard: { writeText: async (t) => { clipboard.push(t); } } },
  extensions: { getExtension: () => undefined },
  StatusBarAlignment: { Left: 1, Right: 2 },
  EventEmitter,
  TreeItem: class { constructor(label, collapsibleState) { this.label = label; this.collapsibleState = collapsibleState; } },
  ThemeIcon: class { constructor(id) { this.id = id; } },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  QuickPickItemKind: { Separator: -1, Default: 0 },
  Uri: { file: (p) => ({ fsPath: p }), joinPath: (u, ...parts) => ({ fsPath: path.join(u.fsPath, ...parts) }) },
  ViewColumn: { Active: -1 },
};
const mock = new Proxy(base, { get: (t, k) => (k in t ? t[k] : loose()) });

const origRequire = Module.prototype.require;
Module.prototype.require = function (id) { return id === 'vscode' ? mock : origRequire.apply(this, arguments); };

try {
  const ext = createRequire(import.meta.url)(path.join(root, 'dist', 'extension.js'));
  await ext.activate({ subscriptions: [], workspaceState: { get: (k) => memento.get(k), update: async (k, v) => { memento.set(k, v); } }, globalStorageUri: { fsPath: os.tmpdir() }, extensionPath: root, extensionUri: { fsPath: root } });
  await new Promise((r) => setTimeout(r, 50));

  const assert = (await import('node:assert/strict')).default;
  await handlers.get('difftour.internal.openSavedTour')(path.join(root, 'fixtures', 'tours', 'real-9c18e24.json'));
  assert.ok(panel.html.includes('tour.js') && panel.html.includes("script-src 'nonce-"), 'panel html');
  const settle = () => new Promise((r) => setTimeout(r, 20));
  await settle();
  const last = () => posts[posts.length - 1];
  panel.onMsg({ type: 'ready' }); await settle();
  assert.equal(last().type, 'render'); assert.equal(last().total, 18); assert.equal(last().index, 0);
  assert.ok(Array.isArray(last().blockData) && last().blockData.length === last().step.blocks.length, 'blockData');
  panel.onMsg({ type: 'next' }); await settle();
  assert.equal(last().index, 1);
  panel.onMsg({ type: 'copy', text: 'snippet' }); panel.onMsg({ type: 'copy', text: 5 }); await settle();
  assert.deepEqual(clipboard, ['snippet']);
  const n = posts.length;
  panel.onMsg({ type: 'goto', index: 'x' }); panel.onMsg({ type: 'bogus' }); panel.onMsg(null); await settle();
  assert.equal(posts.length, n, 'invalid messages ignored');
  const key = [...memento.keys()].find((k) => k.startsWith('difftour.state.file-'));
  assert.ok(key, 'state key'); assert.equal(memento.get(key).step, 1);
  assert.ok(execs.some((a) => a[0] === 'setContext' && a[1] === 'difftour.tourActive' && a[2] === true), 'context true');
  const tid = key.slice('difftour.state.'.length);
  const diffs = () => execs.filter((a) => a[0] === 'vscode.diff').length;
  const w0 = warnings.length;
  await handlers.get('difftour.internal.openCode')({ tourId: tid, file: 'a.ts', at: 'head', lines: [1, 2] });
  await handlers.get('difftour.internal.openCode')({ tourId: 'wrong', file: 'a.ts', at: 'head', lines: [1, 2] });
  await handlers.get('difftour.internal.openCode')({ bogus: 1 });
  assert.equal(diffs(), 0, 'no diff without toured SHAs / matching id');
  assert.equal(warnings.length - w0, 3, 'warning path ran');
  for (const c of ['backToStep', 'prevStep', 'nextStep']) await handlers.get('difftour.' + c)();
  assert.ok(viewProviders.has('difftour.flowBar'), 'flow view provider');
  let fmsg; const fhtml = { v: '' };
  viewProviders.get('difftour.flowBar').resolveWebviewView({ show() {}, onDidDispose() {}, webview: { cspSource: 'vscode-resource:', options: {}, set html(v) { fhtml.v = v; }, get html() { return fhtml.v; }, asWebviewUri: (u) => ({ toString: () => 'vscode-resource:' + u.fsPath }), postMessage: async (m) => { flowPosts.push(m); return true; }, onDidReceiveMessage: (fn) => { fmsg = fn; return dispose; } } });
  assert.ok(fhtml.v.includes('flow.js') && fhtml.v.includes("script-src 'nonce-"), 'flow html');
  fmsg({ type: 'ready' }); await settle();
  assert.equal(flowPosts.at(-1).type, 'bar'); assert.ok(Array.isArray(flowPosts.at(-1).paths));
  const fn = flowPosts.length;
  fmsg({ type: 'click', path: 'x' }); fmsg(null); fmsg({ type: 'click', path: 99, node: 99 }); await settle();
  assert.equal(flowPosts.length, fn, 'invalid flow messages ignored');
  const pj = JSON.parse((await import('node:fs')).readFileSync(path.join(root, 'package.json'), 'utf8')).contributes;
  assert.ok(pj.viewsContainers.panel.some((c) => c.id === 'difftourFlow') && pj.views.difftourFlow.some((v) => v.id === 'difftour.flowBar'), 'flow contributions');
  panel.onDispose();
  assert.ok(execs.some((a) => a[0] === 'setContext' && a[2] === false), 'context false');
} catch (e) { failed = `exception: ${e?.stack ?? e}`; }

const want = ['difftour.tourChange', 'difftour.refreshChanges', 'difftour.internal.choose', 'difftour.internal.openSmallChange', 'difftour.internal.openSmallChangeFile', 'difftour.internal.startTour', 'difftour.internal.revealWriting', 'difftour.internal.openSavedTour', 'difftour.internal.revealTour', 'difftour.internal.gotoStep', 'difftour.internal.openCode', 'difftour.backToStep', 'difftour.prevStep', 'difftour.nextStep'];
const missing = want.filter((c) => !commands.includes(c)).concat(['difftour.changes', 'difftour.smallChange', 'difftour.outline'].filter((v) => !views.includes(v)).map((v) => `view ${v}`));
if (failed || missing.length) {
  console.error(`smoke FAILED: ${failed} missing: ${missing.join(', ')}`);
  process.exitCode = 1;
} else console.log('smoke ok: 14 commands, 3 views, flow bar view, tour opened');
