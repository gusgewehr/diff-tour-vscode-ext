import test from 'node:test';
import assert from 'node:assert/strict';
import { languageFromLocale, readSettings } from './settings';

const cfg = (o: Record<string, unknown>) => ({ get: <T>(k: string, d: T): T => (k in o ? (o[k] as T) : d) });

test('languageFromLocale', () => {
  assert.equal(languageFromLocale('ja'), 'ja');
  assert.equal(languageFromLocale('zh-cn'), 'zh');
  assert.equal(languageFromLocale('zh-tw'), 'zh-Hant');
  assert.equal(languageFromLocale('es-mx'), 'es');
  assert.equal(languageFromLocale('ru'), 'ru');
  assert.equal(languageFromLocale('pt-br'), 'en');
  assert.equal(languageFromLocale(''), 'en');
});

test('readSettings', () => {
  assert.equal(readSettings(cfg({ language: '' }), 'ja').language, 'ja');
  assert.equal(readSettings(cfg({ language: 'ru' }), 'ja').language, 'ru');
  assert.equal(readSettings(cfg({ minFiles: 0 }), 'en').minFiles, 1);
  assert.equal(readSettings(cfg({}), 'en').minFiles, 10);
  assert.equal(readSettings(cfg({}), 'en').llm, 'claude');
});
