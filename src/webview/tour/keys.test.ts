import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyAction } from './keys';

const free = { typing: false, mod: false };
test('keyAction', () => {
  assert.equal(keyAction('ArrowLeft', free), 'prev');
  assert.equal(keyAction('ArrowRight', free), 'next');
  assert.equal(keyAction('u', free), 'understood');
  assert.equal(keyAction('U', free), 'understood');
  assert.equal(keyAction('n', free), 'note');
  assert.equal(keyAction('N', free), 'note');
  assert.equal(keyAction('o', free), 'open');
  assert.equal(keyAction('Escape', free), undefined);
  assert.equal(keyAction('x', free), undefined);
  for (const k of ['ArrowLeft', 'ArrowRight', 'u', 'n', 'o']) {
    assert.equal(keyAction(k, { typing: true, mod: false }), undefined);
    assert.equal(keyAction(k, { typing: false, mod: true }), undefined);
  }
  assert.equal(keyAction('Escape', { typing: true, mod: false }), 'blur');
});
