import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { saveTour, findExisting, removeTour } from './cache';
import { listSavedTours } from '../git/changes';
import { parseLine, type DoneEvent } from './progress';

const fxDir = path.join(process.cwd(), 'fixtures', 'tours');
const lines = fs.readFileSync(path.join(fxDir, 'real-b146230.progress.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean);
const { type: _t, ...rest } = parseLine(lines[lines.length - 1]) as any;
const done: DoneEvent = { ...rest, path: path.join(fxDir, 'real-b146230.json') };
const s = { llm: 'claude', language: 'en' as const };

test('saveTour + findExisting', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-'));
  const p = await saveTour(dir, done, 'feat', s);
  assert.equal(p, path.join(dir, `${done.key}.json`));
  assert.ok(fs.existsSync(p));
  assert.deepEqual(fs.readdirSync(dir).filter((n) => n.endsWith('.tmp')), []);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, `${done.key}.meta.json`), 'utf8'));
  assert.equal(meta.label, 'feat');
  assert.equal(meta.lang, 'en');
  assert.equal(meta.files, 11);
  const l = await listSavedTours(dir);
  assert.equal(l[0].label, 'feat');
  assert.equal(l[0].files, 11);
  await saveTour(dir, { ...done, cached: true }, 'feat', s);

  assert.equal((await findExisting(dir, { label: 'feat', baseSha: 'x', headSha: 'y' }))?.key, done.key);
  assert.equal((await findExisting(dir, { label: 'other', baseSha: done.baseSha, headSha: done.headSha }))?.key, done.key);
  assert.equal(await findExisting(dir, { label: 'other', baseSha: 'x', headSha: 'y' }), undefined);
  fs.unlinkSync(p);
  assert.equal(await findExisting(dir, { label: 'feat', baseSha: 'x', headSha: 'y' }), undefined);
});

test('removeTour deletes the tour and its meta, and tolerates missing files', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-'));
  await saveTour(dir, done, 'feat', s);
  await removeTour(dir, done.key);
  assert.deepEqual(fs.readdirSync(dir), []);
  await removeTour(dir, done.key);
});
