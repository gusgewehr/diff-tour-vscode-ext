import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadTour } from './model';
import { StateStore } from './state';
import { TourSession } from './session';
import { parseIntent, renderMessage, primaryCode, codeTargetForBlock } from './messages';

const tour = loadTour(fs.readFileSync(path.join(process.cwd(), 'fixtures', 'tours', 'real-9c18e24.json'), 'utf8'));
const meta = { key: 'k', label: '', base: '', head: '', baseSha: '', headSha: '', files: 0, lang: '', llm: '', createdAt: '' };
const memento = { get: () => undefined, update: async () => {} };
const sess = () => new TourSession(tour, meta, 'k', '/p.json', new StateStore(memento as never, 'k'));

test('parseIntent accepts', () => {
  assert.deepEqual(parseIntent({ type: 'ready' }), { type: 'ready' });
  assert.deepEqual(parseIntent({ type: 'goto', index: 3, evil: 1 }), { type: 'goto', index: 3 });
  assert.deepEqual(parseIntent({ type: 'note', text: 'x' }), { type: 'note', text: 'x' });
  assert.deepEqual(parseIntent({ type: 'openCode' }), { type: 'openCode' });
  assert.deepEqual(parseIntent({ type: 'openCode', block: 2 }), { type: 'openCode', block: 2 });
  assert.deepEqual(parseIntent({ type: 'openFile', file: 'src/a.ts', line: 10, end: 12, at: 'base' }), { type: 'openFile', file: 'src/a.ts', line: 10, end: 12, at: 'base' });
});

test('parseIntent rejects', () => {
  for (const m of [null, 'next', { type: 'nope' }, { type: 'goto', index: -1 }, { type: 'goto', index: '3' }, { type: 'goto', index: 1.5 },
    { type: 'note' }, { type: 'note', text: 'x'.repeat(20001) }, { type: 'openFile', file: '', line: 1 },
    { type: 'openFile', file: 'a', line: 0 }, { type: 'openFile', file: 'a', line: 1, at: 'tip' }]) {
    assert.equal(parseIntent(m), undefined, JSON.stringify(m));
  }
});

test('renderMessage', () => {
  const s = sess();
  assert.equal(renderMessage(s).prevTitle, undefined);
  s.toggleUnderstood(); s.next(); s.next();
  const r = renderMessage(s);
  assert.equal(r.index, 2); assert.equal(r.total, 18);
  assert.deepEqual(r.ticks.slice(0, 4).map((t) => t.state), ['understood', 'visited', 'current', 'unvisited']);
  assert.equal(r.prevTitle, s.steps[1].step.title);
  assert.equal(r.nextTitle, s.steps[3].step.title);
  assert.deepEqual(r.restore, { id: 'k', path: '/p.json' });
});

test('code targets', () => {
  const st = tour.chapters.flatMap((c) => c.steps).find((x) => x.blocks.some((b) => b.kind === 'code'))!;
  const bi = st.blocks.findIndex((b) => b.kind === 'code');
  const t = codeTargetForBlock(st, bi)!;
  assert.equal(t.at, (st.blocks[bi] as { code: { at?: string } }).code.at || 'head');
  assert.equal(codeTargetForBlock(st, 99), undefined);
  assert.deepEqual(primaryCode({ title: 'x', open: { file: 'f', line: 4, at: 'base' }, blocks: st.blocks }), { file: 'f', at: 'base', lines: [4, 4] });
  assert.equal(primaryCode({ title: 'x', blocks: [] }), undefined);
  assert.ok(primaryCode(st));
});
