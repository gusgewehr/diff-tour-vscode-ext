# Phase 6: difftour: read-only provider + side-by-side diff - Context

**Gathered:** 2026-11-04
**Status:** Ready for planning
**Mode:** Autonomous. Claude made these decisions per user instruction (speed over polish, never ask the user).

<domain>
## Phase Boundary

Replace the `difftour.internal.openCode({tourId, file, at, lines})` stub from Phase 5, so that every code reference in a tour opens as a read-only side-by-side `vscode.diff` at the toured SHAs. This covers:
- code blocks
- file links (`openFile{file,line,at}`)
- the `o` key
- `step.open`

From an open diff, the user can go back to the step and step prev/next.

</domain>

<decisions>
## Implementation Decisions

### Provider: build `difftour:` on top of Phase 3
- Generalise the Phase 3 `difftour-git` content provider in `src/small/smallChange.ts` into a shared module, `src/git/contentProvider.ts`. Keep a single provider for the whole extension. Do not add a second scheme.
  - URI: `difftour-git:/<path>?sha=<fullsha>&cwd=<root>`. The real filename stays last in the path, so VS Code detects the language.
  - Content comes from `git show <sha>:<path>` via execFile. Never use a shell, never touch the working tree, never use text from the LLM reply.
  - Empty URI (`?empty=1`) for the missing side.
  - Size guard: if the blob is over 2 MB or contains a NUL byte, return a one-line placeholder: "(binary or large file not shown)".
- Content-provider documents are read-only by nature. Use only this provider for tours, not the git extension's `toGitUri`, so content is always tied to the toured SHA.
- Small-change mode (Phase 3) may keep using `toGitUri`.

### openCode
- Resolve `baseSha` and `headSha` from the active session's meta. Phase 5 stores both.
- Look up the file's change status from `listChangedFiles(baseSha, headSha)`, cached per session. The statuses are A/M/D/R/unchanged.

| Status | Left side | Right side | Title |
|---|---|---|---|
| A (new) | empty | head | `<file> · BEFORE <base> (did not exist) ↔ AFTER <head> · read-only tour copy` |
| D (deleted) | base | empty | `… AFTER <head> (deleted)` |
| unchanged | base | head | `<file> · same in <base> and <head> · read-only tour copy` |
| changed | base | head | `<file> · BEFORE <base> ↔ AFTER <head> · read-only tour copy` |

- Renamed files use the old path on the left.
- Command: `vscode.diff(left, right, title, { preview: true, preserveFocus: false, selection })`. `selection` is a `Range(lines[0]-1, 0, lines[1]-1, 0)` and applies to the right/modified side.
- When `at === 'base'`, after the diff opens, find the visible text editor whose document URI equals the left URI (`window.visibleTextEditors`). Set its selection, then call `revealRange(range, TextEditorRevealType.InCenter)`. If it can't be found within about 300 ms, accept the right-side reveal and log it.
- If the file does not exist at the requested SHA, show the warning "<file> is not in <ref> at this commit" and do nothing else.
- CODE-06: `preview: true` reuses the preview tab while stepping.

### Webview wiring
- The `openCode{block index}` intent from the Phase 5 webview resolves the step's code block (`file`, `at`, `lines`) on the host and calls `openCode`.
- The `openFile{file,line,at}` intent calls `openCode` with `lines=[line,line]`.
- The `o` key calls `step.open` if it is set, otherwise the first code or diff block.
- `diff` blocks open with `at: head`, revealed at the first hunk's line.

### Back to step (CODE-05)
- Context key `difftour.inTourCode`. It is true when the active editor's document URI scheme is `difftour-git` and a tour session is active. Update it on `onDidChangeActiveTextEditor`.
- Status bar item `$(arrow-left) Back to step n`, visible while `inTourCode`. Clicking it reveals the tour panel.
- `editor/title` menu buttons, gated on `difftour.inTourCode`:
  - `difftour.backToStep` (`$(arrow-left)`)
  - `difftour.prevStep` (`$(chevron-left)`)
  - `difftour.nextStep` (`$(chevron-right)`)
- Prev and Next move the session and then reveal the panel.
- Esc keybinding for `difftour.backToStep`, with when clause `difftour.inTourCode && editorTextFocus && !editorHasSelection && !findWidgetVisible && !suggestWidgetVisible && !inSnippetMode`.

### Not possible / accepted deviations
- There is no floating mini-player, no lock icon and no banner over native editors. The read-only status and provenance appear in the diff title and the status bar instead. Record this in the SUMMARY.

### Tests
Use `node --test` for the pure parts:
- the status → sides/title mapping
- the URI build and parse round-trip
- the size/NUL guard
- block → openCode argument resolution, using fixture steps

Extend `smoke-activate.mjs` with the new commands and the menus. Reinstall the VSIX.

### Claude's Discretion
- File split and helper names.

</decisions>

<code_context>
## Existing Code Insights

- `src/small/smallChange.ts` holds the current `difftour-git` provider (`SCHEME = 'difftour-git'`, query `sha` and `cwd`, `empty=1`). Move it to a shared module, and keep the Phase 3 behaviour and tests passing.
- `src/git/changes.ts` has `listChangedFiles` and `parseNameStatus`.
- Phase 5 adds `src/tour/session.ts` (TourSession, meta with SHAs), `src/webview/tourPanel.ts` (intents) and the `difftour.internal.openCode` stub. Read the Phase 5 SUMMARY files for exact names.

</code_context>

<specifics>
## Specific Ideas

- Design references: spec section 5, "Open code", and `docs/handoff/screenshots/09-open-file-readonly-diff.png`.

</specifics>

<deferred>
## Deferred Ideas

- The floating mini-player and provenance banner. They are not possible over native editors.

</deferred>
