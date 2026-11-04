export interface MementoLike { get<T>(key: string): T | undefined; update(key: string, value: unknown): PromiseLike<void> }
export interface TourState { step: number; done: Record<number, true>; visited: Record<number, true>; notes: Record<number, string>; guesses: Record<number, string> }

export const stateKey = (id: string): string => `difftour.state.${id}`;
export const emptyState = (): TourState => ({ step: 0, done: {}, visited: {}, notes: {}, guesses: {} });

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isIdx = (k: string) => /^\d+$/.test(k);

export function sanitizeState(raw: unknown): TourState {
  const s = emptyState();
  if (!isObj(raw)) return s;
  if (typeof raw.step === 'number' && Number.isInteger(raw.step) && raw.step >= 0) s.step = raw.step;
  for (const f of ['done', 'visited'] as const) {
    const m = raw[f];
    if (isObj(m)) for (const [k, v] of Object.entries(m)) if (isIdx(k) && v === true) s[f][Number(k)] = true;
  }
  for (const f of ['notes', 'guesses'] as const) {
    const m = raw[f];
    if (isObj(m)) for (const [k, v] of Object.entries(m)) if (isIdx(k) && typeof v === 'string') s[f][Number(k)] = v;
  }
  return s;
}

export class StateStore {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending: TourState | undefined;
  constructor(private memento: MementoLike, private id: string, private delayMs = 300) {}
  load(): TourState { return sanitizeState(this.memento.get(stateKey(this.id))); }
  save(s: TourState): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined; this.pending = undefined;
    Promise.resolve(this.memento.update(stateKey(this.id), JSON.parse(JSON.stringify(s)))).catch(() => { /* never throw on write */ });
  }
  saveSoon(s: TourState): void {
    this.pending = s;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { if (this.pending) this.save(this.pending); }, this.delayMs);
  }
  flush(): void { if (this.pending) this.save(this.pending); }
}
