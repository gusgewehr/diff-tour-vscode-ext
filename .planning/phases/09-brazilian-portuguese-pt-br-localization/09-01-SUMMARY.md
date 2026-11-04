---
phase: 09-brazilian-portuguese-pt-br-localization
plan: 01
subsystem: cli-i18n, settings
tags: [i18n, pt-BR]
requirements-completed: [L10N-01, L10N-02, L10N-03]
key-files:
  modified: [cli/internal/i18n/i18n.go, cli/internal/i18n/i18n_test.go, cli/internal/generate/generate.go, cli/cmd/tour/main.go, src/settings.ts, src/settings.test.ts]
completed: 2026-11-04
---

# Phase 9 Plan 01: pt-BR in the CLI and language setting

Fork CLI now speaks Brazilian Portuguese (PTBR lang, pt/pt-BR/pt_PT aliases, full message table, LLM language rule), and the extension's Auto language maps any pt* locale to 'pt-BR'.

Commits: fc5c793 (i18n), 125ed1f (prompt rule, help, settings).

Verified: go test ./internal/i18n ok; TestBuildPrompt/TestAskPromptLanguages ok; full `go test ./...` shows only the 7 baseline internal/generate failures; rebuilt cli/bin/tour.exe and `--json --lang pt-BR --count HEAD~1..HEAD` exits 0; settings tests pass.

## Deviations
None to the code. `npm run typecheck` / `npm test` currently fail only because of plan 09-02's in-progress `src/l10n.test.ts` (syntax errors); `src/settings.test.ts` was run alone and passes. cli/bin is untracked/ignored, so the rebuilt exe is not committed.

## Self-Check: PASSED
