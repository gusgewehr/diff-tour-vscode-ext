import test from 'node:test';
import assert from 'node:assert/strict';
import { EN, S, applyStrings, localized } from './strings';

test('applyStrings ignores unknown, non-string and bad json', () => {
  applyStrings('{"cancel":"Cancelar","bogus":"x","readingNow":5}');
  assert.equal(S.cancel, 'Cancelar');
  assert.equal(S.readingNow, EN.readingNow);
  assert.ok(!('bogus' in S));
  applyStrings('not json'); applyStrings(undefined);
  assert.equal(S.cancel, 'Cancelar');
  applyStrings(JSON.stringify({ cancel: EN.cancel }));
});

test('localized maps every value', () => {
  const l = localized((m) => '<' + m);
  assert.deepEqual(Object.keys(l), Object.keys(EN));
  assert.equal(l.cancel, '<Cancel');
});
