---
status: testing
phase: 03-small-change-rule
source: [03-01-SUMMARY.md]
started: 2026-11-04T12:55:48.354Z
updated: 2026-11-04T12:55:48.354Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Mudança pequena abre o diff padrão
expected: |
  Ctrl+Alt+T → OTHER → "A single commit…" → escolha o commit "fix: open and restore tours once the repo root is known…" (a486bf7, 2 arquivos). Nenhum LLM roda: o primeiro arquivo alterado abre direto no diff padrão do VS Code.
awaiting: user response

## Tests

### 1. Mudança pequena abre o diff padrão
expected: Ctrl+Alt+T → OTHER → "A single commit…" → escolha o commit "fix: open and restore tours once the repo root is known…" (a486bf7, 2 arquivos). Nenhum LLM roda: o primeiro arquivo alterado abre direto no diff padrão do VS Code.
result: [pending]

### 2. Lista de arquivos alterados
expected: Aparece a lista dos arquivos alterados com a letra M/A/D de cada um, e clicar em cada arquivo abre o diff padrão dele.
result: [pending]

### 3. Aviso e status bar
expected: Aparece o aviso "2 files changed. Changes under 10 files open in the standard diff, without a tour." com um link para a configuração, e a status bar mostra "No tour · 2 files (under 10)".
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0

## Gaps

[none yet]
