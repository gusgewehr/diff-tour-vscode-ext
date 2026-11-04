---
phase: 09-brazilian-portuguese-pt-br-localization
status: decided
decided_by: orchestrator (autonomous mode, user asked for no questions)
---

# Phase 9 context: pt-BR localization

## Goal
The user wants diff-tour in Brazilian Portuguese: the tours the LLM writes, the CLI messages, and the whole extension UI.

## Decisions

### Fork CLI (cli/)
- Add `PTBR Lang = "pt-BR"` to `cli/internal/i18n/i18n.go`. Append it to `Langs`. `Name()` returns "Português (Brasil)".
- `Parse` accepts "pt-BR", "pt_BR", "pt-br" and bare "pt" (case-insensitive) as PTBR. `Detect` maps LANG/LC_* values that start with `pt` to PTBR.
- Add a full PTBR message table, translating every key the ES table has, in natural Brazilian Portuguese. Use "você" and avoid European Portuguese forms such as "ecrã", "ficheiro" or "utilizador".
- Add `languageRules[i18n.PTBR]` in `cli/internal/generate/generate.go`, modeled on the other entries. It tells the LLM to write all tour prose (titles, questions, paragraphs, notes) in Brazilian Portuguese and to keep code, identifiers and file paths unchanged.
- Do not bump PromptVersion. The language already feeds the cache key.
- Translate the headless error messages (`cmd/tour/headless.go`) through i18n only where they already go through i18n. The extension shows its own translated text for each error code, so the CLI's raw message is a secondary detail.
- Update the Go tests in `internal/i18n` if they iterate over Langs (for example, to check that every key exists).

### Extension language setting
- `src/settings.ts`: add 'pt-BR' to the `Language` type and `LANGS`. `languageFromLocale` maps any locale that starts with `pt` to 'pt-BR'.
- `package.json` `difftour.language` enum: add "pt-BR" with enumDescription "Brazilian Portuguese".
- The tour language passed to the CLI (`--lang`) stays separate from the UI language. The UI follows `vscode.env.language`, which is the VS Code standard.

### Extension host UI (L10N-04)
- Static contributions: change package.json titles and descriptions (commands, views, view containers, configuration) to `%key%` placeholders. Add `package.nls.json` (English) and `package.nls.pt-br.json`.
- Runtime strings: wrap every user-facing literal in `src/**` (notifications, QuickPick titles/placeholders/items, tree items, status bar, error messages in `src/cli/errors.ts`, small-change notice, missing-tool messages) in `vscode.l10n.t('English text', ...args)`. Use `{0}` placeholders for values.
- Add `"l10n": "./l10n"` to package.json, plus `l10n/bundle.l10n.pt-br.json`. Its keys are the exact English strings, with pt-BR values. `@vscode/l10n-dev` is not needed: write the bundle by hand. A small node test checks that every `l10n.t('...')` literal in `src/` has a key in the pt-BR bundle.
- Pure modules that tests import outside VS Code, which have no `vscode` import (e.g. `src/small/logic.ts`, `src/cli/errors.ts`, `src/git/changes.ts` describeCount): keep them vscode-free. Either translate at the call site in vscode-aware code, or have them take a translate function `t` (default identity). Never import `vscode` into a module that `node --test` loads.
- Keep `.vscodeignore` shipping `package.nls*.json` and `l10n/**`.

### Webviews (L10N-05)
- The webviews (`src/webview/{writing,tour,flow}`) are plain TypeScript DOM code with no access to `vscode.l10n`. The host builds a string table and sends it to the webview. Use one shared table module (e.g. `src/webview/strings.ts`) that exports the English defaults as a typed object. The host fills it via `vscode.l10n.t` and passes it in the initial HTML (a JSON `data-` attribute or a JSON script tag with the nonce) or in the first message.
- The strings to cover:
  - Writing view: stage names Export/Write/Check/Show, READING NOW, EXPORT DIRECTORY, Cancel, Skip to the tour
  - Tour document: nav buttons, the "x of N understood" counters, the note card, the "Stop and predict before you go on" card, Show the answer, basis tags (Verified / From the code / Senior view), "Not in this repository", Copy, approximate badge, not-found messages, BEFORE/AFTER labels, unknown-block fallback
  - Flow bar: FLOW, you are here, and similar labels
- Tour content from the LLM is not translated. It is already in the tour's language.

### Tests and checks
- Go: `go test ./internal/i18n/...` passes, and `tour --json --lang pt-BR --count HEAD~1..HEAD` exits 0. `go build` works.
- Node: `npm run typecheck`, `npm test` and `npm run smoke` pass. Add tests for languageFromLocale('pt-br') → 'pt-BR' and for bundle key coverage.
- The 7 pre-existing Windows failures in `internal/generate` are baseline and must not get worse.

## Out of scope
- Other new languages
- Translating tour fixtures
- Generating a real pt-BR tour (it costs LLM money; optional for the verifier)
- Release and version bump: the orchestrator does these after the phase passes

## Plan shape
At most 3 plans:
1. CLI fork pt-BR, plus the extension language setting
2. Extension host l10n (package.nls and runtime strings)
3. Webview string table

Plans 1 and 2 can run in parallel. Plan 3 depends on plan 2, because it reuses the l10n bundle.
