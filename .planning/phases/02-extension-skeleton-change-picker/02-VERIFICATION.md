---
phase: 02-extension-skeleton-change-picker
verified: 2026-11-04T00:00:00Z
status: passed
score: 8/8 requirements verified (static + smoke)
overrides_applied: 0
---

# Phase 2 Verification

**Goal:** Users can install the extension and pick a change to tour from a grouped list.

## Checks run
| Check | Result |
|---|---|
| npm run typecheck | clean |
| npm test | 12 pass / 0 fail |
| npm run build | ok (dist/extension.js) |
| npm run smoke | "smoke ok: 6 commands, 1 view" |
| npm run package | diff-tour.vsix, 6 files (package.json, readme, dist/extension.js, media/route.svg + vsce manifests) |
| TBD/FIXME/XXX/TODO in src | none |

## Requirements
| ID | Status | Evidence |
|---|---|---|
| PICK-01 | SATISFIED | `difftour.tourChange` command + keybinding ctrl+alt+t / cmd+alt+t in package.json; registered in src/extension.ts |
| PICK-02 | SATISFIED | src/pick.ts builds COMPARED WITH <base>, SAVED, OTHER (commit/range/file) groups as QuickPick separators |
| PICK-03 | SATISFIED (caveat) | `describeCount` gives "N files · tour / opens git diff", counted in parallel (mapLimit 6, qp.busy). The cost/time text ("A new tour takes 2 to 5 minutes...") is the QuickPick placeholder, not a footer; VS Code QuickPick has no footer API |
| PICK-04 | SATISFIED | REVIEW REQUESTED group added only when `listPrs` (gh) returns entries |
| PICK-05 | SATISFIED | `difftour` activity-bar container + `difftour.changes` view; ChangesTree over the same ChangeModel; smoke confirms view created |
| PICK-06 | SATISFIED | 5 `difftour.*` settings in package.json (language, llm default claude, minFiles default 10, cliPath, baseBranch); readSettings tested |
| PICK-07 | SATISFIED | routeTarget -> detectTools -> error notice naming what is missing with Open Settings / How to install |
| PICK-08 | SATISFIED (caveat) | VSIX builds without prompts and has the expected contents. `code --install-extension` was not run here |

All IDs in the PLAN frontmatter (01: 01-06; 02: 01-05,07; 03: 08,01,05) map to REQUIREMENTS.md; none orphaned. REQUIREMENTS.md checkboxes still show Pending and should be ticked.

## Caveats (not blockers)
- No live VS Code UI: QuickPick rendering, tree clicks and keybinding conflicts were checked statically only. ctrl+alt+t is not a default VS Code binding.
- internal.openSmallChange / startTour / openSavedTour are intentional stubs (info messages) for Phases 3-5.
- Multi-root workspaces use the first folder (documented shortcut in code).
