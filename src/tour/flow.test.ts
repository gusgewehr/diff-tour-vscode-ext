import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { flatten, loadTour } from './model';
import { flowPaths, nodeTargets } from './flow';

const steps = flatten(loadTour(fs.readFileSync(path.join(process.cwd(), 'fixtures', 'tours', 'real-9c18e24.json'), 'utf8'))).map((s) => s.step);
const flow = steps[4].blocks.find((b) => b.kind === 'flow');
if (!flow || flow.kind !== 'flow') throw new Error('no flow block');

test('flowPaths', () => {
  assert.deepEqual(flowPaths([{ label: 'a' }, { label: 'b', start: true }, { label: 'c' }]), [[0], [1, 2]]);
  assert.deepEqual(flowPaths([{ label: 'a', start: true }]), [[0]]);
});

test('nodeTargets on real tour', () => {
  const t = nodeTargets(flow.flow.nodes, steps);
  assert.deepEqual(t[0].steps, [1]);
  assert.deepEqual(t[2].steps, [5]);
  assert.deepEqual(t[5].steps, [7, 8, 9, 11]);
  assert.deepEqual(t[4], { steps: [] });
  assert.equal(t[0].line, 157); assert.equal(t[0].end, 170);
});

test('nodeTargets label/note fallback', () => {
  const st = [{ title: 't', blocks: [{ kind: 'code' as const, code: { file: 'internal/generate/claude.go', lines: [1, 2] as [number, number] } }] }];
  const t = nodeTargets([{ label: 'Runs CLAUDE.go' }, { label: 'x', note: 'see claude.go' }, { label: 'claude.go', kind: 'external' }], st);
  assert.deepEqual(t[0].steps, [0]); assert.equal(t[0].file, 'internal/generate/claude.go');
  assert.equal(t[1].file, 'internal/generate/claude.go');
  assert.deepEqual(t[2], { steps: [] });
});
