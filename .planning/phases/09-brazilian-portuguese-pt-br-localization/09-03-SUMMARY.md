---
phase: 09-brazilian-portuguese-pt-br-localization
plan: 03
subsystem: webview-l10n
tags: [l10n, pt-BR, webview]
requires: [09-02]
provides: [src/webview/strings.ts shared string table, data-strings embedding in webview HTML]
key-files:
  created: [src/webview/strings.ts, src/webview/strings.test.ts]
  modified: [src/webview/html.ts, src/webview/html.test.ts, src/l10n.test.ts, src/webview/writing.ts, src/views/flowBarView.ts, scripts/smoke-activate.mjs, l10n/bundle.l10n.pt-br.json, src/webview/writing/main.ts, src/webview/flow/main.ts, src/webview/tour/main.ts, src/webview/tour/dom.ts, src/webview/tour/blocks/*.ts]
decisions:
  - "The host maps the EN table through t() and embeds it as escaped JSON in data-strings on #root; webviews call applyStrings before first render. CSP unchanged."
metrics:
  tasks: 3
  completed: 2026-11-04
---

# Phase 9 Plan 03: Webview l10n Summary

One shared `EN` string table (about 80 keys) is translated on the host, embedded in `#root[data-strings]`, and read by the Writing, Tour and Flow webviews as `S.*`. `<html lang>` follows the display language. LLM tour content never goes through the table. pt-BR values are in the l10n bundle; a test covers every table value.

## Commits
- b83ae53 all three tasks (table, HTML embedding, webview and block renderers, bundle, tests). Done as one commit because the table needs every literal collected first.

## Deviations
- Tasks 1-3 committed together instead of three commits.
- No "x of N understood" counter exists in the webview code, so no key was added for it.
- Added src/webview/strings.test.ts (applyStrings and localized behavior).
- Made `Strings` mutable (`-readonly`) so applyStrings can assign.

## Verification
`npm run typecheck`, `npm test` (84 pass), `npm run build`, `npm run smoke` pass; dist/webview/tour.js has 0 `innerHTML`.

## Self-Check: PASSED
