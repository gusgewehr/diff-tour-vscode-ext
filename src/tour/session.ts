import type { TourMeta } from '../cli/cache';
import { flatten, type FlatStep, type Tour } from './model';
import type { StateStore, TourState } from './state';

export type ChangeKind = 'move' | 'mark' | 'text';

export class TourSession {
  readonly steps: FlatStep[];
  private st: TourState;
  private listeners: ((k: ChangeKind) => void)[] = [];

  constructor(readonly tour: Tour, readonly meta: TourMeta, readonly id: string, readonly path: string, private store: StateStore) {
    this.steps = flatten(tour);
    this.st = store.load();
    if (this.st.step >= this.steps.length) this.st.step = 0;
    this.st.visited[this.st.step] = true;
    store.save(this.st);
  }

  get index(): number { return this.st.step; }
  get current(): FlatStep { return this.steps[this.st.step]; }
  get state(): Readonly<TourState> { return this.st; }

  onDidChange(fn: (k: ChangeKind) => void): { dispose(): void } {
    this.listeners.push(fn);
    return { dispose: () => { this.listeners = this.listeners.filter((l) => l !== fn); } };
  }
  private fire(k: ChangeKind) { for (const l of [...this.listeners]) l(k); }

  next(): void { this.goto(this.index + 1); }
  prev(): void { this.goto(this.index - 1); }
  goto(i: number): void {
    if (!Number.isInteger(i) || i < 0 || i >= this.steps.length || i === this.index) return;
    this.st.step = i;
    this.st.visited[i] = true;
    this.store.save(this.st);
    this.fire('move');
  }
  toggleUnderstood(i = this.index): void {
    if (this.st.done[i]) delete this.st.done[i]; else this.st.done[i] = true;
    this.store.save(this.st);
    this.fire('mark');
  }
  private setText(f: 'notes' | 'guesses', text: string) {
    if (text.trim() === '') delete this.st[f][this.index]; else this.st[f][this.index] = text;
    this.store.saveSoon(this.st);
    this.fire('text');
  }
  setNote(text: string): void { this.setText('notes', text); }
  setGuess(text: string): void { this.setText('guesses', text); }
  understoodCount(): number { return Object.keys(this.st.done).length; }
  dispose(): void { this.store.flush(); this.listeners = []; }
}
