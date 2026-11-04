import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadTour } from './model';
import { StateStore, sanitizeState, emptyState, type MementoLike } from './state';
import { TourSession, type ChangeKind } from './session';

const tour = loadTour(fs.readFileSync(path.join(process.cwd(), 'fixtures', 'tours', 'real-9c18e24.json'), 'utf8'));
const meta = { key: 'k', label: '', base: '', head: '', baseSha: '', headSha: '', files: 0, lang: '', llm: '', createdAt: '' };
const mem = (init?: unknown): MementoLike & { m: Map<string, unknown> } => {
  const m = new Map<string, unknown>(init ? [['difftour.state.k', init]] : []);
  return { m, get: <T>(k: string) => m.get(k) as T | undefined, update: async (k, v) => { m.set(k, v); } };
};
const mk = (memento = mem(), delay = 20) => new TourSession(tour, meta, 'k', '/p.json', new StateStore(memento, 'k', delay));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('state round trip, debounce, flush', async () => {
  const m = mem();
  const a = new StateStore(m, 'k', 20);
  const s = { ...emptyState(), step: 3, done: { 1: true as const } };
  a.save(s);
  assert.deepEqual(new StateStore(m, 'k').load(), s);
  m.m.clear();
  a.saveSoon(s);
  assert.equal(m.m.size, 0);
  await sleep(60);
  assert.equal(m.m.size, 1);
  m.m.clear();
  a.saveSoon(s); a.flush();
  assert.equal(m.m.size, 1);
});

test('sanitizeState', () => {
  assert.deepEqual(sanitizeState(undefined), emptyState());
  assert.deepEqual(sanitizeState('x'), emptyState());
  assert.deepEqual(sanitizeState({ step: 'a', notes: 5 }), emptyState());
  const r = sanitizeState({ step: 2, done: { 1: true, 2: 'y' }, notes: { 0: 'a', 1: 5 } });
  assert.deepEqual(r.done, { 1: true });
  assert.deepEqual(r.notes, { 0: 'a' });
});

test('navigation and marks', () => {
  const s = mk();
  assert.equal(s.index, 0); assert.ok(s.state.visited[0]);
  s.next(); s.next();
  assert.equal(s.index, 2);
  assert.deepEqual(Object.keys(s.state.visited), ['0', '1', '2']);
  s.goto(0); s.prev(); assert.equal(s.index, 0);
  s.goto(s.steps.length - 1); s.next(); assert.equal(s.index, s.steps.length - 1);
  s.goto(-1); s.goto(99); s.goto(1.5); assert.equal(s.index, s.steps.length - 1);
  s.goto(5); assert.equal(s.index, 5);
  s.toggleUnderstood(); assert.equal(s.understoodCount(), 1);
  s.setNote('hi'); assert.equal(s.state.notes[5], 'hi');
  s.setNote(''); assert.equal(s.state.notes[5], undefined);
  s.setGuess('g'); assert.equal(s.state.guesses[5], 'g');
  s.dispose();
});

test('events', () => {
  const s = mk(); const got: ChangeKind[] = [];
  const d = s.onDidChange((k) => got.push(k));
  s.prev(); s.next(); s.toggleUnderstood(); s.setNote('x');
  assert.deepEqual(got, ['move', 'mark', 'text']);
  d.dispose(); s.next();
  assert.equal(got.length, 3);
  s.dispose();
});

test('restore', () => {
  assert.equal(mk(mem({ step: 4, done: { 2: true } })).index, 4);
  assert.equal(mk(mem({ step: 999 })).index, 0);
});
