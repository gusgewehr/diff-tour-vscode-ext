import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import {
  git, detectBase, resolveTarget, compareCandidates, parseLog, parseRange, describeCount,
  listSavedTours, listPrs, fetchPr, mapLimit, countFiles, recentCommits, parseNameStatus, listChangedFiles,
} from './changes';

const dirs: string[] = [];
after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

async function mkRepo(branch = 'main'): Promise<string> {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-'));
  dirs.push(d);
  await git(d, ['init', '-b', branch]);
  await git(d, ['config', 'user.name', 't']);
  await git(d, ['config', 'user.email', 't@t']);
  await git(d, ['config', 'commit.gpgsign', 'false']);
  return d;
}
async function commit(d: string, files: string[], msg = 'c') {
  for (const f of files) fs.writeFileSync(path.join(d, f), f + Math.random());
  await git(d, ['add', '-A']);
  await git(d, ['commit', '-m', msg]);
}

test('detectBase', async () => {
  const r = await mkRepo('main'); await commit(r, ['a']);
  assert.equal(await detectBase(r, ''), 'main');
  assert.equal(await detectBase(r, 'main'), 'main');
  await assert.rejects(detectBase(r, 'nope'), /nope/);
  const m = await mkRepo('master'); await commit(m, ['a']);
  assert.equal(await detectBase(m, ''), 'master');
  const t = await mkRepo('trunk'); await commit(t, ['a']);
  const sha = (await git(t, ['rev-parse', 'HEAD'])).trim();
  await git(t, ['update-ref', 'refs/remotes/origin/trunk', sha]);
  await git(t, ['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/trunk']);
  assert.equal(await detectBase(t, ''), 'trunk');
  await git(t, ['branch', '-m', 'trunk', 'other']);
  assert.equal(await detectBase(t, ''), 'origin/trunk');
});

test('three-dot count, commit target, CLI cross-check, candidates', async () => {
  const r = await mkRepo(); await commit(r, ['a']);
  await git(r, ['checkout', '-b', 'feature']);
  await commit(r, ['f1', 'f2', 'f3']);
  await git(r, ['checkout', 'main']); await commit(r, ['m1', 'm2']);
  const mb = (await git(r, ['merge-base', 'main', 'feature'])).trim();
  const t = await resolveTarget(r, 'branch', 'feature', 'main', 'feature');
  assert.equal(t.files, 3);
  assert.equal(t.baseSha, mb);
  assert.match(t.headSha, /^[0-9a-f]{40}$/);
  assert.match(t.baseSha, /^[0-9a-f]{40}$/);
  await assert.rejects(resolveTarget(r, 'range', 'x', '-x', 'feature'));

  const exe = path.resolve(process.cwd(), 'cli/bin/tour.exe');
  if (fs.existsSync(exe)) {
    const out = await new Promise<string>((res, rej) => execFile(exe, ['--json', '--count', '--repo', r, 'main..feature'], (e, so) => (e ? rej(e) : res(String(so)))));
    const j = JSON.parse(out.trim().split(/\r?\n/).pop()!);
    assert.equal(j.files, t.files); assert.equal(j.baseSha, t.baseSha); assert.equal(j.headSha, t.headSha);
  } else console.log('CLI cross-check skipped');

  const head = t.headSha;
  const ct = await resolveTarget(r, 'commit', 'c', `${head}^`, head);
  assert.equal(ct.files, 3);
  assert.equal(await countFiles(r, `${head}^`, head), 3);
  assert.ok((await recentCommits(r, 5)).length >= 1);

  await git(r, ['checkout', 'feature']);
  fs.writeFileSync(path.join(r, 'dirty'), 'x');
  for (let i = 0; i < 18; i++) await git(r, ['branch', `b${i}`, 'main']);
  const c = await compareCandidates(r, 'main');
  assert.equal(c.onBase, false);
  assert.equal(c.candidates[0].label, 'feature');
  assert.equal(c.candidates[0].detail, '+1 uncommitted (not toured)');
  assert.equal(c.candidates.length, 16);
  assert.ok(!c.candidates.some((x, i) => i > 0 && (x.label === 'main' || x.label === 'feature')));
  await git(r, ['checkout', '-f', 'main']);
  const o = await compareCandidates(r, 'main');
  assert.equal(o.onBase, true);
  assert.ok(!o.candidates.some((x) => x.label === 'main'));
});

