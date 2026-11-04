export type StageName = 'export' | 'write' | 'check' | 'show';
export const STAGES: StageName[] = ['export', 'write', 'check', 'show'];
export type StageState = 'todo' | 'active' | 'done';
export interface ReadRow { time: string; tool: string; path: string; tag: string }
export interface DoneEvent { key: string; path: string; base: string; head: string; baseSha: string; headSha: string; files: number; cached: boolean }
export interface ErrorEvent { code: string; message: string; problems?: string[] }
export type CliEvent =
  | { type: 'stage'; stage: StageName; state: 'active' | 'done' }
  | ({ type: 'read' } & Omit<ReadRow, 'time'>)
  | { type: 'repair'; attempt: number }
  | ({ type: 'done' } & DoneEvent)
  | ({ type: 'error' } & ErrorEvent);
export interface ProgressState {
  stages: Record<StageName, StageState>;
  reads: ReadRow[];
  repairs: number;
  result?: DoneEvent;
  error?: ErrorEvent;
}

export function parseLine(line: string): CliEvent | undefined {
  try {
    const o = JSON.parse(line.trim());
    if (o && typeof o === 'object' && o.v === 1 && typeof o.type === 'string') return o as CliEvent;
  } catch { /* not JSON */ }
  return undefined;
}

export function initialState(): ProgressState {
  return { stages: { export: 'todo', write: 'todo', check: 'todo', show: 'todo' }, reads: [], repairs: 0 };
}

export function reduce(state: ProgressState, e: CliEvent, now: Date = new Date()): ProgressState {
  switch (e.type) {
    case 'stage':
      return { ...state, stages: { ...state.stages, [e.stage]: e.state } };
    case 'read': {
      const row: ReadRow = { time: now.toTimeString().slice(0, 8), tool: e.tool, path: e.path, tag: e.tag };
      return { ...state, reads: [row, ...state.reads].slice(0, 200) };
    }
    case 'repair':
      return { ...state, repairs: e.attempt };
    case 'done': {
      const { type: _t, ...result } = e as any;
      return { ...state, result: result as DoneEvent, stages: { export: 'done', write: 'done', check: 'done', show: 'done' } };
    }
    case 'error': {
      const error: ErrorEvent = { code: e.code, message: e.message, problems: e.problems };
      return { ...state, error };
    }
    default:
      return state;
  }
}

export function currentStage(s: ProgressState): string {
  const active = STAGES.find((n) => s.stages[n] === 'active');
  const done = [...STAGES].reverse().find((n) => s.stages[n] === 'done');
  const n = active ?? done ?? 'export';
  return n[0].toUpperCase() + n.slice(1);
}
