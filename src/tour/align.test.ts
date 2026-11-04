import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHunks, splitLines, alignFile, codeView, diffView } from './align';

const nums = (n: number) => Array.from({ length: n }, (_, i) => `l${i + 1}`);

test('splitLines', () => {
  assert.deepEqual(splitLines(''), []);
  assert.deepEqual(splitLines('a\r\nb\n'), ['a', 'b']);
});

test('parseHunks', () => {
  const h = parseHunks('diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -10,0 +11,3 @@ fn\n+a\n+b\n+c\n@@ -20 +23 @@\n--- x\n+y\n\\ No newline at end of file\n');
  assert.equal(h.length, 2);
  assert.deepEqual([h[0].oldStart, h[0].oldCount, h[0].newStart, h[0].newCount], [10, 0, 11, 3]);
  assert.deepEqual([h[1].oldCount, h[1].newCount], [1, 1]);
  assert.deepEqual(h[1].lines, [{ t: '-', text: '-- x' }, { t: '+', text: 'y' }]);
  const two = parseHunks('diff --git a/a b/a\n@@ -1 +1 @@\n-a\n+b\ndiff --git a/c b/c\n--- a/c\n+++ b/c\n@@ -2 +2 @@\n-c\n+d\n');
  assert.equal(two.length, 2);
});

test('alignFile cases', () => {
  const o = nums(5);
  assert.ok(alignFile(o, o, []).every((r) => r.left?.kind === 'same' && r.left.n === r.right?.n));
  // replace line 2 with two lines
  const n = ['l1', 'x', 'y', 'l3', 'l4', 'l5'];
  const rows = alignFile(o, n, parseHunks('@@ -2 +2,2 @@\n-l2\n+x\n+y\n'));
  assert.equal(rows.length, 6);
  assert.equal(rows[1].left?.kind, 'del'); assert.equal(rows[1].right?.text, 'x');
  assert.equal(rows[2].left, undefined); assert.equal(rows[2].right?.n, 3);
  assert.equal(rows[3].left?.n, 3); assert.equal(rows[3].right?.n, 4);
  // pure insert / pure delete
  const ins = alignFile(o, ['l1', 'l2', 'z', 'l3', 'l4', 'l5'], parseHunks('@@ -2,0 +3 @@\n+z\n'));
  assert.equal(ins.length, 6); assert.equal(ins[2].left, undefined); assert.equal(ins[3].left?.n, 3);
  const del = alignFile(o, ['l1', 'l2', 'l4', 'l5'], parseHunks('@@ -3 +2,0 @@\n-l3\n'));
  assert.equal(del.length, 5); assert.equal(del[2].right, undefined); assert.equal(del[3].right?.n, 3);
  // new and deleted file
  const nf = alignFile([], ['a', 'b'], parseHunks('@@ -0,0 +1,2 @@\n+a\n+b\n'));
  assert.ok(nf.length === 2 && nf.every((r) => !r.left && r.right?.kind === 'add'));
  const df = alignFile(['a', 'b'], [], parseHunks('@@ -1,2 +0,0 @@\n-a\n-b\n'));
  assert.ok(df.length === 2 && df.every((r) => !r.right && r.left?.kind === 'del'));
});

test('codeView window, focus, marks', () => {
  const o = nums(12);
  const n = nums(12); n[5] = 'new6';
  const hunks = parseHunks('@@ -6 +6 @@\n-l6\n+new6\n');
  const v = codeView({ oldLines: o, newLines: n, hunks, at: 'head', lines: [5, 6], marks: [{ line: 6, text: 'm' }, { line: 99, text: 'gone' }] });
  assert.equal(v.rows[0].right?.n, 3);
  assert.equal(v.rows[v.rows.length - 1].right?.n, 8);
  assert.deepEqual(v.rows.filter((r) => r.focus).map((r) => r.right?.n), [5, 6]);
  assert.equal(v.added, 1); assert.equal(v.removed, 1); assert.equal(v.approximate, false);
  const mr = v.rows.find((r) => r.right?.n === 6);
  assert.deepEqual(mr?.marks, [{ side: 'right', text: 'm' }]);
  const b = codeView({ oldLines: o, newLines: n, hunks, at: 'base', lines: [6, 6], marks: [{ line: 6, text: 'm' }] });
  assert.equal(b.rows.find((r) => r.left?.n === 6)?.marks[0].side, 'left');
});

test('codeView clamp and empty', () => {
  const f = nums(20);
  const v = codeView({ oldLines: f, newLines: f, hunks: [], at: 'head', lines: [40, 50] });
  assert.deepEqual(v.lines, [20, 20]); assert.equal(v.approximate, true);
  const s = codeView({ oldLines: f, newLines: f, hunks: [], at: 'head', lines: [5, 6], show: [0, 99] });
  assert.equal(s.approximate, true); assert.equal(s.rows.length, 20);
  const e = codeView({ oldLines: f, newLines: [], hunks: [], at: 'head', lines: [1, 2] });
  assert.deepEqual(e.rows, []); assert.equal(e.approximate, true);
});

test('diffView', () => {
  const hs = parseHunks('@@ -1,3 +1,3 @@\n a\n-b\n+c\n d\n@@ -9 +9 @@\n-x\n+y\n');
  const all = diffView(hs);
  assert.equal(all.sections.length, 2); assert.equal(all.added, 2); assert.equal(all.removed, 2);
  assert.equal(all.sections[0].length, 3);
  const one = diffView(hs, [1, 7]);
  assert.equal(one.sections.length, 1); assert.equal(one.approximate, true);
  assert.equal(diffView(hs, [9]).sections.length, 2);
});
