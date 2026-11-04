import { el, renderInline } from '../dom';
import { register } from './index';
import { format } from '../../../l10n';
import { S } from '../../strings';

register('quote', (block) => {
  if (block.kind !== 'quote') throw new Error('not a quote block');
  const [subject, ...rest] = block.quote.split('\n');
  const q = el('blockquote', 'block quote');
  q.append(el('div', 'quote-subject', subject));
  if (rest.length) q.append(el('div', 'quote-body', rest.join('\n')));
  return q;
});

register('list', (block, ctx) => {
  if (block.kind !== 'list') throw new Error('not a list block');
  const ul = el('ul', 'block list');
  for (const item of block.list) { const li = el('li'); li.append(renderInline(item, ctx.post)); ul.append(li); }
  return ul;
});

register('pre', (block) => {
  if (block.kind !== 'pre') throw new Error('not a pre block');
  return el('pre', 'block pre', block.pre);
});

register('table', (block, ctx) => {
  if (block.kind !== 'table') throw new Error('not a table block');
  const wrap = el('div', 'block table-wrap');
  const t = el('table', 'tour-table');
  const tr = el('tr');
  for (const h of block.table.head) tr.append(el('th', '', h));
  const thead = el('thead');
  thead.append(tr);
  t.append(thead);
  const tb = el('tbody');
  for (const r of block.table.rows) {
    const row = el('tr');
    for (const c of r) { const td = el('td'); td.append(renderInline(c, ctx.post)); row.append(td); }
    tb.append(row);
  }
  t.append(tb);
  wrap.append(t);
  return wrap;
});

register('rows', (block) => {
  if (block.kind !== 'rows') throw new Error('not a rows block');
  const r = block.rows;
  const d = el('div', 'block rows');
  const head = el('div', 'rows-head');
  const tag = el('span', 'badge tag', r.tag || S.exampleTag);
  if (!r.tag || r.tag === 'example') tag.title = S.exampleTagTitle;
  head.append(tag, el('span', 'rows-label', r.label));
  const added = new Set(r.added ?? []);
  const t = el('table', 'tour-table');
  const hr = el('tr');
  (r.head ?? []).forEach((h) => hr.append(el('th', added.has(h) ? 'added' : '', h)));
  const thead = el('thead');
  thead.append(hr);
  const tb = el('tbody');
  for (const row of r.data ?? []) {
    const tr = el('tr');
    row.forEach((c, i) => tr.append(el('td', added.has(r.head?.[i]) ? 'added' : '', c)));
    tb.append(tr);
  }
  t.append(thead, tb);
  d.append(head, t);
  return d;
});

register('schema', (block) => {
  if (block.kind !== 'schema') throw new Error('not a schema block');
  const s = block.schema;
  const d = el('div', 'block schema');
  const head = el('div', 'schema-head');
  head.append(el('span', 'badge', S.schema), el('span', 'schema-mig', format(S.migrations, s.migrations)));
  d.append(head);
  const focus = s.focus ?? [];
  const tables = s.tables?.length ? s.tables : [...new Set(focus.map((f) => f.split('.')[0]))];
  if (!tables.length) { d.append(el('div', 'code-missing', S.noTables)); return d; }
  const grid = el('div', 'schema-grid');
  for (const t of tables) {
    const card = el('div', 'schema-table');
    card.append(el('div', 'schema-name', t));
    for (const f of focus.filter((x) => x.startsWith(t + '.'))) card.append(el('div', 'schema-col focus', '+ ' + f.slice(t.length + 1)));
    grid.append(card);
  }
  d.append(grid);
  return d;
});
