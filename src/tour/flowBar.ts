import type { Step } from './model';
import { flowPaths, nodeTargets, stepFiles } from './flow';

export type BarKind = 'new' | 'changed' | 'same' | 'external';
export interface BarNode {
  label: string; kind: BarKind; file?: string; line?: number; end?: number;
  steps: number[]; current: boolean; visited: boolean; tip: string;
}
export interface BarState { paths: BarNode[][]; active: boolean }
export type Click = { goto: number } | { open: { file: string; lines: [number, number] } } | undefined;

const KINDS = ['new', 'changed', 'same', 'external'];

export function buildBar(steps: Step[], current: number, visited: Record<number, boolean>): BarState {
  const here = steps[current] ? stepFiles(steps[current]) : [];
  const paths: BarNode[][] = [];
  const seen = new Set<string>();
  let currentTaken = false;
  for (const s of steps) {
    for (const b of s.blocks) {
      if (b.kind !== 'flow') continue;
      const nodes = b.flow.nodes;
      const targets = nodeTargets(nodes, steps);
      for (const idxs of flowPaths(nodes)) {
        const out: BarNode[] = [];
        for (const i of idxs) {
          const n = nodes[i]; const t = targets[i];
          const prev = out[out.length - 1];
          if (prev && prev.label === n.label && prev.file === t.file) continue;
          const kind = (KINDS.includes(n.kind ?? '') ? n.kind : 'same') as BarKind;
          const isCur = !currentTaken && !!t.file && here.includes(t.file);
          if (isCur) currentTaken = true;
          const none = kind === 'external' || !t.steps.length;
          const node: BarNode = {
            label: n.label, kind, steps: t.steps, current: isCur,
            visited: t.steps.some((k) => visited[k]),
            tip: n.label + (isCur ? '\nyou are here' : '') +
              (kind === 'external' ? '\nexternal' : none ? '\nno step shows this file' : '\ncode in steps ' + t.steps.map((k) => k + 1).join(', ')),
          };
          if (t.file) node.file = t.file;
          if (t.line !== undefined) node.line = t.line;
          if (t.end !== undefined) node.end = t.end;
          out.push(node);
        }
        const sig = out.map((n) => n.label + '|' + (n.file ?? '')).join('>');
        if (!out.length || seen.has(sig)) { if (out.some((n) => n.current)) currentTaken = false; continue; }
        seen.add(sig);
        paths.push(out);
      }
    }
  }
  return { paths, active: paths.some((p) => p.some((n) => n.current)) };
}

export function resolveClick(node: BarNode, current: number): Click {
  if (node.kind === 'external') return undefined;
  const next = node.steps.find((i) => i > current);
  if (next !== undefined) return { goto: next };
  if (node.file) return { open: { file: node.file, lines: [node.line ?? 1, node.end ?? node.line ?? 1] } };
  return undefined;
}
