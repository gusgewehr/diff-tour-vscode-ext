import { el, renderInline } from '../dom';
import { register } from './index';
import { S } from '../../strings';

const label = (b: string): string | undefined => ({ fact: S.basisFact, inferred: S.basisInferred, opinion: S.basisOpinion } as Record<string, string>)[b];

register('p', (block, ctx) => {
  if (block.kind !== 'p') throw new Error('not a p block');
  const d = el('div', 'block p');
  const gutter = el('div', 'gutter');
  const text = block.basis ? label(block.basis) : undefined;
  if (text) gutter.append(el('span', `basis basis-${block.basis}`, text));
  const p = el('p');
  p.append(renderInline(block.p, ctx.post));
  d.append(gutter, p);
  return d;
});
