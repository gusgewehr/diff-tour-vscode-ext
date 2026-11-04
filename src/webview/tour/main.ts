import type { Intent, RenderMsg } from '../../tour/messages';
import { el } from './dom';
import { renderBlock } from './blocks/index';
import './blocks/p';
import './blocks/text';
import './blocks/diagrams';
import './blocks/snippet';
import './blocks/code';
import './blocks/repo';
import { keyAction } from './keys';
import { format } from '../../l10n';
import { S, applyStrings } from '../strings';

declare function acquireVsCodeApi(): { postMessage(m: unknown): void; setState(s: unknown): void };
const vscode = acquireVsCodeApi();
const post = (m: Intent) => vscode.postMessage(m);
const root = document.getElementById('root')!;
applyStrings(root.dataset.strings);

const doc = el('main', 'doc');
const bar = el('nav', 'bar');
root.append(doc, bar);

let lastKey = '';
let noteVisible = false;
let noteArea: HTMLTextAreaElement | undefined;
let noteCard: HTMLElement | undefined;

function toggleNote(): void {
  if (!noteCard || !noteArea) return;
  if (noteVisible && document.activeElement !== noteArea) { noteArea.focus(); return; }
  if (noteVisible && noteArea.value === '') { noteVisible = false; noteCard.hidden = true; return; }
  noteVisible = true; noteCard.hidden = false; noteArea.focus();
}

function buildContent(m: RenderMsg): void {
  doc.replaceChildren();
  const head = el('header');
  head.append(el('h1', 'tour-title', m.title), el('div', 'refs', `${m.base} → ${m.head}`));
  doc.append(head, el('div', 'chapter', `${m.chapterTitle} · ${format(S.stepOf, m.index + 1, m.total)}`), el('h2', 'step-title', m.step.title));
  if (m.step.question) {
    const q = el('section', 'question-card');
    const ta = document.createElement('textarea');
    ta.value = m.guess;
    ta.setAttribute('aria-label', S.yourGuess);
    ta.placeholder = S.guessPlaceholder;
    ta.addEventListener('input', () => post({ type: 'guess', text: ta.value }));
    const show = el('button', '', S.showAnswer) as HTMLButtonElement;
    show.disabled = m.nextTitle === undefined;
    show.addEventListener('click', () => post({ type: 'next' }));
    q.append(el('div', 'q-label', S.stopAndPredictLabel), el('div', 'q-title', S.stopAndPredictTitle), ta, show);
    doc.append(q);
  } else if (m.previousGuess !== undefined) {
    const g = el('section', 'guess-card');
    g.append(el('div', 'q-label', S.yourGuessLabel), m.previousGuess ? el('div', 'guess-text', m.previousGuess) : el('div', 'guess-text none', S.noGuess));
    doc.append(g);
  }
  m.step.blocks.forEach((b, i) => doc.append(renderBlock(b, { index: i, step: m.step, post, data: m.blockData?.[i] ?? null, base: m.base, head: m.head })));

  noteVisible = m.note !== '';
  noteCard = el('section', 'note-card');
  noteCard.hidden = !noteVisible;
  noteArea = document.createElement('textarea');
  noteArea.value = m.note;
  noteArea.setAttribute('aria-label', S.myNote);
  noteArea.addEventListener('input', () => post({ type: 'note', text: noteArea!.value }));
  noteCard.append(el('div', 'note-label', S.myNoteLabel), el('div', 'note-hint', S.noteHint), noteArea);
  doc.append(noteCard);
  window.scrollTo(0, 0);
}

function btn(text: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', cls, text) as HTMLButtonElement;
  b.addEventListener('click', onClick);
  return b;
}

function buildBar(m: RenderMsg): void {
  const prev = btn(m.prevTitle !== undefined ? `← ${m.index} · ${m.prevTitle}` : S.prev, 'secondary nav-prev', () => post({ type: 'prev' }));
  prev.disabled = m.prevTitle === undefined;
  const ticks = el('div', 'ticks');
  m.ticks.forEach((t, i) => {
    const b = btn('', `tick ${t.state}`, () => post({ type: 'goto', index: i }));
    b.setAttribute('aria-label', format(S.gotoStep, i + 1, t.state));
    if (t.state === 'current') b.setAttribute('aria-current', 'step');
    ticks.append(b);
  });
  const u = btn(m.understood ? S.understood : S.markUnderstood, 'secondary', () => post({ type: 'understood' }));
  u.setAttribute('aria-pressed', String(m.understood));
  const note = btn(S.note, 'secondary', toggleNote);
  const next = btn(m.nextTitle !== undefined ? `${m.index + 2} · ${m.nextTitle} →` : S.next, 'nav-next', () => post({ type: 'next' }));
  next.disabled = m.nextTitle === undefined;
  bar.replaceChildren(prev, ticks, u, note, next);
}

window.addEventListener('message', (e) => {
  const m = e.data as RenderMsg;
  if (!m || m.type !== 'render') return;
  vscode.setState(m.restore);
  const key = `${m.restore.id}:${m.index}`;
  if (key !== lastKey) { lastKey = key; buildContent(m); }
  buildBar(m);
});

document.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement | null;
  const typing = !!t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable);
  const a = keyAction(e.key, { typing, mod: e.ctrlKey || e.metaKey || e.altKey });
  if (!a) return;
  e.preventDefault();
  if (a === 'prev') post({ type: 'prev' });
  else if (a === 'next') post({ type: 'next' });
  else if (a === 'understood') post({ type: 'understood' });
  else if (a === 'open') post({ type: 'openCode' });
  else if (a === 'note') toggleNote();
  else (document.activeElement as HTMLElement | null)?.blur();
});

post({ type: 'ready' });
