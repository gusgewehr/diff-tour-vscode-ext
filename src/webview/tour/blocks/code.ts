import type { Row } from '../../../tour/align';
import type { CodeData } from '../../../tour/enrich';
import { el } from '../dom';
import { format } from '../../../l10n';
import { S } from '../../strings';
import { errorBox, register, type BlockCtx } from './index';

function cell(c: Row['left']): HTMLElement {
  if (!c) return el('div', 'cell empty');
  const d = el('div', `cell ${c.kind}`);
  d.append(el('span', 'ln', String(c.n)), el('span', 'sg', c.kind === 'del' ? '−' : c.kind === 'add' ? '+' : ''), el('span', 'lt', c.text));
  return d;
}

// A tour annotation, styled as a callout so it never reads as code.
function callout(text: string, cls = ''): HTMLElement {
  const box = el('div', 'callout' + (cls ? ' ' + cls : ''));
  box.title = S.annotationTitle;
  box.append(el('span', 'callout-label', S.annotation), el('span', 'callout-text', text));
  return box;
}

function build(d: CodeData, ctx: BlockCtx, note?: string): HTMLElement {
  const sec = el('section', 'block code');
  const head = el('div', 'code-head');
  const i = d.file.lastIndexOf('/');
  head.append(el('span', 'code-file', d.file.slice(i + 1)), el('span', 'code-dir', i >= 0 ? d.file.slice(0, i) : ''));
  if (d.lines) head.append(el('span', 'code-lines', d.lines[0] === d.lines[1] ? `L ${d.lines[0]}` : `L ${d.lines[0]}–${d.lines[1]}`));
  if (!d.missing) {
    head.append(el('span', 'code-stat', d.newFile ? S.newFile : d.deleted ? S.deleted : d.unchanged ? S.noChange : format(S.addedRemoved, d.added, d.removed)));
  }
  if (d.approximate) {
    const b = el('span', 'badge approx', S.approximate);
    b.title = S.approximateTitle;
    head.append(b);
  }
  const open = el('button', 'icon', S.open);
  open.setAttribute('aria-label', S.openDiff);
  open.title = S.openDiff;
  open.addEventListener('click', () => ctx.post({ type: 'openCode', block: ctx.index }));
  head.append(open);
  sec.append(head);
  if (note) sec.append(callout(note, 'block-note'));
  if (d.missing) { sec.append(el('div', 'code-missing', d.missing)); return sec; }

  const cols = d.newFile ? '64px 1fr' : d.deleted ? '1fr 64px' : '1fr 1fr';
  const colRow = el('div', 'code-cols');
  colRow.style.gridTemplateColumns = cols;
  colRow.append(
    el('div', 'col-before', format(S.beforeAt, ctx.base) + (d.newFile ? S.fileDidNotExist : '')),
    el('div', 'col-after', format(S.afterAt, ctx.head) + (d.deleted ? S.fileWasDeleted : '')),
  );
  sec.append(colRow);

  const body = el('div', 'code-body');
  d.sections.forEach((rows, si) => {
    if (si > 0) body.append(el('div', 'code-gap', '⋯'));
    for (const r of rows) {
      const row = el('div', r.focus ? 'code-row focus' : 'code-row');
      row.style.gridTemplateColumns = cols;
      row.append(cell(r.left), cell(r.right));
      body.append(row);
      for (const m of r.marks) {
        const mr = el('div', 'code-row mark-row');
        mr.style.gridTemplateColumns = cols;
        const text = el('div', 'mark-cell');
        text.append(callout(m.text));
        const spacer = el('div', 'mark-cell');
        mr.append(...(m.side === 'left' ? [text, spacer] : [spacer, text]));
        body.append(mr);
      }
    }
  });
  sec.append(body);
  return sec;
}

register('code', (block, ctx) => {
  if (block.kind !== 'code' && block.kind !== 'diff') throw new Error('not a code block');
  const data = ctx.data;
  if (data?.kind === 'error') return errorBox(data.message);
  if (data?.kind !== 'code') return el('div', 'block-fallback', S.codeNotLoaded);
  return build(data, ctx, block.kind === 'code' ? block.code.note : undefined);
});
register('diff', (block, ctx) => {
  if (block.kind !== 'diff') throw new Error('not a diff block');
  const data = ctx.data;
  if (data?.kind === 'error') return errorBox(data.message);
  if (data?.kind !== 'code') return el('div', 'block-fallback', S.codeNotLoaded);
  return build(data, ctx);
});
