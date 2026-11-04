import type { ProgressState } from '../../cli/progress';
import { STAGES } from '../../cli/progress';
import { format } from '../../l10n';
import { S, applyStrings } from '../strings';

declare function acquireVsCodeApi(): { postMessage(m: unknown): void };
const vscode = acquireVsCodeApi();
const root = document.getElementById('root')!;
applyStrings(root.dataset.strings);

// built at render time so it sees the applied string table
const stageText = (): Record<string, [string, string]> => ({
  export: [`1 · ${S.stageExport}`, S.stageExportDesc],
  write: [`2 · ${S.stageWrite}`, S.stageWriteDesc],
  check: [`3 · ${S.stageCheck}`, S.stageCheckDesc],
  show: [`4 · ${S.stageShow}`, S.stageShowDesc],
});

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
  head.append(el('h1', '', S.writingTour), el('div', 'label', label));
  frag.append(head);

  const stages = el('div', 'stages');
  const STAGE_TEXT = stageText();
  for (const n of STAGES) {
    const [title, body] = STAGE_TEXT[n];
    const card = el('div', `stage ${s.stages[n]}`);
    const t = el('div', 'stage-title');
    t.append(el('span', '', title));
    if (s.stages[n] === 'done') t.append(el('span', 'mark', '✓'));
    if (s.stages[n] === 'active') t.append(el('span', 'spinner'));
    card.append(t, el('p', '', body));
    if (n === 'check' && s.repairs > 0) card.append(el('p', 'repair', format(S.repairCount, s.repairs)));
    stages.append(card);
  }
  frag.append(stages);

  const reading = el('section');
  reading.append(el('h2', '', S.readingNow));
  const log = el('div', 'log');
  if (!s.reads.length) log.append(el('div', 'empty', S.waitingForLlm));
  for (const r of s.reads) {
    const row = el('div', 'row');
    row.append(el('span', 'time', r.time), el('span', 'tool', r.tool), el('span', 'path', r.path));
    if (r.tag) row.append(el('span', 'tag', r.tag.replace(/_/g, ' ')));
    log.append(row);
  }
  reading.append(log);
  frag.append(reading);

  const exp = el('section', 'export');
  exp.append(el('h2', '', S.exportDirectory));
  const ul = el('ul');
  for (const f of ['base/', 'head/', 'change.diff', 'commits.txt', 'lessons/']) ul.append(el('li', '', f));
  exp.append(ul, el('p', 'note', S.exportNote));
  frag.append(exp);

  const actions = el('div', 'actions');
  actions.append(button(S.cancel, 'cancel', true));
  if (canSkip) actions.append(button(S.skipToTour, 'skip'));
  frag.append(actions);

  root.replaceChildren(frag);
}

window.addEventListener('message', (ev) => {
  const m = ev.data;
  if (m?.type === 'state') render(String(m.label), !!m.canSkip, m.state as ProgressState);
});
vscode.postMessage({ type: 'ready' });
