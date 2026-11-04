---
status: testing
phase: 05-document-layout-outline-tree-tour-state
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md]
started: 2026-11-04T12:55:48.354Z
updated: 2026-11-04T12:55:48.354Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Documento e outline
expected: |
  O tour gerado abre num painel com o título, os blocos do passo atual e uma barra de navegação fixa embaixo. Na view TOUR, o outline mostra capítulos → passos com ícones de feito/atual/pergunta/nota e "x of N understood".
awaiting: user response

## Tests

### 1. Documento e outline
expected: O tour gerado abre num painel com o título, os blocos do passo atual e uma barra de navegação fixa embaixo. Na view TOUR, o outline mostra capítulos → passos com ícones de feito/atual/pergunta/nota e "x of N understood".
result: [pending]

### 2. Navegação
expected: Os botões anterior/próximo, as setas ← → e os tiquinhos de progresso clicáveis mudam de passo.
result: [pending]

### 3. Entendido (U) e nota (N)
expected: U marca o passo como entendido (o outline e o contador atualizam). N abre uma nota privada para o passo, que fica salva.
result: [pending]

### 4. Estado persistente
expected: Feche o painel e reabra o tour pelo SAVED: ele volta no mesmo passo com entendidos, notas e palpites. Depois rode "Developer: Reload Window": o painel do tour é restaurado sozinho, no mesmo passo e com o código aparecendo.
result: [pending]

### 5. Temas
expected: Trocando entre tema escuro, claro e alto contraste, o painel acompanha as cores do VS Code.
result: [pending]

### 6. Atalhos não disparam ao digitar
expected: Digitando "u", "n" ou setas dentro da caixa de nota ou de palpite, nada muda de passo nem é marcado.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0

## Gaps

[none yet]
