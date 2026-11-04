import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadTour, flatten, metaPathFor, fileTourId, KINDS } from './model';

const dir = path.join(process.cwd(), 'fixtures', 'tours');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.endsWith('.meta.json'));
const wrap = (steps: unknown) => JSON.stringify({ version: 1, title: 't', base: 'a', head: 'b', chapters: [{ title: 'c', steps }] });

test('fixtures load with known kinds', () => {
  assert.ok(files.length >= 4);
  for (const f of files) {
    const t = loadTour(fs.readFileSync(path.join(dir, f), 'utf8'));
    const flat = flatten(t);
    assert.equal(flat.length, f.startsWith('example') ? 16 : 18, f);
    flat.forEach((s, i) => { assert.equal(s.globalIndex, i); s.step.blocks.forEach((b) => assert.ok((KINDS as readonly string[]).includes(b.kind), f)); });
  }
});

test('block normalisation', () => {
  const t = loadTour(wrap([{ title: 's', blocks: [{ p: 'x', basis: 'fact' }, { target: true }, { weird: 1 }, 5] }, { title: 'n' }]));
  assert.deepEqual(t.chapters[0].steps[0].blocks, [{ kind: 'p', p: 'x', basis: 'fact' }, { kind: 'target', target: true }, { kind: 'unknown', raw: { weird: 1 } }, { kind: 'unknown', raw: 5 }]);
  assert.deepEqual(t.chapters[0].steps[1].blocks, []);
});

test('errors', () => {
  assert.throws(() => loadTour('{'), /invalid JSON/);
  assert.throws(() => loadTour('{"version":2,"chapters":[]}'), /version/);
  assert.throws(() => loadTour('{"version":1,"chapters":5}'), /chapters/);
  assert.throws(() => loadTour(wrap([])), /no steps/);
  assert.throws(() => loadTour(wrap([{ title: 3 }])), /title/);
});

test('identity helpers', () => {
  assert.equal(metaPathFor(path.join('/a/b', 'k1.json')), path.join('/a/b', 'k1.meta.json'));
  assert.match(fileTourId('/x/y.json'), /^file-[0-9a-f]{40}$/);
  assert.equal(fileTourId('/x/y.json'), fileTourId('/x/y.json'));
  assert.notEqual(fileTourId('/x/y.json'), fileTourId('/x/z.json'));
});
