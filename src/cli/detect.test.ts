import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { findOnPath, resolveCli, detectTools } from './detect';

test('findOnPath', async () => {
  const g = await findOnPath('git');
  assert.ok(g && fs.existsSync(g));
  assert.equal(await findOnPath('difftour-no-such-cmd'), undefined);
});

test('resolveCli bad setting', async () => {
  const r = await resolveCli('C:/nope/tour.exe', []);
  assert.match(r.problem!, /C:\/nope\/tour\.exe/);
  assert.match(r.problem!, /difftour\.cliPath/);
});

test('resolveCli finds repo binary', { skip: !fs.existsSync(path.join(process.cwd(), 'cli/bin/tour.exe')) }, async () => {
  const r = await resolveCli('', [process.cwd()]);
  assert.ok(r.path!.replace(/\\/g, '/').endsWith('cli/bin/tour.exe'));
  assert.ok(r.version!.startsWith('tour'));
});

test('detectTools', async () => {
  const d = await detectTools({ cliPath: 'C:/nope/tour.exe', llm: 'codex' }, []);
  assert.deepEqual(d.missing.map((m) => m.what), ['cli']);
  const c = await detectTools({ cliPath: 'C:/nope/tour.exe', llm: 'claude' }, []);
  assert.equal(c.missing.some((m) => m.what === 'claude'), (await findOnPath('claude')) === undefined);
});
