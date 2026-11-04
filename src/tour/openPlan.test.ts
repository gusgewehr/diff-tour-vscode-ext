import test from 'node:test';
import assert from 'node:assert/strict';
import { planOpen } from './openPlan';

const base = 'b'.repeat(40), head = 'h'.repeat(40);
const b7 = 'bbbbbbb', h7 = 'hhhhhhh';
const run = (file: string, at: 'base' | 'head', changes: { status: string; path: string; oldPath?: string }[], lines: [number, number] = [3, 5]) =>
  planOpen({ file, at, lines, baseSha: base, headSha: head, changes });

test('added', () => {
  const p = run('a.ts', 'head', [{ status: 'A', path: 'a.ts' }]);
  assert.equal(p.left, undefined); assert.equal(p.right, 'a.ts');
  assert.equal(p.title, `a.ts · BEFORE ${b7} (did not exist) ↔ AFTER ${h7} · read-only tour copy`);
  assert.equal(p.startLine, 2); assert.equal(p.endLine, 4); assert.equal(p.revealSide, 'right');
  assert.equal(run('a.ts', 'base', [{ status: 'A', path: 'a.ts' }]).missing, `a.ts is not in ${b7} at this commit`);
});

test('deleted', () => {
  const d = [{ status: 'D', path: 'd.ts' }];
  assert.equal(run('d.ts', 'head', d).missing, `d.ts is not in ${h7} at this commit`);
  const p = run('d.ts', 'base', d);
  assert.equal(p.left, 'd.ts'); assert.equal(p.right, undefined); assert.equal(p.revealSide, 'left');
  assert.equal(p.title, `d.ts · BEFORE ${b7} ↔ AFTER ${h7} (deleted) · read-only tour copy`);
});

test('unchanged, modified, rename, clamp', () => {
  const u = run('u.ts', 'head', []);
  assert.deepEqual([u.left, u.right, u.unchanged], ['u.ts', 'u.ts', true]);
  assert.equal(u.title, `u.ts · same in ${b7} and ${h7} · read-only tour copy`);
  const m = run('m.ts', 'head', [{ status: 'M', path: 'm.ts' }], [0, 0]);
  assert.equal(m.title, `m.ts · BEFORE ${b7} ↔ AFTER ${h7} · read-only tour copy`);
  assert.equal(m.startLine, 0);
  const r = [{ status: 'R', oldPath: 'old.ts', path: 'new.ts' }];
  for (const f of ['new.ts', 'old.ts']) { const p = run(f, 'head', r); assert.deepEqual([p.left, p.right], ['old.ts', 'new.ts']); }
});
