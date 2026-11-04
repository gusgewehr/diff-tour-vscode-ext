import test from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { run, cliArgs, cliLlm } from './runner';
import type { CliEvent } from './progress';

const fake = path.join(process.cwd(), 'scripts', 'fake-tour.mjs');
const fx = (n: string) => path.join(process.cwd(), 'fixtures', 'tours', n);

test('replay', async () => {
  const ev: CliEvent[] = [];
  const r = await run({ command: process.execPath, args: [fake, fx('real-9cbe3d2.progress.jsonl'), '1'] }, (e) => ev.push(e)).done;
  assert.equal(r.exitCode, 0);
  assert.ok(r.done?.path.endsWith('real-9cbe3d2.json'));
  assert.equal(r.cancelled, false);
  assert.equal(ev.filter((e) => e.type === 'read').length, 36);
});

test('cancel via EOF', async () => {
  const h = run({ command: process.execPath, args: [fake, fx('real-9cbe3d2.progress.jsonl'), '200'] }, () => {});
  setTimeout(() => h.cancel(), 300);
  const r = await h.done;
  assert.equal(r.cancelled, true);
  assert.equal(r.error?.code, 'cancelled');
  assert.equal(r.exitCode, 1);
});

test('cancel via grace kill', async () => {
  const h = run({ command: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'] }, () => {}, { graceMs: 300 });
  setTimeout(() => h.cancel(), 100);
  const r = await Promise.race([h.done, new Promise<never>((_, j) => setTimeout(() => j(new Error('hung')), 5000))]);
  assert.equal(r.cancelled, true);
});

test('non-JSON, split line, stderr', async () => {
  const script = `process.stdout.write('hello\\n{"v":1,"type":"re');setTimeout(()=>{process.stdout.write('pair","attempt":1}\\n');console.error('oops')},50)`;
  const ev: CliEvent[] = [];
  const logs: string[] = [];
  const r = await run({ command: process.execPath, args: ['-e', script] }, (e) => ev.push(e), { log: (l) => logs.push(l) }).done;
  assert.deepEqual(ev, [{ v: 1, type: 'repair', attempt: 1 }]);
  assert.ok(logs.includes('hello'));
  assert.ok(r.stderrTail.includes('oops'));
});

test('spawn failure', async () => {
  const r = await run({ command: 'C:/nope/tour.exe', args: [] }, () => {}).done;
  assert.ok(r.spawnError);
});

test('args', () => {
  assert.equal(cliLlm('claude'), 'claude-code');
  assert.equal(cliLlm('codex'), 'codex');
  const t = { base: 'main', head: 'feature/x', baseSha: 'aaa', headSha: 'bbb' };
  const s = { llm: 'claude', language: 'en' as const };
  const b = cliArgs({ ...t, kind: 'branch' }, s, '/r');
  assert.deepEqual(b.slice(0, 7), ['--json', '--llm', 'claude-code', '--lang', 'en', '--repo', '/r']);
  assert.equal(b[7], 'main..feature/x');
  for (const kind of ['commit', 'range', 'pr'] as const) assert.equal(cliArgs({ ...t, kind }, s, '/r')[7], 'aaa..bbb');
  // regenerate: --fresh goes before the range, which stays last
  const f = cliArgs({ ...t, kind: 'range' }, s, '/r', true);
  assert.deepEqual(f.slice(7), ['--fresh', 'aaa..bbb']);
  assert.ok(!b.includes('--fresh'));
});
