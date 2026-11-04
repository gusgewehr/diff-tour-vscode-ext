import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseLine, initialState, reduce, currentStage, type CliEvent } from './progress';

const fx = (n: string) => fs.readFileSync(path.join(process.cwd(), 'fixtures', 'tours', n), 'utf8').split(/\r?\n/).filter(Boolean);

test('parseLine', () => {
  assert.equal(parseLine('not json'), undefined);
  assert.equal(parseLine('{"v":2,"type":"stage"}'), undefined);
  assert.equal(parseLine(fx('real-b146230.progress.jsonl')[0])?.type, 'stage');
});

test('replay real fixture', () => {
  const lines = fx('real-b146230.progress.jsonl');
  let s = initialState();
  for (const l of lines) s = reduce(s, parseLine(l)!);
  assert.deepEqual(Object.values(s.stages), ['done', 'done', 'done', 'done']);
  assert.equal(s.reads.length, 43);
  const lastRead = [...lines].reverse().map((l) => JSON.parse(l)).find((o) => o.type === 'read');
  assert.equal(s.reads[0].path, lastRead.path);
  assert.equal(s.result?.key, '239f83a4230c1485fe877228');
  assert.equal(s.repairs, 0);
  assert.equal(s.error, undefined);
  assert.equal(currentStage(s), 'Show');
});

test('caps, repair, stage literal, time, error, cached', () => {
  let s = initialState();
  const now = new Date(2020, 0, 1, 3, 4, 5);
  for (let i = 0; i < 250; i++) s = reduce(s, { type: 'read', tool: 'Read', path: `p${i}`, tag: '' }, now);
  assert.equal(s.reads.length, 200);
  assert.equal(s.reads[0].path, 'p249');
  assert.equal(s.reads[0].time, '03:04:05');
  s = reduce(s, { type: 'repair', attempt: 2 });
  assert.equal(s.repairs, 2);
  s = reduce(s, { type: 'stage', stage: 'check', state: 'active' });
  s = reduce(s, { type: 'stage', stage: 'write', state: 'active' });
  assert.equal(s.stages.check, 'active');
  assert.equal(currentStage(s), 'Write');
  s = reduce(s, { type: 'error', code: 'llm', message: 'x' });
  assert.equal(s.error?.code, 'llm');
  const cached = fx('real-b146230.progress.jsonl').slice(-2).map((l) => parseLine(l)!) as CliEvent[];
  let c = initialState();
  for (const e of cached) c = reduce(c, e);
  assert.deepEqual(Object.values(c.stages), ['done', 'done', 'done', 'done']);
});
