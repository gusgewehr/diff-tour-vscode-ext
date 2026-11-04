import { el } from '../dom';
import { errorBox, register } from './index';
import { S } from '../../strings';

register('target', (block, ctx) => {
  if (block.kind !== 'target') throw new Error('not a target block');
  const d = ctx.data;
  if (d?.kind === 'error') return errorBox(d.message);
  const sec = el('section', 'block target');
  const head = el('div', 'target-head');
  head.append(el('span', 'ref', ctx.base), el('span', 'arrow', ' ← '), el('span', 'ref', ctx.head));
  sec.append(head);
  if (d?.kind !== 'target' || d.commits.length === 0) { sec.append(el('div', 'code-missing', S.noCommitList)); return sec; }
  for (const c of d.commits) {
    const r = el('div', 'commit');
    r.append(el('span', 'sha', c.sha), el('span', 'subject', c.subject));
    if (c.ai) r.append(el('span', 'badge ai', S.aiCoAuthor));
    sec.append(r);
  }
  return sec;
});

function stat(a: number | null, d: number | null, binary: boolean): HTMLElement {
  const s = el('span', 'fstat');
  if (a === null || d === null) { if (binary) s.textContent = S.binary; return s; }
  s.append(el('span', 'add', `+${a}`), document.createTextNode(' '), el('span', 'del', `−${d}`));
  return s;
}

register('files', (block, ctx) => {
  if (block.kind !== 'files') throw new Error('not a files block');
  const d = ctx.data;
  if (d?.kind === 'error') return errorBox(d.message);
  const sec = el('section', 'block files');
  const groups = d?.kind === 'files' && d.groups.length
    ? d.groups
    : [{ label: '', files: (block.files.roles ?? []).map((r) => ({ file: r.file, added: null, removed: null, note: r.note ?? r.role, at: 'head' as const })) }];
  // both counts null means binary only when git ran and other files have numbers
  const anyNum = groups.some((g) => g.files.some((f) => f.added !== null));
  for (const g of groups) {
    if (g.label) sec.append(el('div', 'files-group', g.label));
    for (const f of g.files) {
      const b = el('button', 'file-row');
      b.append(el('span', 'fname', f.file), stat(f.added, f.removed, anyNum));
      if (f.note) b.append(el('span', 'fnote', f.note));
      b.addEventListener('click', () => ctx.post({ type: 'openFile', file: f.file, line: 1, at: f.at }));
      sec.append(b);
    }
  }
  return sec;
});
