import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from './inline';

test('tokenize', () => {
  assert.deepEqual(tokenize('plain'), [{ t: 'text', v: 'plain' }]);
  assert.deepEqual(tokenize(''), []);
  assert.deepEqual(tokenize('a `x()` b'), [{ t: 'text', v: 'a ' }, { t: 'code', v: 'x()' }, { t: 'text', v: ' b' }]);
  assert.deepEqual(tokenize('**Lead:** rest'), [{ t: 'bold', v: 'Lead:' }, { t: 'text', v: ' rest' }]);
  assert.deepEqual(tokenize('see (`src/db.ts:10`).'), [{ t: 'text', v: 'see (' }, { t: 'file', v: 'src/db.ts:10', file: 'src/db.ts', line: 10 }, { t: 'text', v: ').' }]);
  assert.deepEqual(tokenize('`git.go:66-67`'), [{ t: 'file', v: 'git.go:66-67', file: 'git.go', line: 66, end: 67 }]);
  assert.deepEqual(tokenize('bare src/a/b.ts:5 here'), [{ t: 'text', v: 'bare ' }, { t: 'file', v: 'src/a/b.ts:5', file: 'src/a/b.ts', line: 5 }, { t: 'text', v: ' here' }]);
  assert.deepEqual(tokenize('`a:b`'), [{ t: 'code', v: 'a:b' }]);
  assert.doesNotThrow(() => tokenize('version 1.2:3'));
});

test('html stays literal, unclosed markers stay text', () => {
  const s = '<script>alert(1)</script> <b>x</b>';
  assert.deepEqual(tokenize(s), [{ t: 'text', v: s }]);
  assert.deepEqual(tokenize('a `open and **open'), [{ t: 'text', v: 'a `open and **open' }]);
});
