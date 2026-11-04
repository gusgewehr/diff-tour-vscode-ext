import type { FlowNode, Step } from './model';

export interface NodeTarget { steps: number[]; file?: string; line?: number; end?: number }

export function flowPaths(nodes: FlowNode[]): number[][] {
  const paths: number[][] = [];
  nodes.forEach((n, i) => {
    if (!paths.length || (n.start && paths[paths.length - 1].length)) paths.push([]);
    paths[paths.length - 1].push(i);
  });
  return paths;
}

export function stepFiles(step: Step): string[] {
  const out: string[] = [];
  for (const b of step.blocks) {
    const f = b.kind === 'code' ? b.code.file : b.kind === 'diff' ? b.diff.file : undefined;
    if (f && !out.includes(f)) out.push(f);
  }
  return out;
}

export function nodeTargets(nodes: FlowNode[], steps: Step[]): NodeTarget[] {
  const per = steps.map(stepFiles);
  const all = [...new Set(per.flat())];
  const base = (f: string) => f.slice(f.lastIndexOf('/') + 1).toLowerCase();
  return nodes.map((n) => {
    if (n.kind === 'external') return { steps: [] };
    let file = n.file;
    if (!file) {
      for (const text of [n.label, n.note]) {
        const t = (text ?? '').toLowerCase();
        file = all.find((f) => t.includes(base(f)));
        if (file) break;
      }
    }
    const t: NodeTarget = { steps: file ? per.flatMap((fs, i) => (fs.includes(file as string) ? [i] : [])) : [] };
    if (file) t.file = file;
    if (n.lines) { t.line = n.lines[0]; t.end = n.lines[1]; }
    return t;
  });
}
