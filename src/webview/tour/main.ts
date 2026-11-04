import type { Intent, RenderMsg } from '../../tour/messages';
import { el } from './dom';
import { renderBlock } from './blocks/index';
import './blocks/p';
import { keyAction } from './keys';

declare function acquireVsCodeApi(): { postMessage(m: unknown): void; setState(s: unknown): void };
const vscode = acquireVsCodeApi();
const post = (m: Intent) => vscode.postMessage(m);
const root = document.getElementById('root')!;

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
  doc.append(head, el('div', 'chapter', `${m.chapterTitle} · Step ${m.index + 1} / ${m.total}`), el('h2', 'step-title', m.step.title));
  m.step.blocks.forEach((b, i) => doc.append(renderBlock(b, { index: i, step: m.step, post })));

  noteVisible = m.note !== '';
  noteCard = el('section', 'note-card');
  noteCard.hidden = !noteVisible;
  noteArea = document.createElement('textarea');
  noteArea.value = m.note;
  noteArea.setAttribute('aria-label', 'My note');
  noteArea.addEventListener('input', () => post({ type: 'note', text: noteArea!.value }));
  noteCard.append(el('div', 'note-label', 'MY NOTE'), el('div', 'note-hint', 'Private. Kept in VS Code, never in the repository.'), noteArea);
  doc.append(noteCard);
  window.scrollTo(0, 0);
}

function btn(text: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', cls, text) as HTMLButtonElement;
  b.addEventListener('click', onClick);
  return b;
}

function buildBar(m: RenderMsg): void {
  const prev = btn(m.prevTitle !== undefined ? `← ${m.index} · ${m.prevTitle}` : '← Prev', 'secondary nav-prev', () => post({ type: 'prev' }));
  prev.disabled = m.prevTitle === undefined;
  const ticks = el('div', 'ticks');
  m.ticks.forEach((t, i) => {
    const b = btn('', `tick ${t.state}`, () => post({ type: 'goto', index: i }));
    b.setAttribute('aria-label', `Go to step ${i + 1} (${t.state})`);
    if (t.state === 'current') b.setAttribute('aria-current', 'step');
    ticks.append(b);
  });
  const u = btn(m.understood ? 'Understood ✓ (U)' : 'Mark as understood (U)', 'secondary', () => post({ type: 'understood' }));
  u.setAttribute('aria-pressed', String(m.understood));
  const note = btn('Note (N)', 'secondary', toggleNote);
  const next = btn(m.nextTitle !== undefined ? `${m.index + 2} · ${m.nextTitle} →` : 'Next →', 'nav-next', () => post({ type: 'next' }));
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
