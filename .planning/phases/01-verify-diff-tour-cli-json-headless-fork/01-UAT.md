---
status: complete
phase: 01-verify-diff-tour-cli-json-headless-fork
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md]
started: 2026-11-04T12:55:48.354Z
updated: 2026-11-04T12:55:48.354Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Documento do schema com tabela de gaps
expected: docs/tour-schema.md existe com a tabela de gaps contra o protótipo.
result: pass
evidence: "arquivo existe, 49 linhas de tabela"

### 2. Execução headless com JSONL
expected: tour.exe --json sem TTY imprime eventos JSONL v1 e um evento final.
result: pass
evidence: "`tour.exe --json --count HEAD~10..HEAD` retornou {'type':'count','v':1,'files':17,...}, exit 0; fixtures .progress.jsonl terminam em done"

### 3. Cancelar sem órfãos no Windows
expected: Fechar stdin cancela; nenhum claude.exe nem diretório de export fica para trás.
result: pass
evidence: "evidência registrada em cli/FORK.md — erro cancelled, 0 claude.exe, export removido; não reexecutado para não gastar LLM"

### 4. 3 tours reais como fixtures
expected: Pelo menos 3 tours reais válidos de mudanças com 10+ arquivos.
result: pass
evidence: "real-b146230 11 arquivos, real-9cbe3d2 14, real-9c18e24 16; todos version 1 com 6 capítulos"

### 5. Decisão do mapeamento flow → arquivo → passo
expected: Decisão escrita sobre como nós do flow mapeiam para arquivos e passos.
result: pass
evidence: "docs/decisions/flow-mapping.md existe; fork v7 adiciona file/lines"

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
