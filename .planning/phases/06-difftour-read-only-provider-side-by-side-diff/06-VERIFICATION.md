---
phase: 06-difftour-read-only-provider-side-by-side-diff
status: passed
verified: 2026-11-04
---

# Phase 6 verification

Checked by the orchestrator in autonomous mode. Evidence comes from typecheck, tests (57/57), smoke ("14 commands, 3 views, tour opened") and greps. No live VS Code run was done.

| Req | Evidence | Status |
|-----|----------|--------|
| CODE-01 | `openCode` calls `vscode.diff(left, right, title, {preview, selection})` at the meta base and head SHAs. A base-side reveal runs through the visible editors. | ✓ |
| CODE-02 | `planOpen` maps each status: A gets an empty left side, D an empty right side, and unchanged files a "same in" title. Unit-tested. | ✓ |
| CODE-03 | The `difftour-git` provider runs `git show <sha>:<path>` via execFile with no shell. Content-provider documents are read-only. The 2 MB/NUL guard is tested. | ✓ |
| CODE-04 | The title format is `<file> · BEFORE <base> ↔ AFTER <head> · read-only tour copy`. | ✓ |
| CODE-05 | `difftour.inTourCode` context, a "Back to step n" status item, editor/title back/prev/next buttons, and a scoped Esc keybinding. | ✓ |
| CODE-06 | `preview: true` reuses the preview tab. | ✓ |

**Accepted deviation:** there is no floating mini-player, lock icon or banner, because VS Code's API cannot place them over native editors.

**Not checked:** the real diff-open path in a live window. The fixture has no SHAs; cached tours from Phase 4 do have them.
