import type { Row } from '../../../tour/align';
import type { CodeData } from '../../../tour/enrich';
import { el } from '../dom';
import { errorBox, register, type BlockCtx } from './index';

function cell(c: Row['left']): HTMLElement {
  if (!c) return el('div', 'cell empty');
  const d = el('div', `cell ${c.kind}`);
  d.append(el('span', 'ln', String(c.n)), el('span', 'lt', c.text));
  return d;
}

function build(d: CodeData, ctx: BlockCtx, note?: string): HTMLElement {
  const sec = el('section', 'block code');
  const head = el('div', 'code-head');
  const i = d.file.lastIndexOf('/');
  head.append(el('span', 'code-file', d.file.slice(i + 1)), el('span', 'code-dir', i >= 0 ? d.file.slice(0, i) : ''));
  if (d.lines) head.append(el('span', 'code-lines', d.lines[0] === d.lines[1] ? `L ${d.lines[0]}` : `L ${d.lines[0]}–${d.lines[1]}`));
  if (!d.missing) {
    head.append(el('span', 'code-stat', d.newFile ? 'new file' : d.deleted ? 'deleted' : d.unchanged ? 'no change in these lines' : `+${d.added} −${d.removed} here`));
  }
  if (d.approximate) {
    const b = el('span', 'badge approx', 'approximate');
    b.title = 'The tour referenced lines that do not exist at this commit; shown clamped';
    head.append(b);
  }
  if (note) head.append(el('span', 'code-note', note));
  const open = el('button', 'icon', 'open ↗');
  open.setAttribute('aria-label', 'Open read-only diff');
  open.title = 'Open read-only diff';
  open.addEventListener('click', () => ctx.post({ type: 'openCode', block: ctx.index }));
  head.append(open);
  sec.append(head);
  if (d.missing) { sec.append(el('div', 'code-missing', d.missing)); return sec; }

  const cols = d.newFile ? '64px 1fr' : d.deleted ? '1fr 64px' : '1fr 1fr';
  const colRow = el('div', 'code-cols');
  colRow.style.gridTemplateColumns = cols;
  colRow.append(
    el('div', 'col-before', `↶ BEFORE · ${ctx.base}${d.newFile ? ' · this file did not exist' : ''}`),
    el('div', 'col-after', `AFTER · ${ctx.head}${d.deleted ? ' · this file was deleted' : ''}`),
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
        const text = el('div', 'cell');
        text.append(el('span', 'mark-text', '└ ' + m.text));
        const spacer = el('div', 'cell');
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
  if (data?.kind !== 'code') return el('div', 'block-fallback', 'Code not loaded');
  return build(data, ctx, block.kind === 'code' ? block.code.note : undefined);
});
register('diff', (block, ctx) => {
  if (block.kind !== 'diff') throw new Error('not a diff block');
  const data = ctx.data;
  if (data?.kind === 'error') return errorBox(data.message);
  if (data?.kind !== 'code') return el('div', 'block-fallback', 'Code not loaded');
  return build(data, ctx);
});
