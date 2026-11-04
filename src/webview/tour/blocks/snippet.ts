import { el } from '../dom';
import { register } from './index';
import { EN, S } from '../../strings';

register('snippet', (block, ctx) => {
  if (block.kind !== 'snippet') throw new Error('not a snippet block');
  const s = block.snippet;
  const d = el('div', 'block snippet');
  const head = el('div', 'snippet-head');
  head.append(el('span', 'badge example', S.example), el('span', 'snippet-label', s.label.startsWith(EN.notInRepo) || s.label.startsWith(S.notInRepo) ? s.label : `${S.notInRepo}: ${s.label}`));
  if (s.lang) head.append(el('span', 'badge lang', s.lang));
  const copy = el('button', 'secondary', S.copy);
  copy.addEventListener('click', () => {
    ctx.post({ type: 'copy', text: s.text });
    copy.textContent = S.copied;
    setTimeout(() => { copy.textContent = S.copy; }, 1500);
  });
  head.append(copy);
  d.append(head, el('pre', 'snippet-text', s.text));
  return d;
});
