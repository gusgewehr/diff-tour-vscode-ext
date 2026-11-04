declare function acquireVsCodeApi(): { postMessage(m: unknown): void };
const vscode = acquireVsCodeApi();
const root = document.getElementById('root')!;

interface N { label: string; kind: string; current: boolean; visited: boolean; tip: string }
interface Bar { paths: N[][]; active: boolean }

function span(cls: string, text = ''): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = cls; s.textContent = text;
  return s;
}

function render(b: Bar): void {
  const kids: Node[] = [span('label' + (b.active ? ' on' : ''), 'FLOW')];
  let cur: HTMLElement | undefined;
  b.paths.forEach((path, pi) => {
    if (pi) kids.push(span('sep'));
    path.forEach((n, ni) => {
      if (ni) kids.push(span('arrow', '→'));
      const c = document.createElement('button');
      c.className = `chip kind-${n.kind}` + (n.current ? ' current' : '') + (n.visited ? ' visited' : '');
      c.title = n.tip;
      if (n.current) { c.append(span('dot')); cur = c; }
      c.append(span('text', n.label));
      if (n.kind !== 'external') c.addEventListener('click', () => vscode.postMessage({ type: 'click', path: pi, node: ni }));
      kids.push(c);
    });
  });
  root.replaceChildren(...kids);
  cur?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
}

window.addEventListener('message', (e: MessageEvent) => {
  const m = e.data as { type?: string } & Partial<Bar>;
  if (m?.type === 'bar' && Array.isArray(m.paths)) render(m as Bar);
  else if (m?.type === 'clear') root.replaceChildren();
});
vscode.postMessage({ type: 'ready' });
