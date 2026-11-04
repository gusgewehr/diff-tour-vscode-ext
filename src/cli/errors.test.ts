import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeError } from './errors';

const base = { exitCode: 1, cancelled: false } as const;
const err = (code: string, message = 'm') => describeError({ ...base, error: { code, message } });

test('mapping', () => {
  assert.deepEqual(err('not_signed_in'), { text: 'Claude Code is not signed in. Run `claude` once in a terminal, then try again.', actions: ['Open Terminal', 'Try again'] });
  assert.deepEqual(err('invalid_tour'), { text: 'The tour still had problems after 2 repairs.', actions: ['Try again', 'Show details'] });
  assert.deepEqual(err('git', 'boom'), { text: 'git failed: boom', actions: ['Show details'] });
  assert.deepEqual(err('llm', 'boom'), { text: 'The LLM run failed: boom', actions: ['Try again', 'Show details'] });
  assert.deepEqual(err('usage', 'bad'), { text: 'diff-tour CLI rejected the arguments: bad', actions: ['Open Settings'] });
  assert.equal(err('cancelled'), undefined);
  assert.equal(describeError({ exitCode: 1, cancelled: true }), undefined);
});

test('no error event', () => {
  const done = { key: 'k', path: 'p', base: 'a', head: 'b', baseSha: 'a', headSha: 'b', files: 1, cached: false };
  assert.equal(describeError({ exitCode: 0, cancelled: false, done }), undefined);
  assert.deepEqual(describeError({ exitCode: 2, cancelled: false })?.actions, ['Show details']);
  assert.deepEqual(describeError({ exitCode: null, cancelled: false, spawnError: 'ENOENT' }), { text: 'Could not start the diff-tour CLI: ENOENT', actions: ['Open Settings', 'Show details'] });
});
