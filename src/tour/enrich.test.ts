import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { git } from '../git/changes';
import { StepEnricher, groupFiles, isAiCoAuthor, parseCommits, parseNumstat, type CodeData, type TargetData, type FilesData } from './enrich';
import type { Block, FlatStep } from './model';

const dirs: string[] = [];
after(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

test('parseNumstat', () => {
  const m = parseNumstat('3\t1\ta.ts\0-\t-\timg.png\0' + '2\t0\t\0old.ts\0new.ts\0');
  assert.deepEqual(m.get('a.ts'), { added: 3, removed: 1 });
  assert.deepEqual(m.get('img.png'), { added: null, removed: null });
  assert.deepEqual(m.get('new.ts'), { added: 2, removed: 0 });
});

test('commits and trailers', () => {
  assert.ok(isAiCoAuthor('x\n\nCo-authored-by: Claude <noreply@anthropic.com>'));
  assert.ok(isAiCoAuthor('co-authored-by: GitHub Copilot <x>'));
  assert.ok(!isAiCoAuthor('Co-authored-by: Jane Doe <j@x>'));
  assert.ok(!isAiCoAuthor('I asked claude to help'));
  const c = parseCommits('abc\0one\0\0\ndef\0two\0Co-authored-by: Claude <a@b>\n\0');
  assert.deepEqual(c, [{ sha: 'abc', subject: 'one', ai: false }, { sha: 'def', subject: 'two', ai: true }]);
});

test('groupFiles', () => {
  const g = groupFiles(
    [{ file: 'd.md', role: 'docs' }, { file: 't.ts', role: 'test' }, { file: 'a.ts', role: 'core', note: 'n' }, { file: 'b.ts', role: 'core' }, { file: 'x', role: 'weird' }],
    new Map([['a.ts', { added: 2, removed: 1 }]]), new Set(['b.ts']));
  assert.deepEqual(g.map((x) => x.label), ['CORE', 'TESTS', 'DOCS']);
  assert.deepEqual(g[0].files, [{ file: 'a.ts', added: 2, removed: 1, at: 'head', note: 'n' }, { file: 'b.ts', added: null, removed: null, at: 'base' }]);
});

const mkStep = (blocks: Block[]): FlatStep => ({ chapterIndex: 0, stepIndex: 0, globalIndex: 0, chapterTitle: '', step: { title: 't', blocks } });
const lines = (n: number) => Array.from({ length: n }, (_, i) => `line${i + 1}`);

test('StepEnricher on a temp repo', async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-en-'));
  dirs.push(d);
  await git(d, ['init', '-b', 'main']);
  await git(d, ['config', 'user.name', 't']); await git(d, ['config', 'user.email', 't@t']); await git(d, ['config', 'commit.gpgsign', 'false']);
  fs.writeFileSync(path.join(d, 'a.txt'), lines(12).join('\n') + '\n');
  fs.writeFileSync(path.join(d, 'b.txt'), 'bee\n');
  await git(d, ['add', '-A']); await git(d, ['commit', '-m', 'base']);
  const a = lines(12); a[5] = 'EDITED'; a.splice(9, 0, 'ins1', 'ins2');
  fs.writeFileSync(path.join(d, 'a.txt'), a.join('\n') + '\n');
  fs.rmSync(path.join(d, 'b.txt'));
  fs.writeFileSync(path.join(d, 'c.txt'), 'c1\nc2\nc3\n');
  await git(d, ['add', '-A']);
  await git(d, ['commit', '-m', 'head', '-m', 'Co-authored-by: Claude <noreply@anthropic.com>']);
  const baseSha = (await git(d, ['rev-parse', 'HEAD~1'])).trim();
  const headSha = (await git(d, ['rev-parse', 'HEAD'])).trim();
  const step = mkStep([
    { kind: 'code', code: { file: 'a.txt', at: 'head', lines: [6, 6] } },
    { kind: 'code', code: { file: 'c.txt', lines: [1, 2] } },
    { kind: 'code', code: { file: 'b.txt', at: 'head', lines: [1, 1] } },
    { kind: 'code', code: { file: 'a.txt', at: 'head', lines: [90, 95] } },
    { kind: 'diff', diff: { file: 'a.txt' } },
    { kind: 'target', target: true },
    { kind: 'files', files: { roles: [{ file: 'a.txt', role: 'core' }] } },
    { kind: 'p', p: 'x' },
  ]);
  const en = new StepEnricher({ cwd: d, baseSha, headSha, base: 'main', head: 'feature', steps: [step] });
  const r = await en.forStep(0);
  const c0 = r[0] as CodeData;
  assert.ok(c0.sections[0].some((x) => x.left?.kind === 'del' && x.right?.kind === 'add' && x.right.n === 6));
  assert.ok(c0.added >= 1 && c0.removed >= 1);
  assert.equal((r[1] as CodeData).newFile, true);
  assert.equal((r[2] as CodeData).missing, 'b.txt not found at feature');
  assert.equal((r[3] as CodeData).approximate, true);
  assert.equal((r[4] as CodeData).sections.length, 1);
  const t = r[5] as TargetData;
  assert.equal(t.commits.length, 1); assert.equal(t.commits[0].ai, true);
  const f = r[6] as FilesData;
  assert.equal(f.groups[0].files[0].added, 3); assert.equal(f.groups[0].files[0].removed, 1);
  assert.equal(r[7], null);
  assert.equal(await en.forStep(0), await en.forStep(0));
});

test('StepEnricher without git', async () => {
  const step = mkStep([
    { kind: 'code', code: { file: 'a', lines: [1, 1] } }, { kind: 'target', target: true },
    { kind: 'files', files: { roles: [{ file: 'a', role: 'core' }] } },
    { kind: 'flow', flow: { nodes: [{ label: 'n', start: true }] } },
  ]);
  const r = await new StepEnricher({ baseSha: '', headSha: '', base: '', head: '', steps: [step] }).forStep(0);
  assert.equal((r[0] as CodeData).missing, 'Code unavailable: this tour has no toured commits');
  assert.deepEqual((r[0] as CodeData).sections, []);
  assert.deepEqual((r[1] as TargetData).commits, []);
  assert.equal((r[2] as FilesData).groups[0].files[0].added, null);
  assert.equal(r[3]?.kind, 'flow');
});
