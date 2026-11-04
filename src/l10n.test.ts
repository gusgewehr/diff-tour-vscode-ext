import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { format, t } from './l10n';

const root = process.cwd();
const readJson = (f: string) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith('.ts') && !p.endsWith('.test.ts') ? [p] : [];
  });
}
const placeholders = (s: string) => [...new Set(s.match(/\{\d+\}/g) ?? [])].sort().join();

test('format fills {N} and leaves missing args', () => {
  assert.equal(format('a {0} b {1}', 'x', 2), 'a x b 2');
  assert.equal(format('{0} {1}', 'x'), 'x {1}');
  assert.equal(t('n {0}', 3), 'n 3');
});

test('every t() literal has a pt-BR bundle entry with matching placeholders', () => {
  const bundle: Record<string, string> = readJson('l10n/bundle.l10n.pt-br.json');
  const re = /\bt\(\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g;
  const missing: string[] = [];
  for (const f of walk(path.join(root, 'src'))) {
    const src = fs.readFileSync(f, 'utf8');
    assert.ok(!/\bt\(\s*`/.test(src), `template literal passed to t() in ${f}`);
    for (const m of src.matchAll(re)) {
      const key = m[2].replace(/\\(['"\\])/g, '$1');
      if (!(key in bundle)) missing.push(key);
    }
  }
  assert.deepEqual([...new Set(missing)], []);
  for (const [k, v] of Object.entries(bundle)) assert.equal(placeholders(v), placeholders(k), k);
});

test('package.json %keys% exist in both nls files, which share a key set', () => {
  const en = readJson('package.nls.json');
  const pt = readJson('package.nls.pt-br.json');
  assert.deepEqual(Object.keys(en).sort(), Object.keys(pt).sort());
  const keys = [...fs.readFileSync(path.join(root, 'package.json'), 'utf8').matchAll(/"%([^%"]+)%"/g)].map((m) => m[1]);
  assert.ok(keys.length > 0);
  for (const k of keys) assert.ok(k in en, k);
});
