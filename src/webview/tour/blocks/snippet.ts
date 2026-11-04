import { el } from '../dom';
import { register } from './index';

const WARN = 'Not in this repository';

register('snippet', (block, ctx) => {
  if (block.kind !== 'snippet') throw new Error('not a snippet block');
  const s = block.snippet;
  const d = el('div', 'block snippet');
  const head = el('div', 'snippet-head');
  head.append(el('span', 'badge example', 'EXAMPLE'), el('span', 'snippet-label', s.label.startsWith(WARN) ? s.label : `${WARN}: ${s.label}`));
  if (s.lang) head.append(el('span', 'badge lang', s.lang));
  const copy = el('button', 'secondary', 'Copy');
  copy.addEventListener('click', () => {
    ctx.post({ type: 'copy', text: s.text });
    copy.textContent = 'Copied';
    setTimeout(() => { copy.textContent = 'Copy'; }, 1500);
  });
  head.append(copy);
  d.append(head, el('pre', 'snippet-text', s.text));
  return d;
});
