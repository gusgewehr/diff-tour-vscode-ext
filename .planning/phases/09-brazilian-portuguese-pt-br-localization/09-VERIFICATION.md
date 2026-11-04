---
phase: 09-brazilian-portuguese-pt-br-localization
status: passed
verified: 2026-11-04
---

# Phase 9 verification

The orchestrator checked this phase in autonomous mode with typecheck, `npm test` (84/84), the smoke run ("14 commands, 3 views, flow bar view, tour opened") and `go test ./internal/i18n` (ok). The dist webviews contain 0 `innerHTML`. Nothing was checked visually in a pt-BR VS Code, and no real pt-BR tour was generated.

| Req | Evidence | Status |
|-----|----------|--------|
| L10N-01 | `i18n.PTBR = "pt-BR"` and `languageRules[PTBR]` exist. `tour.exe --json --lang pt-BR --count HEAD~1..HEAD` exits 0. | ✓ |
| L10N-02 | The full PTBR message table exists, and the i18n tests check every key. | ✓ |
| L10N-03 | `difftour.language` enum has pt-BR, and `languageFromLocale('pt-*')` returns 'pt-BR' (tested). | ✓ |
| L10N-04 | `package.nls.json` and `package.nls.pt-br.json` exist. Host strings go through `vscode.l10n.t`, and `l10n/bundle.l10n.pt-br.json` has 155 keys. `src/l10n.test.ts` checks coverage, placeholders and nls key parity. | ✓ |
| L10N-05 | `src/webview/strings.ts` is translated by the host and embedded as `data-strings`. `<html lang>` follows the display language. `strings.test.ts` checks it. | ✓ |

These stay in English: thrown errors in `tour/model.ts`, `tour/open.ts` and `git/blob.ts`, which appear only inside a translated wrapper; the output channel name; and product names.
