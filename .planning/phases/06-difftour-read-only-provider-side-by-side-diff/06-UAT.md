---
status: testing
phase: 06-difftour-read-only-provider-side-by-side-diff
source: [06-01-SUMMARY.md, 06-02-SUMMARY.md]
started: 2026-11-04T12:55:48.354Z
updated: 2026-11-04T12:55:48.354Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Abrir código lado a lado
expected: |
  Clicar num link de arquivo, no ícone de abrir de um bloco de código ou apertar "o" abre um diff lado a lado base vs head nos SHAs do tour, já rolado até as linhas citadas.
awaiting: user response

## Tests

### 1. Abrir código lado a lado
expected: Clicar num link de arquivo, no ícone de abrir de um bloco de código ou apertar "o" abre um diff lado a lado base vs head nos SHAs do tour, já rolado até as linhas citadas.
result: [pending]

### 2. Arquivos novos, apagados e iguais
expected: Um arquivo novo, apagado ou sem mudança abre com o lado que falta (ou igual) claramente rotulado.
result: [pending]

### 3. Título e somente leitura
expected: A aba mostra BEFORE · base / AFTER · head e indica que é uma cópia somente leitura do tour. Não dá para editar, e o arquivo da sua pasta não muda.
result: [pending]

### 4. Voltar ao passo
expected: Com o arquivo aberto, dá para voltar ao passo pela status bar, pelo botão no título do editor ou com Esc, e ir para o passo anterior/próximo.
result: [pending]

### 5. Abas reutilizadas
expected: Andando por vários passos que abrem arquivos diferentes, as abas de preview são reaproveitadas em vez de acumular editores.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0

## Gaps

[none yet]