test('parse helpers', () => {
  assert.deepEqual(parseLog('a\0s\0now\n\nb\0t\0then\n'), [{ sha: 'a', subject: 's', when: 'now' }, { sha: 'b', subject: 't', when: 'then' }]);
  assert.deepEqual(parseRange('main..feature'), { base: 'main', head: 'feature' });
  assert.deepEqual(parseRange('a...b'), { base: 'a', head: 'b' });
  for (const s of ['', 'main', '-x..y', 'a..']) assert.equal(parseRange(s), undefined);
  assert.equal(describeCount(14, 10), '14 files · tour');
  assert.equal(describeCount(3, 10), '3 files · opens git diff');
  assert.equal(describeCount(1, 10), '1 file · opens git diff');
  assert.equal(describeCount(0, 10), 'no changes');
});

test('listSavedTours', async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-')); dirs.push(d);
  fs.writeFileSync(path.join(d, 'a.meta.json'), '{"label":"A"}');
  fs.writeFileSync(path.join(d, 'b.meta.json'), '{broken');
  fs.writeFileSync(path.join(d, 'c.txt'), '');
  const l = await listSavedTours(d);
  assert.equal(l.length, 1);
  assert.ok(l[0].path.endsWith('a.json'));
  assert.deepEqual(await listSavedTours(path.join(d, 'missing')), []);
});

test('fetchPr and listPrs', async () => {
  const a = await mkRepo(); await commit(a, ['a']);
  const sha = (await git(a, ['rev-parse', 'HEAD'])).trim();
  await git(a, ['update-ref', 'refs/pull/7/head', sha]);
  const b = await mkRepo(); await git(b, ['remote', 'add', 'origin', a]);
  const c = await fetchPr(b, { kind: 'pr', label: '#7', base: 'main', head: 'x', pr: 7 });
  assert.equal(c.head, sha);
  assert.ok(Array.isArray(await listPrs(b)));
});

test('mapLimit', async () => {
  let cur = 0, max = 0;
  const r = await mapLimit([1, 2, 3, 4, 5], 2, async (n) => { cur++; max = Math.max(max, cur); await new Promise((x) => setTimeout(x, 5)); cur--; return n * 2; });
  assert.deepEqual(r, [2, 4, 6, 8, 10]);
  assert.ok(max <= 2);
});

test('parseNameStatus', () => {
  assert.deepEqual(parseNameStatus('M\0a.ts\0A\0b.ts\0D\0c.ts\0R100\0old.ts\0new.ts\0'), [
    { status: 'M', path: 'a.ts' }, { status: 'A', path: 'b.ts' }, { status: 'D', path: 'c.ts' },
    { status: 'R', path: 'new.ts', oldPath: 'old.ts' },
  ]);
  assert.deepEqual(parseNameStatus(''), []);
});

test('listChangedFiles M A D R', async () => {
  const r = await mkRepo();
  const w = (f: string, c: string) => fs.writeFileSync(path.join(r, f), c);
  w('m', 'm1\n'); w('d', 'd1\n'); w('old', 'rename me with enough content\nline2\nline3\n');
  await git(r, ['add', '-A']); await git(r, ['commit', '-m', 'a']);
  const base = (await git(r, ['rev-parse', 'HEAD'])).trim();
  w('m', 'm2\n'); fs.rmSync(path.join(r, 'd')); w('n', 'new\n');
  await git(r, ['mv', 'old', 'renamed']);
  await git(r, ['add', '-A']); await git(r, ['commit', '-m', 'b']);
  const head = (await git(r, ['rev-parse', 'HEAD'])).trim();
  const by = Object.fromEntries((await listChangedFiles(r, base, head)).map((f) => [f.path, f]));
  assert.equal(by['m'].status, 'M');
  assert.equal(by['n'].status, 'A');
  assert.equal(by['d'].status, 'D');
  assert.deepEqual(by['renamed'], { status: 'R', path: 'renamed', oldPath: 'old' });
});
