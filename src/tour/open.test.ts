import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { resolveTour } from './open';
import { fileTourId } from './model';

const fx = path.join(process.cwd(), 'fixtures', 'tours', 'real-9c18e24.json');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dt-'));

test('file id without cwd', async () => {
  const r = await resolveTour(fx);
  assert.equal(r.id, fileTourId(fx));
  assert.equal(r.meta.key, r.id);
  assert.equal(r.meta.label, r.tour.title);
  assert.equal(r.meta.base, r.tour.base);
  assert.equal(r.meta.head, r.tour.head);
  assert.equal(r.meta.baseSha, ''); assert.equal(r.meta.headSha, '');
});

test('git failure leaves SHAs empty, does not throw', async () => {
  const r = await resolveTour(fx, process.cwd());
  assert.equal(typeof r.meta.headSha, 'string');
});

test('sibling meta file wins; broken meta falls back', async () => {
  const d = tmp();
  const p = path.join(d, 'k123.json');
  fs.copyFileSync(fx, p);
  fs.writeFileSync(path.join(d, 'k123.meta.json'), JSON.stringify({ key: 'k123', baseSha: 'aaa', headSha: 'bbb' }));
  const r = await resolveTour(p);
  assert.equal(r.id, 'k123'); assert.equal(r.meta.baseSha, 'aaa');
  fs.writeFileSync(path.join(d, 'k123.meta.json'), '{nope');
  assert.equal((await resolveTour(p)).id, fileTourId(p));
  fs.writeFileSync(path.join(d, 'k123.meta.json'), JSON.stringify({ key: 5 }));
  assert.equal((await resolveTour(p)).id, fileTourId(p));
});

test('missing or invalid file rejects', async () => {
  const d = tmp();
  await assert.rejects(resolveTour(path.join(d, 'none.json')));
  fs.writeFileSync(path.join(d, 'bad.json'), 'x');
  await assert.rejects(resolveTour(path.join(d, 'bad.json')), /invalid JSON/);
});
