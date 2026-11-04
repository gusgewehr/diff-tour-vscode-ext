import type { Intent } from '../../../tour/messages';
import type { Block, Step } from '../../../tour/model';
import type { BlockData } from '../../../tour/enrich';
import { el } from '../dom';

export interface BlockCtx { index: number; step: Step; post(m: Intent): void; data?: BlockData | null; base: string; head: string }
export type BlockRenderer = (block: Block, ctx: BlockCtx) => HTMLElement;

const registry = new Map<string, BlockRenderer>();
export function register(kind: Block['kind'], fn: BlockRenderer): void { registry.set(kind, fn); }

function fallback(block: Block): HTMLElement {
  const d = el('div', 'block-fallback');
  d.append(el('strong', '', block.kind), document.createTextNode(' block: not shown in this version'));
  return d;
}

export function errorBox(message: string): HTMLElement { return el('div', 'block-fallback', message); }

export function renderBlock(block: Block, ctx: BlockCtx): HTMLElement {
  const fn = registry.get(block.kind);
  if (!fn) return fallback(block);
  try { return fn(block, ctx); } catch { return fallback(block); }
}
