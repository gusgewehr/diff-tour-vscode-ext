import type { Intent } from '../../../tour/messages';
import type { Block, Step } from '../../../tour/model';
import { el } from '../dom';

export interface BlockCtx { index: number; step: Step; post(m: Intent): void }
export type BlockRenderer = (block: Block, ctx: BlockCtx) => HTMLElement;

const registry = new Map<string, BlockRenderer>();
export function register(kind: Block['kind'], fn: BlockRenderer): void { registry.set(kind, fn); }

function fallback(block: Block): HTMLElement {
  const d = el('div', 'block-fallback');
  d.append(el('strong', '', block.kind), document.createTextNode(' block: rendered in a later update'));
  return d;
}

export function renderBlock(block: Block, ctx: BlockCtx): HTMLElement {
  const fn = registry.get(block.kind);
  if (!fn) return fallback(block);
  try { return fn(block, ctx); } catch { return fallback(block); }
}
