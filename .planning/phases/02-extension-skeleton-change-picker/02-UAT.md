---
status: testing
phase: 02-extension-skeleton-change-picker
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md]
started: 2026-11-04T12:55:48.354Z
updated: 2026-11-04T14:00:11.450Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 2
name: Contagem de arquivos e rodapé
expected: |
  Num repositório que tenha alguma branch além da principal, cada branch mostra "N files · tour" ou "N files · opens git diff" (primeiro aparece "counting…"). O texto do campo diz que um tour novo leva 2 a 5 minutos e um salvo abre na hora sem custo.
awaiting: user response

## Tests

### 1. Abrir o picker
expected: Rode "Developer: Reload Window" para carregar o VSIX recém-instalado. Com a pasta diff-tour-vscode-ext aberta, Ctrl+Alt+T (ou paleta: "diff-tour: Tour a change") abre um QuickPick com os grupos COMPARED WITH master, SAVED e OTHER. Como você está na master, o primeiro item avisa "You are on master. Pick another branch, a commit or a range."
result: pass

### 2. Contagem de arquivos e rodapé
expected: Num repositório que tenha alguma branch além da principal, cada branch mostra "N files · tour" ou "N files · opens git diff" (primeiro aparece "counting…"). O texto do campo diz que um tour novo leva 2 a 5 minutos e um salvo abre na hora sem custo.
result: [pending]

### 3. View TOUR na activity bar
expected: Há um ícone de rota na activity bar. Ao clicar, a view TOUR lista os mesmos grupos do picker. O grupo REVIEW REQUESTED só aparece se o gh estiver instalado, logado e houver PRs pedindo sua revisão.
result: [pending]

### 4. Configurações e aviso de CLI ausente
expected: Em Settings, buscando "difftour", aparecem idioma, LLM, minFiles, caminho do CLI e base branch. Com difftour.cliPath apontando para um arquivo que não existe, escolher uma mudança de 10+ arquivos mostra um erro claro com os botões "Open Settings" e "How to install".
result: [pending]

### 5. VSIX instalado no Windows
expected: A extensão difftour.diff-tour@0.1.0 está instalada e ativa.
result: pass
evidence: "reinstalada com `code --install-extension diff-tour.vsix --force`; `code --list-extensions` mostra difftour.diff-tour@0.1.0"

## Summary

total: 5
passed: 2
issues: 0
pending: 3
skipped: 0

## Gaps

[none yet]
