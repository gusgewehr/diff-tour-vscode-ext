import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { flatten, loadTour } from './model';
import { buildBar, resolveClick, type BarNode } from './flowBar';

const dir = path.join(process.cwd(), 'fixtures', 'tours');
const load = (f: string) => flatten(loadTour(fs.readFileSync(path.join(dir, f), 'utf8'))).map((s) => s.step);

test('buildBar over all fixtures', () => {
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const steps = load(f);
    for (let c = 0; c < steps.length; c++) {
      const bar = buildBar(steps, c, {});
      const nodes = bar.paths.flat();
      assert.ok(nodes.every((n) => n.label.length > 0), f);
      assert.ok(nodes.filter((n) => n.current).length <= 1, f);
      assert.equal(bar.active, nodes.some((n) => n.current));
    }
  }
});

test('real tour has file nodes and a current node', () => {
  const steps = load('real-9c18e24.json');
  const bar = buildBar(steps, 1, { 1: true });
  assert.ok(bar.paths.some((p) => p.some((n) => n.file)));
  assert.ok(bar.paths.flat().some((n) => n.visited));
  const cur = bar.paths.flat().find((n) => n.current);
  assert.ok(cur && cur.tip.includes('you are here'));
});

test('resolveClick', () => {
  const n = (o: Partial<BarNode>): BarNode => ({ label: 'x', kind: 'same', steps: [], current: false, visited: false, tip: '', ...o });
  assert.deepEqual(resolveClick(n({ steps: [1, 4, 6], file: 'a' }), 4), { goto: 6 });
  assert.deepEqual(resolveClick(n({ steps: [1], file: 'a', line: 3 }), 4), { open: { file: 'a', lines: [3, 3] } });
  assert.equal(resolveClick(n({ kind: 'external', steps: [2] }), 0), undefined);
  assert.equal(resolveClick(n({}), 0), undefined);
});
