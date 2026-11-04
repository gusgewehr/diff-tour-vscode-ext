import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { findOnPath, resolveCli, detectTools, findClaude, pathFromShell, envWithDir } from './detect';

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
  assert.equal(c.missing.some((m) => m.what === 'claude'), (await findClaude()) === undefined);
  const bad = await detectTools({ cliPath: 'C:/nope/tour.exe', llm: 'claude', claudePath: 'C:/nope/claude' }, []);
  assert.match(bad.missing.find((m) => m.what === 'claude')!.message, /difftour\.claudePath/);
});

test('pathFromShell', () => {
  assert.equal(pathFromShell('/home/a/.local/bin/claude\n'), '/home/a/.local/bin/claude');
  assert.equal(pathFromShell("motd noise\nalias claude='/home/a/.claude/local/claude'\n"), '/home/a/.claude/local/claude');
  assert.equal(pathFromShell('alias claude=/home/a/x/claude'), '/home/a/x/claude');
  assert.equal(pathFromShell(''), undefined);
});

test('findClaude uses setting, then install spots', async () => {
  const f = path.join(os.tmpdir(), `difftour-claude-${process.pid}`);
  fs.writeFileSync(f, '');
  try {
    assert.equal(await findClaude(f), f);
    assert.equal(await findClaude(f + '-missing'), undefined);
    if (!(await findOnPath('claude'))) assert.equal(await findClaude('', [f + '-missing', f]), f);
  } finally { fs.rmSync(f); }
});

test('envWithDir puts the folder first on PATH', () => {
  const e = envWithDir('/opt/c', { Path: '/usr/bin', HOME: '/h' });
  assert.equal(e.Path, ['/opt/c', '/usr/bin'].join(path.delimiter));
  assert.equal(e.HOME, '/h');
  assert.equal(envWithDir('/opt/c', {}).PATH, '/opt/c');
});
