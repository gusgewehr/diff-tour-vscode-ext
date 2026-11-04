import type { ProgressState } from '../../cli/progress';
import { STAGES } from '../../cli/progress';

declare function acquireVsCodeApi(): { postMessage(m: unknown): void };
const vscode = acquireVsCodeApi();
const root = document.getElementById('root')!;

const STAGE_TEXT: Record<string, [string, string]> = {
  export: ['1 · Export', 'git archive, git diff and git log into a cache directory. Only files git tracks.'],
  write: ['2 · Write', 'The LLM reads with Read, Grep and Glob, then writes the tour as JSON.'],
  check: ['3 · Check', 'Every file and line the tour points to must exist. Mistakes go back to the LLM, at most twice.'],
  show: ['4 · Show', 'Code on screen is read from git at the right commit, never copied from the reply.'],
};

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function button(text: string, type: string, secondary = false): HTMLElement {
  const b = el('button', secondary ? 'secondary' : '', text);
  b.addEventListener('click', () => vscode.postMessage({ type }));
  return b;
}

function render(label: string, canSkip: boolean, s: ProgressState): void {
  const frag = document.createDocumentFragment();
  const head = el('header');
  head.append(el('h1', '', 'Writing tour'), el('div', 'label', label));
  frag.append(head);

  const stages = el('div', 'stages');
  for (const n of STAGES) {
    const [title, body] = STAGE_TEXT[n];
    const card = el('div', `stage ${s.stages[n]}`);
    const t = el('div', 'stage-title');
    t.append(el('span', '', title));
    if (s.stages[n] === 'done') t.append(el('span', 'mark', '✓'));
    if (s.stages[n] === 'active') t.append(el('span', 'spinner'));
    card.append(t, el('p', '', body));
    if (n === 'check' && s.repairs > 0) card.append(el('p', 'repair', `Repair ${s.repairs} of 2`));
    stages.append(card);
  }
  frag.append(stages);

  const reading = el('section');
  reading.append(el('h2', '', 'READING NOW'));
  const log = el('div', 'log');
  if (!s.reads.length) log.append(el('div', 'empty', 'Waiting for the LLM to read…'));
  for (const r of s.reads) {
    const row = el('div', 'row');
    row.append(el('span', 'time', r.time), el('span', 'tool', r.tool), el('span', 'path', r.path));
    if (r.tag) row.append(el('span', 'tag', r.tag.replace(/_/g, ' ')));
    log.append(row);
  }
  reading.append(log);
  frag.append(reading);

  const exp = el('section', 'export');
  exp.append(el('h2', '', 'EXPORT DIRECTORY'));
  const ul = el('ul');
  for (const f of ['base/', 'head/', 'change.diff', 'commits.txt', 'lessons/']) ul.append(el('li', '', f));
  exp.append(ul, el('p', 'note', 'Deleted once the tour is written. Read, Grep and Glob only; no writes, no network.'));
  frag.append(exp);

  const actions = el('div', 'actions');
  actions.append(button('Cancel', 'cancel', true));
  if (canSkip) actions.append(button('Skip to the tour', 'skip'));
  frag.append(actions);

  root.replaceChildren(frag);
}

window.addEventListener('message', (ev) => {
  const m = ev.data;
  if (m?.type === 'state') render(String(m.label), !!m.canSkip, m.state as ProgressState);
});
vscode.postMessage({ type: 'ready' });
