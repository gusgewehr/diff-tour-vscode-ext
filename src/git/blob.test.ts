import test from 'node:test';
import assert from 'node:assert/strict';
import { PLACEHOLDER, buildQuery, guardBlob, parseQuery, showBlob } from './blob';

test('query round-trip and rejects', () => {
  assert.deepEqual(parseQuery(buildQuery({ sha: 'abc', cwd: 'C:\r p' })), { empty: false, sha: 'abc', cwd: 'C:\r p' });
  assert.deepEqual(parseQuery('empty=1'), { empty: true });
  assert.equal(parseQuery(buildQuery({ sha: '-abc', cwd: '/x' })), undefined);
  assert.equal(parseQuery(buildQuery({ sha: 'abc', cwd: '' })), undefined);
});

test('guardBlob', () => {
  assert.equal(guardBlob(Buffer.from('hi')), 'hi');
  assert.equal(guardBlob(Buffer.from([65, 0, 66])), PLACEHOLDER);
  assert.equal(guardBlob(Buffer.alloc(2 * 1024 * 1024 + 1, 65)), PLACEHOLDER);
});

test('showBlob rejects leading dash sha', async () => {
  await assert.rejects(showBlob('.', '-x', 'f'));
});
