import test from 'node:test';
import assert from 'node:assert/strict';
import { nonce, webviewHtml } from './html';

test('webviewHtml', () => {
  const h = webviewHtml({ cspSource: 'vscode-resource:', nonce: 'abc', scriptUri: 'u/a.js', styleUris: ['u/a.css'], title: '<script>&' });
  assert.ok(h.includes("default-src 'none'"));
  assert.ok(h.includes('style-src vscode-resource:'));
  assert.ok(h.includes("script-src 'nonce-abc'"));
  assert.ok(h.includes('font-src vscode-resource:'));
  assert.ok(h.includes('img-src vscode-resource: data:'));
  assert.ok(!h.includes('unsafe-inline'));
  assert.ok(h.includes('<script nonce="abc" src="u/a.js">'));
  assert.ok(h.includes('<link rel="stylesheet" href="u/a.css">'));
  assert.ok(h.includes('<div id="root" data-strings="'));
  assert.ok(h.includes('<html lang="en">'));
  const ds = /data-strings="([^"]*)"/.exec(h);
  assert.ok(ds && !ds[1].includes('<') && ds[1].includes('&quot;'));
  assert.ok(h.includes('<title>&lt;script&gt;&amp;</title>'));
});

test('nonce', () => {
  assert.match(nonce(), /^[0-9a-f]{32}$/);
  assert.notEqual(nonce(), nonce());
});
