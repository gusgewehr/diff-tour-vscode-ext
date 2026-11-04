---
status: partial
phase: 08-flow-bar
source: [08-01-SUMMARY.md]
started: 2026-11-04T12:55:48.354Z
updated: 2026-11-04T12:55:48.354Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Barra de fluxo visível
expected: |
  Durante o tour, a barra de fluxo fica no painel inferior e continua visível mesmo com um diff de código focado.
awaiting: user response

## Tests

### 1. Barra de fluxo visível
expected: Durante o tour, a barra de fluxo fica no painel inferior e continua visível mesmo com um diff de código focado.
result: [pending]

### 2. Nós da barra
expected: Cada nó mostra seu tipo (new/changed/same/external); o nó atual fica destacado e sem cortar o texto, os visitados ficam esmaecidos, e o tooltip mostra o nome completo, "you are here" e os passos que mostram aquele arquivo.
result: [pending]

### 3. Clicar num nó
expected: Clicar num nó leva ao próximo passo que mostra o arquivo dele; se não houver (ou você já estiver lá), abre o arquivo somente leitura nas linhas do nó.
result: [pending]

### 4. Rótulo FLOW
expected: O rótulo FLOW fica destacado quando o passo atual corresponde a um nó do fluxo.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0

## Gaps

[none yet]
