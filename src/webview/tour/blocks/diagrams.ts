import { el } from '../dom';
import { register } from './index';
import { format } from '../../../l10n';
import { S } from '../../strings';

register('timeline', (block) => {
  if (block.kind !== 'timeline') throw new Error('not a timeline block');
  const { lanes, events } = block.timeline;
  const d = el('div', 'block timeline');
  d.style.gridTemplateColumns = `repeat(${Math.max(lanes.length, 1)}, minmax(0, 1fr))`;
  lanes.forEach((l, k) => { const h = el('div', 'lane-head', l); h.style.gridRow = '1'; h.style.gridColumn = String(k + 1); d.append(h); });
  events.forEach((e, n) => {
    const li = Math.max(lanes.indexOf(e.lane), 0);
    const ti = e.to ? lanes.indexOf(e.to) : -1;
    const cls = e.mark ? ` mark-${e.mark}` : '';
    if (ti < 0 || ti === li) {
      const ev = el('div', `tl-event${cls}`, '● ' + e.text);
      ev.style.gridRow = String(n + 2); ev.style.gridColumn = String(li + 1);
      d.append(ev);
      return;
    }
    const msg = el('div', `tl-msg${cls}`);
    msg.style.gridRow = String(n + 2);
    msg.style.gridColumn = `${Math.min(li, ti) + 1} / ${Math.max(li, ti) + 2}`;
    msg.append(el('div', 'tl-text', e.text), el('div', 'tl-arrow', ti > li ? '→' : '←'));
    msg.classList.add(ti > li ? 'to-right' : 'to-left');
    d.append(msg);
  });
  return d;
});

register('flow', (block, ctx) => {
  if (block.kind !== 'flow') throw new Error('not a flow block');
  const nodes = block.flow.nodes;
  const data = ctx.data?.kind === 'flow' ? ctx.data : undefined;
  let paths = data?.paths;
  if (!paths) {
    paths = [];
    nodes.forEach((n, i) => { if (!paths!.length || (n.start && paths![paths!.length - 1].length)) paths!.push([]); paths![paths!.length - 1].push(i); });
  }
  const d = el('div', 'block flow');
  d.style.gridTemplateColumns = paths.length <= 3 ? `repeat(${Math.max(paths.length, 1)}, minmax(0, 1fr))` : 'repeat(auto-fill, minmax(220px, 1fr))';
  for (const path of paths) {
    const col = el('div', 'flow-path');
    path.forEach((ni, k) => {
      const n = nodes[ni];
      if (!n) return;
      if (k > 0) {
        const prev = nodes[path[k - 1]];
        const a = el('div', 'flow-arrow', '↓');
        if (prev?.next) a.append(el('span', 'flow-next', ' ' + prev.next));
        col.append(a);
      }
      const kind = n.kind || 'same';
      const card = el('div', `flow-node kind-${kind}`);
      card.append(el('span', 'badge', kind), el('div', 'flow-label', n.label));
      if (n.note) card.append(el('div', 'flow-note', n.note));
      const t = data?.nodes[ni];
      if (t) {
        for (const s of t.steps) {
          const c = el('button', 'secondary chip', format(S.codeInStep, s + 1));
          c.addEventListener('click', () => ctx.post({ type: 'goto', index: s }));
          card.append(c);
        }
        if (!t.steps.length && t.file) {
          const a = el('a', 'file-link', S.openFileLower) as HTMLAnchorElement;
          a.href = '#';
          const file = t.file;
          a.addEventListener('click', (e) => {
            e.preventDefault();
            ctx.post({ type: 'openFile', file, line: t.line ?? 1, ...(t.end !== undefined ? { end: t.end } : {}), at: 'head' });
          });
          card.append(a);
        }
      }
      col.append(card);
    });
    d.append(col);
  }
  return d;
});
