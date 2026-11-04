import type { At, Step } from './model';
import type { BlockData } from './enrich';
import type { TourSession } from './session';

export type Intent =
  | { type: 'ready' } | { type: 'next' } | { type: 'prev' } | { type: 'goto'; index: number } | { type: 'understood' }
  | { type: 'note'; text: string } | { type: 'guess'; text: string } | { type: 'openCode'; block?: number }
  | { type: 'openFile'; file: string; line: number; end?: number; at?: At } | { type: 'copy'; text: string };

const MAX_TEXT = 20000;
const nat = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

export function parseIntent(m: unknown): Intent | undefined {
  if (typeof m !== 'object' || m === null) return undefined;
  const o = m as Record<string, unknown>;
  switch (o.type) {
    case 'ready': case 'next': case 'prev': case 'understood': return { type: o.type };
    case 'goto': return nat(o.index) ? { type: 'goto', index: o.index } : undefined;
    case 'note': case 'guess':
      return typeof o.text === 'string' && o.text.length <= MAX_TEXT ? { type: o.type, text: o.text } : undefined;
    case 'copy':
      return typeof o.text === 'string' && o.text.length >= 1 && o.text.length <= 100000 ? { type: 'copy', text: o.text } : undefined;
    case 'openCode':
      if (o.block === undefined) return { type: 'openCode' };
      return nat(o.block) ? { type: 'openCode', block: o.block } : undefined;
    case 'openFile': {
      if (typeof o.file !== 'string' || !o.file || o.file.length > 1024 || o.file.includes('\0')) return undefined;
      if (!nat(o.line) || o.line < 1) return undefined;
      if (o.end !== undefined && (!nat(o.end) || o.end < o.line)) return undefined;
      if (o.at !== undefined && o.at !== 'base' && o.at !== 'head') return undefined;
      const r: Intent = { type: 'openFile', file: o.file, line: o.line };
      if (o.end !== undefined) r.end = o.end as number;
      if (o.at !== undefined) r.at = o.at as At;
      return r;
    }
  }
  return undefined;
}

export type TickState = 'current' | 'understood' | 'visited' | 'unvisited';
export interface RenderMsg {
  type: 'render'; title: string; base: string; head: string; chapterTitle: string; index: number; total: number; step: Step;
  ticks: { state: TickState }[]; understood: boolean; note: string; guess: string; prevTitle?: string; nextTitle?: string;
  restore: { id: string; path: string }; blockData: (BlockData | null)[]; previousGuess?: string;
}

export function renderMessage(s: TourSession, blockData: (BlockData | null)[] = []): RenderMsg {
  const st = s.state;
  const i = s.index;
  const r: RenderMsg = {
    type: 'render', title: s.tour.title, base: s.tour.base, head: s.tour.head, chapterTitle: s.current.chapterTitle,
    index: i, total: s.steps.length, step: s.current.step,
    ticks: s.steps.map((_, k) => ({ state: k === i ? 'current' : st.done[k] ? 'understood' : st.visited[k] ? 'visited' : 'unvisited' })),
    understood: !!st.done[i], note: st.notes[i] ?? '', guess: st.guesses[i] ?? '',
    prevTitle: s.steps[i - 1]?.step.title, nextTitle: s.steps[i + 1]?.step.title,
    restore: { id: s.id, path: s.path }, blockData,
  };
  if (s.steps[i - 1]?.step.question) r.previousGuess = st.guesses[i - 1] ?? '';
  return r;
}

export interface CodeTarget { file: string; at: At; lines: [number, number] }

export function codeTargetForBlock(step: Step, block: number): CodeTarget | undefined {
  const b = step.blocks[block];
  if (b?.kind === 'diff') { const h = b.diff.hunks?.[0] ?? 1; return { file: b.diff.file, at: 'head', lines: [h, h] }; }
  if (!b || b.kind !== 'code') return undefined;
  return { file: b.code.file, at: b.code.at || 'head', lines: b.code.lines };
}

export function primaryCode(step: Step): CodeTarget | undefined {
  if (step.open) return { file: step.open.file, at: step.open.at || 'head', lines: [step.open.line, step.open.line] };
  const i = step.blocks.findIndex((b) => b.kind === 'code' || b.kind === 'diff');
  return i < 0 ? undefined : codeTargetForBlock(step, i);
}
