import type { Intent } from '../../tour/messages';
import { tokenize } from './inline';

export function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function renderInline(text: string, post: (m: Intent) => void): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const t of tokenize(text)) {
    if (t.t === 'text') frag.append(document.createTextNode(t.v));
    else if (t.t === 'code') frag.append(el('code', '', t.v));
    else if (t.t === 'bold') frag.append(el('strong', '', t.v));
    else {
      const a = el('a', 'file-link', t.v) as HTMLAnchorElement;
      a.href = '#';
      a.title = 'Open file';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        post({ type: 'openFile', file: t.file, line: t.line, ...(t.end !== undefined ? { end: t.end } : {}) });
      });
      frag.append(a);
    }
  }
  return frag;
}
