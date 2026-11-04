---
phase: 05-document-layout-outline-tree-tour-state
status: passed
verified: 2026-11-04
---

# Phase 5 verification

Checked by the orchestrator in autonomous mode. Evidence comes from typecheck, tests (50/50), smoke and greps. The smoke run ("11 commands, 3 views, tour opened") uses a mocked vscode and opens the real fixture `real-9c18e24.json`. It does not include a visual check in a live VS Code window.

| Req | Evidence | Status |
|-----|----------|--------|
| DOC-01 | `TourPanel` (`difftour.tour`) shows the title, step blocks and a fixed bottom nav. Smoke opens a real fixture | ✓ |
| DOC-02 | `difftour.outline` tree lists chapters → steps with pass-filled / play-circle / question icons, plus an "x of N understood" description | ✓ |
| DOC-03 | Prev/next with step titles, ← → keys (`keys.ts`), clickable ticks (`goto`) | ✓ |
| DOC-04 | U → `understood` intent → `toggleUnderstood` | ✓ |
| DOC-05 | N → note card. Notes persist in workspaceState, never in the repo | ✓ |
| DOC-06 | `StateStore` under `difftour.state.<id>`. Round-trip tested. Serializer restores `{id, path}` | ✓ |
| DOC-07 | CSS uses `--vscode-*` vars only, with light/dark/high-contrast body classes. System fonts, no network | ✓ |
| DOC-08 | No `innerHTML` anywhere in `src/webview/`. Inline tokenizer builds text nodes. `parseIntent` validates every message | ✓ |
| DOC-09 | `keyAction` returns nothing while typing, except Escape → blur. Unit-tested | ✓ |

Not checked: the visual layout in a real VS Code window.
