---
status: partial
phase: 04-cli-runner-writing-progress-tour-cache
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md]
started: 2026-11-04T12:55:48.354Z
updated: 2026-11-04T12:55:48.354Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Iniciar um tour (pré-requisito: difftour.cliPath = C:\Users\gusge\Documentos\GitHub\diff-tour-vscode-ext\cli\bin\tour.exe e Claude Code logado)
expected: |
  Ctrl+Alt+T → OTHER → "A range…" → digite HEAD~10..HEAD (17 arquivos). Aparece uma notificação de progresso com botão de cancelar, e você continua podendo editar arquivos enquanto ela roda.
awaiting: user response

## Tests

### 1. Iniciar um tour (pré-requisito: difftour.cliPath = C:\Users\gusge\Documentos\GitHub\diff-tour-vscode-ext\cli\bin\tour.exe e Claude Code logado)
expected: Ctrl+Alt+T → OTHER → "A range…" → digite HEAD~10..HEAD (17 arquivos). Aparece uma notificação de progresso com botão de cancelar, e você continua podendo editar arquivos enquanto ela roda.
result: [pending]

### 2. Writing view
expected: Abre a view de escrita com 4 cards de etapa (Export, Write, Check, Show) marcados como feito/ativo/pendente, um log READING NOW com o mais novo no topo (hora · ferramenta · caminho · tag) e o card EXPORT DIRECTORY.
result: [pending]

### 3. Tour pronto
expected: Depois de alguns minutos (custa ~US$2) aparece "Your tour is ready" e o tour abre ao escolher a opção.
result: [pending]

### 4. Reabrir pelo SAVED
expected: Ctrl+Alt+T → grupo SAVED → o tour que acabou de ser gerado abre na hora, sem notificação de progresso e sem chamar o LLM.
result: [pending]

### 5. Pular para o tour existente
expected: Ctrl+Alt+T → "A range…" → HEAD~10..HEAD de novo. Em vez de gerar outro, a extensão oferece "Skip to the tour" e abre o tour salvo.
result: [pending]

### 6. Cancelar
expected: Comece um tour de outra faixa (ex.: "A range…" → HEAD~20..HEAD~10) e clique em Cancel na notificação. A geração para, e no Gerenciador de Tarefas não sobra nenhum tour.exe ou claude.exe dessa execução.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0

## Gaps

[none yet]
