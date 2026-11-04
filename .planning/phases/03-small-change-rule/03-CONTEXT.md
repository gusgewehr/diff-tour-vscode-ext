# Phase 3: Small-change rule - Context

**Gathered:** 2026-11-04
**Status:** Ready for planning
**Mode:** Autonomous. Claude made these decisions per user instruction (speed over polish, never ask the user).

<domain>
## Phase Boundary

Replace the `difftour.internal.openSmallChange(target)` stub from Phase 2 with the real behaviour. A change with fewer than `difftour.minFiles` files:
- calls no LLM and no CLI;
- opens the first changed file in the standard `vscode.diff`;
- shows the changed-file list;
- shows the notice and the status bar text.

</domain>

<decisions>
## Implementation Decisions

### File list
- `git diff --name-status -z -M <baseSha> <headSha>` gives a status (A/M/D/R) and path(s) per file. Parse it in `src/git/changes.ts` (add a function, unit-test the parser with a temp repo like the existing tests).
- File order: git's order. The first file is the "first changed file".

### Opening a file in the standard diff
- Use the built-in Git extension API: `vscode.extensions.getExtension('vscode.git')?.exports.getAPI(1).toGitUri(fileUri, ref)` for the left side (`baseSha`) and the right side (`headSha`). This gives native read-only git documents with no provider of our own.
- If the git extension is unavailable, fall back to a tiny read-only `TextDocumentContentProvider` on scheme `difftour-git`. It returns `git show <sha>:<path>` via execFile. Register this provider anyway, because added and deleted files need it.
- Added files (A): left side = `difftour-git:` URI that returns empty content. Deleted files (D): right side = empty. Renames (R): left uses the old path, right the new path.
- Command: `vscode.diff`, with left, right, the title `<path> (<base> ↔ <head>)`, and `{ preview: true }`.

### Changes list (SMALL-02)
- A tree view `difftour.smallChange`, titled "Small change", in the existing TOUR container.
  - Root node: `<base> ↔ <head>`.
  - Children: one per file, with `description` = status letter (M/A/D/R), the `resourceUri` set so file icons show, and a click command that opens that file's diff.
- The view is hidden via a `when` clause (`difftour.hasSmallChange`) until a small change is opened. Reveal it, and focus the TOUR container, when one opens.
- Also offer the native multi-file diff as a button on the root node: `vscode.changes` with a title and an array of `[resourceUri, leftUri, rightUri]`. Optional; skip if it complicates things.

### Notice and status bar (SMALL-03)
- `window.showInformationMessage("<N> files changed. Changes under <min> files open in the standard diff, without a tour.", "Open Settings")`. The button runs `workbench.action.openSettings` with `difftour.minFiles`. The `1 file` singular wording is fine to handle.
- Status bar item, left, priority low: text `$(git-compare) No tour · <N> files (under <min>)`. The tooltip explains the setting. Clicking it runs `difftour.tourChange`. The item stays until another change is picked or a tour starts. Expose `hide()` for Phase 4.

### Routing
- Phase 2 routing decides small vs tour from `target.files < minFiles`. Keep that logic and only implement the handler.
- Testability: keep the pure logic (name-status parsing, URI pair selection per status, message text) in plain modules with `node --test` tests. Keep the VS Code glue thin. Extend `scripts/smoke-activate.mjs` if the new view or command needs registration checks.

### Claude's Discretion
- File split, helper names.

</decisions>

<code_context>
## Existing Code Insights

- Phase 2 built these:
  - `src/git/changes.ts`: execFile git helper, target resolution, three-dot counts.
  - `src/pick.ts`, `src/views/changesTree.ts`, `src/extension.ts`: the internal commands are stubs.
  - `src/settings.ts`.
  - Tests use `node --test` with temp git repos.
  - `scripts/smoke-activate.mjs` uses a fake vscode module.
  - Build with `npm run build`, package with `npm run package`.
- Read the Phase 2 SUMMARY files for exact names.

</code_context>

<specifics>
## Specific Ideas

None beyond the spec text in REQUIREMENTS.md (SMALL-01..03).

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
