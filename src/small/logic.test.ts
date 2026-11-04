import test from 'node:test';
import assert from 'node:assert/strict';
import { sides, noticeText, statusText } from './logic';

test('sides', () => {
  assert.deepEqual(sides({ status: 'M', path: 'a' }), { left: 'a', right: 'a' });
  assert.deepEqual(sides({ status: 'A', path: 'a' }), { right: 'a' });
  assert.deepEqual(sides({ status: 'D', path: 'a' }), { left: 'a' });
  assert.deepEqual(sides({ status: 'R', path: 'n', oldPath: 'o' }), { left: 'o', right: 'n' });
});

test('texts', () => {
  assert.equal(noticeText(3, 10), '3 files changed. Changes under 10 files open in the standard diff, without a tour.');
  assert.ok(noticeText(1, 10).startsWith('1 file changed.'));
  assert.equal(statusText(3, 10), '$(git-compare) No tour · 3 files (under 10)');
  assert.equal(statusText(1, 10), '$(git-compare) No tour · 1 file (under 10)');
});
