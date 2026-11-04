import { el, renderInline } from '../dom';
import { register } from './index';

const LABEL: Record<string, string> = { fact: 'Verified', inferred: 'From the code', opinion: 'Senior view' };

register('p', (block, ctx) => {
  if (block.kind !== 'p') throw new Error('not a p block');
  const d = el('div', 'block p');
  const gutter = el('div', 'gutter');
  const label = block.basis ? LABEL[block.basis] : undefined;
  if (label) gutter.append(el('span', `basis basis-${block.basis}`, label));
  const p = el('p');
  p.append(renderInline(block.p, ctx.post));
  d.append(gutter, p);
  return d;
});
