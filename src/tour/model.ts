import * as crypto from 'node:crypto';
import * as path from 'node:path';

export type At = 'base' | 'head';
export type Basis = 'fact' | 'inferred' | 'opinion' | '';
export const KINDS = ['p', 'quote', 'list', 'pre', 'table', 'code', 'diff', 'snippet', 'schema', 'rows', 'flow', 'timeline', 'files', 'target'] as const;

export interface Location { file: string; line: number; at?: At }
export interface Mark { line: number; text: string }
export interface CodeRef { file: string; at?: At; lines: [number, number]; show?: [number, number]; note?: string; marks?: Mark[] }
export interface FlowNode { label: string; kind?: string; note?: string; next?: number[]; start?: boolean; file?: string; lines?: [number, number] }
export interface Flow { nodes: FlowNode[] }
export interface TimelineEvent { lane: string; to?: string; text: string; mark?: string }
export interface Timeline { lanes: string[]; events: TimelineEvent[] }
export interface FileRole { file: string; role: string; note?: string }
export interface FileMap { roles?: FileRole[] }
export interface DiffRef { file: string; hunks?: number[] }
export interface Snippet { label: string; lang?: string; text: string }
export interface SchemaRef { migrations: string[]; tables?: string[]; focus?: string }
export interface Rows { tag?: string; label: string; head: string; data: string[][]; added?: boolean }
export interface Table { head: string[]; rows: string[][] }

export type Block =
  | { kind: 'p'; p: string; basis?: Basis } | { kind: 'quote'; quote: string } | { kind: 'list'; list: string[] }
  | { kind: 'pre'; pre: string } | { kind: 'table'; table: Table } | { kind: 'code'; code: CodeRef }
  | { kind: 'diff'; diff: DiffRef } | { kind: 'snippet'; snippet: Snippet } | { kind: 'schema'; schema: SchemaRef }
  | { kind: 'rows'; rows: Rows } | { kind: 'flow'; flow: Flow } | { kind: 'timeline'; timeline: Timeline }
  | { kind: 'files'; files: FileMap } | { kind: 'target'; target: true } | { kind: 'unknown'; raw: unknown };
export interface Step { title: string; question?: boolean; asks?: string[]; asked?: string; open?: Location; blocks: Block[] }
export interface Chapter { title: string; steps: Step[] }
export interface Tour { version: 1; title: string; base: string; head: string; chapters: Chapter[] }
export interface FlatStep { chapterIndex: number; stepIndex: number; globalIndex: number; chapterTitle: string; step: Step }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

function normBlock(raw: unknown): Block {
  if (isObj(raw)) {
    const k = KINDS.find((x) => raw[x] !== undefined && raw[x] !== null && raw[x] !== false);
    if (k) return { kind: k, ...raw } as unknown as Block;
  }
  return { kind: 'unknown', raw };
}

function normStep(raw: unknown): Step {
  if (!isObj(raw) || typeof raw.title !== 'string') throw new Error('Invalid tour: step without a title');
  const s: Step = { title: raw.title, blocks: Array.isArray(raw.blocks) ? raw.blocks.map(normBlock) : [] };
  if (typeof raw.question === 'boolean') s.question = raw.question;
  if (Array.isArray(raw.asks)) s.asks = raw.asks.filter((x): x is string => typeof x === 'string');
  if (typeof raw.asked === 'string') s.asked = raw.asked;
  const o = raw.open;
  if (isObj(o) && typeof o.file === 'string' && typeof o.line === 'number') {
    s.open = { file: o.file, line: o.line, ...(o.at === 'base' || o.at === 'head' ? { at: o.at } : {}) };
  }
  return s;
}

export function loadTour(text: string): Tour {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('Not a tour file: invalid JSON'); }
  if (!isObj(raw)) throw new Error('Not a tour file: expected an object');
  if (raw.version !== 1) throw new Error(`Unsupported tour version: ${String(raw.version)}`);
  if (!Array.isArray(raw.chapters)) throw new Error('Invalid tour: chapters is not an array');
  let n = 0;
  const chapters = raw.chapters.map((c): Chapter => {
    if (!isObj(c) || !Array.isArray(c.steps)) throw new Error('Invalid tour: chapter without steps');
    const steps = c.steps.map(normStep);
    n += steps.length;
    return { title: str(c.title), steps };
  });
  if (n === 0) throw new Error('Tour has no steps');
  return { version: 1, title: str(raw.title), base: str(raw.base), head: str(raw.head), chapters };
}

export function flatten(tour: Tour): FlatStep[] {
  const out: FlatStep[] = [];
  tour.chapters.forEach((c, chapterIndex) => c.steps.forEach((step, stepIndex) =>
    out.push({ chapterIndex, stepIndex, globalIndex: out.length, chapterTitle: c.title, step })));
  return out;
}

export function metaPathFor(p: string): string {
  return path.join(path.dirname(p), path.basename(p).replace(/\.json$/, '') + '.meta.json');
}

export function fileTourId(abs: string): string {
  return 'file-' + crypto.createHash('sha1').update(path.resolve(abs)).digest('hex');
}
