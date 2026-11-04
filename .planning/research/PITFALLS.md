# Domain Pitfalls

**Domain:** VS Code extension wrapping an LLM-driven git-diff tour CLI (diff-tour, Go), developed on Windows 11
**Researched:** 2026-11-03
**Confidence:** MEDIUM overall. The upstream facts come from the diff-tour README (fetched today). The VS Code and Windows behaviours come from well-known platform behaviour I know from training and did not re-verify against current docs. Items marked (verify) need a 5-minute spike.

Phase numbers follow the spec's build order. P1 = verify/fork CLI JSON. P2 = skeleton, QuickPick, <10 files rule. P3 = CLI runner and progress. P4 = Document Webview, outline, state. P5 = `difftour:` provider and diffs. P6 = Webview blocks. P7 = flow bar.

## Critical Pitfalls

### 1. The upstream `tour` is a TUI with no headless mode, so the fork is bigger than "add a flag"
**What goes wrong:** The README documents only `--dump`, `--plain`, `--cols` and `--rows`, which render steps as text. It documents no JSON output and no progress events. `tour <branch>` generates and then opens the TUI. Spawned without a TTY, a Bubble Tea-style TUI may fail, hang waiting for input, or write ANSI escape sequences. The README does not say which TUI library it uses (verify in the source).
**Why it happens:** The generation pipeline in `internal/generate/` is probably coupled to the UI model, and nothing needs a machine interface yet.
**Consequences:** If the extension parses `--dump` text or scrapes ANSI output, every later phase breaks.
**Prevention:** In P1 add a `tour generate --json --progress=jsonl <range>` subcommand to the fork. It must:
- bypass the TUI entirely, with no TTY check and no raw-mode attempt;
- write progress events as one JSON object per line on stdout, or on stderr if stdout carries the result;
- write the final tour either to a file whose path is printed in a final event, or as a single final JSON line;
- use distinct exit codes for cancelled, validation failed, LLM failed and no changes.
Prefer "write the tour to a path and emit `{event:'done', path}`". This avoids the 64 KB pipe and partial-line problems with large tours.
**Detection:** Running `tour <range>` from a script with piped stdio hangs or prints escape codes.
**Phase:** P1.

### 2. The CLI has not been tested on Windows, and it spawns `claude` itself
**What goes wrong:** The upstream README says "not tested on Windows yet". The CLI launches `claude -p --tools Read,Grep,Glob --permission-mode dontAsk --no-session-persistence` with the export directory as cwd.
- On Windows `claude` may resolve to `claude.exe`, `claude.cmd` or an npm shim. Go's `exec.Command` does not run `.cmd` files the way a shell does. Go also blocks relative-path lookups (`ErrDot`) and may handle `.cmd` argument escaping differently.
- Path separators in the export directory, `git archive` piping, and symlinks in `base/` and `head/` can all fail on Windows.
- Prompt delivery (argv or stdin) hits the Windows command-line limit of about 32 K characters if the prompt is large.
- The cache path `%LocalAppData%\tour\...` may exceed MAX_PATH in `base/` and `head/` for deep repos.
**Prevention:** Make "run the fork end to end on Windows with Claude Code, producing a valid tour from a real 10+ file change" the P1 exit gate, before any extension code. Fix in the fork:
- `exec.LookPath` plus explicit `.cmd` handling;
- stdin for the prompt;
- forward-slash normalization of paths in the tour JSON (see pitfall 8).
**Detection:** Generation fails with "executable not found" or an empty tour. The `git archive` tar extraction fails.
**Phase:** P1. Re-test in P3.

### 3. The tour JSON schema is invented in the prototype, and the real CLI does not produce it
**What goes wrong:** The fields `code.at`, `show`, `marks`, `basis`, `weight`, `flow.nodes`, `flowNodes`, `snippet` and `question` are prototype assumptions. The README does not name a schema file. If the Webview renderer is built against the prototype's `tour-data.js`, it will break on real tours.
**Consequences:** Phases 4, 6 and 7 each rework their renderers. The flow bar (P7) has no data source.
**Prevention:**
- In P1 diff the real tour examples in the upstream `tours/` directory against `tour-data.js` and write a gap table.
- Add every missing field to the fork's prompt and validator, or derive it. For flow, derive node-to-step from the steps whose code blocks reference the node's file, as the spec itself suggests.
- Write a JSON Schema (or zod) and validate on load in the extension. Unknown block types must render as a visible "unsupported block" fallback and never throw.
- Version the schema with `schemaVersion` and refuse tours with a newer one.
- Test with both the prototype fixture and at least 3 real generated tours.
**Detection:** The renderer throws on `undefined.lines`. Blocks silently vanish.
**Phase:** P1 (schema), P4 and P6 (tolerant renderer).

### 4. LLM line references drift or are wrong
**What goes wrong:** The LLM cites `src/db.ts` lines 40-52 against the wrong side (base vs head), or off by a few lines, or cites files not in the diff. Upstream validates that files and lines exist and retries at most twice, but "exists" does not mean "is the right code".
**Why it happens:** The LLM sees `change.diff` with hunk-relative numbers and `base/` and `head/` trees. Line numbers in LLM prose are unreliable. CRLF files and trailing newlines shift counts.
**Consequences:** The diff opens at the wrong lines. The reviewer trusts the wrong code. This breaks the core value ("the exact code the tour talks about").
**Prevention:**
- At load time, re-validate every `code` reference in the extension with `git cat-file -e <sha>:<path>` and a line-count check. Clamp the ranges, and badge an unverifiable reference "location approximate" instead of failing the tour.
- Where the block carries a quoted line, verify the text and snap to the nearest match within ±N lines. This needs the fork to emit an `anchor` text per reference.
- `at: "head"` for a deleted file, or `at: "base"` for an added file, must fall back to the other side. Do not crash.
- Validate that `at` agrees with the file status (A, D, M, R).
**Detection:** A "Back to step" jump lands on blank or unrelated code. `git show` fails with "path exists on disk, but not in <sha>".
**Phase:** P1 (validator and prompt), P5 (clamp and fallback).

### 5. Process spawning on Windows from the extension host
**What goes wrong:**
- `child_process.spawn('tour')` fails with ENOENT if the binary is `tour.exe` outside the extension host's PATH. A VS Code launched from the Start menu does not inherit PATH edits made after login, and does not inherit a PowerShell profile.
- `.cmd` shims (npm-installed `claude.cmd`, `gh.cmd`) cannot be spawned without `shell: true`. Since the Node security fixes of 2024 (CVE-2024-27980), spawning `.bat` or `.cmd` without `shell: true` throws EINVAL. With `shell: true`, args are concatenated unquoted. Paths with spaces (`C:\Users\First Last\...`) and branch names containing `&`, `^`, `%` or `"` break or inject.
- `child.kill()` on Windows kills only the immediate process. `tour` then leaves `claude` and `git` running and burning tokens after Cancel.
- Output arrives with CRLF and chunk boundaries that split lines, so naive `split('\n')` leaves `\r` or partial JSON.
**Prevention:**
- Use `execFile`/`spawn` with an args array and `shell: false` against resolved `.exe` paths. Our own binary (the forked `tour.exe`) is the only thing we spawn directly, so ship or require an absolute `difftour.cliPath` setting and resolve it once at activation with a clear error.
- Never build shell command strings from branch names. Call git with args arrays and put `--` before refs and paths.
- Cancel: run `taskkill /pid <pid> /T /F` on Windows (or the `tree-kill` package). Wire it to `CancellationToken.onCancellationRequested`. Better, make the fork's `tour` handle a close of stdin or SIGINT by cancelling its own child tree, using a Windows Job Object or `CREATE_NEW_PROCESS_GROUP`.
- Use a line buffer for stdout: accumulate chunks, split on `/\r?\n/`, keep the remainder, and flush on `close`.
- Set `windowsHide: true`. Pass `env` explicitly, because the `claude` login lives in the user profile.
- Handle both the `exit` and `close` events (close fires after streams drain), and handle `error` for spawn failures.
**Detection:** Cancel leaves `claude.exe` in Task Manager. ENOENT when VS Code is launched from the Start menu but not from a terminal. EINVAL on a `.cmd`.
**Phase:** P3. Also P2 for git calls.

### 6. `git show <sha>:<path>` on Windows paths, encodings, binary files and large files
**What goes wrong:**
- Paths must be repo-relative with forward slashes. A URI `fsPath` gives `c:\repo\src\a.ts`, which makes `git show sha:c:\repo\...` fail. Drive-letter case also differs between `c:` and `C:`.
- `core.quotepath` escapes non-ASCII filenames as `"\303\251.ts"` in `--name-only` output, so the paths do not round-trip.
- `core.autocrlf` and `.gitattributes` do not apply to `git show` blobs. The content is the stored LF form, but the working copy is CRLF. The prototype's line numbers are stable, but diffs against a working-tree file will show every line changed. Never mix the two.
- Output decoded as UTF-8 by default corrupts UTF-16, Shift-JIS or Latin-1 files. A BOM leaks into the first line. This matters because the project targets Japanese users (the upstream is Japanese).
- Binary and large blobs (images, lockfiles, 10 MB generated files) get dumped into a text document and freeze the extension host. `execFile` defaults to `maxBuffer` 1 MB and kills the child with ERR_CHILD_PROCESS_STDIO_MAXBUFFER.
- Renames: the base path differs from the head path.
- Submodules and symlinks show as mode 160000 or 120000 and give odd content.
**Prevention:**
- Use `git -c core.quotepath=false` and `-z` for all name lists. Always normalize with `path.posix`.
- Collect stdout as `Buffer[]` and decode with `TextDecoder('utf-8', {fatal:false})`. Strip the BOM.
- Set `maxBuffer` explicitly (for example 20 MB) and check `git cat-file -s <sha>:<path>` first. Above about 2 MB, or if the blob contains a NUL byte in the first 8 KB, show the placeholder text "Binary or large file not shown" and never render it.
- Use `--name-status -M` for renames and carry both the old and new paths in the URI query (`path`, `oldPath`).
- Use the full 40-character SHA in URIs, never a branch name, so the content is immutable.
- Resolve the repo root with `git rev-parse --show-toplevel` and run every git command with that `cwd`. Multi-root workspaces need the repo root in the URI query too.
**Detection:** Garbled characters in Japanese comments. The extension host freezes on a big file. `fatal: path 'x' exists on disk, but not in 'sha'`.
**Phase:** P2 (name lists, counting), P5 (show).

### 7. Counting files with the wrong diff form
**What goes wrong:** The spec says `git diff --name-only <base>...<head>`. Pitfalls:
- Three-dot is `merge-base(base, head)..head`, which is correct for "what this branch adds". Two-dot against a `main` that has moved on shows the other side's changes too, so the file count is inflated. This counts differently from what the tour LLM actually sees, if the CLI uses two-dot or `base..head` semantics, giving a mismatch between "14 files · tour" and the tour content.
- The `base...head` form is wrong for an explicit `a..b` range typed by the user, where the user means two-dot.
- A local `main` that is stale vs `origin/main` gives a wrong merge-base. Branches with no common ancestor cause errors.
- "Current branch (+uncommitted)": three-dot ignores the working tree. Uncommitted work needs a separate path, and the read-only provider can only serve commits (a dirty tree has no SHA). Decide in P1 whether uncommitted changes are in scope (recommend: committed only in v1, and show the uncommitted count as informational).
- Renames count as 1 file with `-M` and 2 without. Mode-only changes and binary files count. Generated files and lockfiles inflate the count past 10 and trigger an expensive LLM run for a tiny change.
**Prevention:**
- Resolve once: `base = git merge-base <baseRef> <head>`, then store both resolved SHAs (`baseSha`, `headSha`) in the tour identity. Count with `git diff --name-only -z -M <baseSha> <headSha>`. Ensure the CLI fork is called with the same resolved SHAs, so count and tour agree.
- Prefer `origin/<default>` when it exists, and show the actual base ref in the QuickPick detail.
- Use `git rev-parse --verify --quiet` and handle shallow clones (merge-base fails: surface the "fetch more history" error).
- Make the count exclude nothing silently in v1, but expose it in the detail line ("14 files, 2 lockfiles").
**Detection:** The QuickPick says 3 files and the tour mentions 12. A merge-base failure with exit code 1.
**Phase:** P1 (decide semantics), P2 (implementation).

### 8. Cache and tour identity: keys, staleness, path length
**What goes wrong:** The spec caches to `globalStorageUri/tours/<repo>/<base>..<head>.json`. Branch names contain `/` and are illegal or nested in a filename. Windows forbids `: * ? " < > |` and reserved names. Keys built from branch names go stale when the branch moves. State in `workspaceState` becomes keyed to the wrong tour.
**Prevention:** Key by `sha256(repoRootRealpath + baseSha + headSha + language + schemaVersion)` truncated to 16 hex characters. Keep the human label inside the JSON. A saved-tour entry shows "stale: branch has moved N commits" by comparing the stored `headSha` with the current ref. Also use `fs.realpath` and lowercase the drive letter before hashing.
**Phase:** P3.

## Moderate Pitfalls

### 9. Virtual documents and `vscode.diff`
**What goes wrong:**
- Language detection comes from the URI path extension. If the URI is `difftour:/<sha>/src/a.ts` it works. If the path is only the query, or has no extension, there is no highlighting. A path ending in the SHA gives plaintext.
- Different URIs for base and head with the same path give an ambiguous editor tab title. Pass the title argument.
- `selection` in the options applies to the **modified** (right) side only. A reference with `at: "base"` needs to be revealed on the left, which `vscode.diff` cannot do directly. Fallback: open with the selection on the right side (aligned by the diff) or reveal via `vscode.window.activeTextEditor` on the original side after the diff opens (verify).
- A `TextDocumentContentProvider` has no concept of read-only badges. The `difftour:` scheme documents are read-only by default (they cannot be saved), but typing is still silently allowed or blocked depending on the version. Do not rely on editing being impossible for the "lock" icon. Check the `files.readonlyInclude` setting or `workspace.fs` file system provider with `isReadonly` if a real lock is needed (a `FileSystemProvider` registered with `{isReadonly: true}` gives the lock icon; a content provider does not). Decide in P5.
- Caching: VS Code caches the provider document by URI. With SHA-based URIs the content is immutable, so caching is fine and no `onDidChange` is needed. Using a ref name or "HEAD" in the URI would show stale content forever.
- A new file shows `base` as an empty document: return an empty string for the missing side, using a dedicated `difftour-empty:` URI or a query flag. Do not let `git show` error, or the diff editor displays a failure.
- Each open of a diff tab piles up tabs. Use `preview: true` and the same title so that stepping through a tour does not open 40 tabs.
- `vscode.diff` opens in the active group and steals focus from the Webview, losing keyboard focus for ← →. Pass `preserveFocus` and `viewColumn: ViewColumn.Beside`.
**Prevention:** Build the URI helper once: `Uri.from({scheme:'difftour', path:'/' + posixPath, query: new URLSearchParams({sha, repo}).toString()})`. Keep the real filename as the last path segment. Test with a `.ts`, a `.py`, a renamed file, an added file and a deleted file.
**Phase:** P5.

### 10. Webview CSP, fonts, theming, lifecycle
**What goes wrong:**
- A strict CSP (`default-src 'none'`) blocks inline scripts and styles. Fonts load from `webview.asWebviewUri` only if `font-src ${webview.cspSource}` is set, and `localResourceRoots` includes the extension's `media`/`dist` folder. Missing either gives a silent fallback to a system font and a console error that only shows in the Webview developer tools.
- Inline `style="..."` attributes are blocked unless `style-src 'unsafe-inline'` is allowed. The prototype uses many inline styles. Prefer classes and CSS variables, or allow `'unsafe-inline'` for style only (acceptable, as scripts stay nonce-locked).
- Tour content is LLM-generated. Rendering it with `innerHTML` is an XSS vector, and with a script-capable Webview it can reach `postMessage` to the extension, which can open files. Escape everything, parse Markdown with a sanitizer, and validate every message from the Webview (file paths must exist in the tour, never open an arbitrary path).
- Colors in `oklch()` from the prototype ignore the user's theme. Use `--vscode-*` variables with light/high-contrast fallbacks. Check `body.vscode-light` and `vscode-high-contrast`. Do not hard-code the dark tokens.
- State loss: with `retainContextWhenHidden: false` (default) the Webview DOM is destroyed whenever its tab is hidden, losing scroll position, the unsent "guess" textarea and note text. `retainContextWhenHidden: true` costs memory and is not restored after a VS Code restart. Prefer re-rendering from extension-side state (`workspaceState`), persisting notes and guesses on every `input` event (debounced), and implementing a `WebviewPanelSerializer` for restore across restarts.
- Messages posted before the Webview script is ready are lost. Send an initial `ready` message from the Webview and respond with the state.
- Keyboard: ← → U N o Esc inside a Webview only fire when the Webview has focus. When a diff editor has focus, VS Code keybindings win. Plain letters (U, N, o) must be ignored when the focus is in a textarea or input (notes and guess), or the user cannot type those letters. Esc inside a Webview does not close the VS Code editor, and ← → conflict with text caret movement in textareas. Contributed keybindings need `when` clauses, for example `difftour.active && !inputFocus` for global ones and `activeWebviewPanelId == 'difftour.tour'` for the Webview. Check for modifier keys (`ctrl`, `alt`, `meta`) and ignore them.
- Custom Material Symbols and Google Fonts links fail offline. Use Codicons (`@vscode/codicons`, bundled) and the editor font variables. If bundling IBM Plex, Newsreader and Fira Code, check each license and file size (a VSIX of a few MB is fine, but subset to Latin plus Japanese is not realistic: use `--vscode-font-family` fallback for CJK, and keep the serif stack with a CJK fallback).
**Prevention:** Build the CSP and `localResourceRoots` in a single helper in P4 and add a nonce. Add a smoke test that loads the panel with Webview developer tools open and has zero CSP violations.
**Phase:** P4 (CSP, state, keys), P6 (themes, fonts).

### 11. `workspaceState` size and keying
**What goes wrong:** `workspaceState` is a key-value store backed by SQLite, serialized as JSON. There is no hard documented limit, but large values slow activation and `update` is asynchronous. Storing whole tours, or long notes per step across many tours, bloats it. State for tours never cleans up. It is also per workspace, so a tour of a repo opened from a different folder loses the progress, and the workspace's state does not follow the repo clone.
**Prevention:** Store only the small per-tour state (`step`, `done`, `visited`, `notes`, `guesses`) under `difftour.state.<tourKey>`, keep tours as files in `globalStorageUri`, cap note length, and prune entries older than N days or to the latest 50 tours. Await `update()` before the extension deactivates, and debounce writes. Keep `pendingComments` out of v1. If notes must survive a workspace change, put them in a JSON file next to the cached tour instead (the spec says "saved next to the tour").
**Phase:** P4.

### 12. Progress UI vs a log that may never arrive
**What goes wrong:** The 4 stage cards and READING NOW log need events (stage, tool, path, tag). Claude Code's `-p` may need `--output-format stream-json --verbose` to expose tool calls. If the fork does not pass it, the progress log is empty. The tags NOT IN DIFF and BASE require the fork to compare the path with the diff.
**Prevention:** Make P1 decide the event contract (`stage`, `tool`, `path`, `tag`, `retry`, `error`, `done`). Provide a fallback: when no tool events arrive, show only the stage cards with a spinner and an elapsed timer. Do not fake the log.
**Phase:** P1, P3.

### 13. Long-running generation, lifecycle, and orphaned state
**What goes wrong:** Generation takes 2-5 minutes. The user closes the Webview or VS Code, so the process is orphaned or its result is lost. Two tours get started at once for the same range. The export dir under `%LocalAppData%\tour\` is not cleaned if the process is killed (it is deleted "once the tour is written").
**Prevention:** One in-flight job per tour key (reject or attach). Deactivate cleanup kills the process tree. Write the result atomically (temp file plus rename) so a half-written JSON is never read. Run a startup sweep for stale export directories (older than 1 day). Surface the exit code and the last stderr lines when it fails, with a "Show output" action on an OutputChannel.
**Phase:** P3.

### 14. Detecting PRs without the `gh` CLI
**What goes wrong:** The spec lists "PRs with review requested" in the QuickPick. Without `gh`, local git knows nothing about PRs. Using `authentication.getSession('github')` plus Octokit adds auth prompts and an API dependency in a v1 that is supposed to be local. PR refs (`refs/pull/N/head`) are not fetched by default.
**Prevention (v1):** Treat PRs as out of the picker's critical path. Offer "A branch or range" and "A commit" first. Parse the remote URL to get owner and repo. If `gh` is on PATH, use `gh pr list --json` as an optional enhancement via an args array. Otherwise show no PR group, with no error. Selecting a PR then runs `git fetch origin pull/N/head:refs/difftour/pr-N` (quietly, and only on explicit selection). Do not call the GitHub API in v1 (PR review comments are out of scope).
**Phase:** P2. Explicitly defer the rest.

### 15. CRLF in git output and tour text
**What goes wrong:** `git` itself emits LF, but captured stdout through a shell on Windows, `core.autocrlf` or `.gitattributes eol=crlf` give `\r`. Files in the repo with CRLF endings make `git show` content contain `\r\n`. LCS line alignment then treats `a\r` and `a` as different lines, and marks the whole file changed. A `\r` in a displayed line renders as an extra glyph, and line counts in the validator differ when `split('\n')` is used instead of `split(/\r\n|\n/)`.
**Prevention:** Split on `/\r\n|\n|\r/` everywhere (a shared `splitLines`). In the Webview LCS, compare after stripping a trailing `\r`, but display the original. Whether the Webview and the VS Code diff editor show the same alignment matters less than keeping line numbers consistent with the real file. VS Code's own diff handles CRLF correctly, so only the Webview aligner needs the fix. Add a CRLF fixture to the unit tests.
**Phase:** P5 and P6.

## Minor Pitfalls

### 16. Language of the tour vs the UI
`difftour.language` goes to `--lang`. A cached tour in a different language is returned for the new setting unless language is in the cache key (it is, in pitfall 8). Tour text may contain CJK, so the serif font fallback and `line-break` rules matter.

### 17. Activation and packaging
Use `onStartupFinished` or `onCommand`, not `*`. Bundle with esbuild, with `vscode` as external, and use `vsce package --no-dependencies`. Do not forget `.vscodeignore` (the `docs/handoff` HTML files and `support.js` must not ship). The activity bar icon must be a monochrome SVG. A Webview bundle uses `platform: 'browser'` and a separate entry point from the extension host (`platform: 'node'`).

### 18. Node version drift
The dev machine has Node 25. VS Code's extension host runs its own Electron Node. Test with the extension host and not with the shell's Node. `@types/node` must match the host version, and `engines.vscode` needs to match the API that is used.

### 19. Example snippets and trust
Snippet blocks are LLM text and are never applied. Make sure the Copy action copies the text only. Do not add "Apply" even as a convenience, and do not offer to write files through any message handler.

### 20. Treating the upstream prompt as stable
The fork will drift from upstream (prompts live in `internal/generate/prompts`). Keep fork changes small and additive in a separate package, and document the fork point commit so upstream fixes can be merged.

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| P1 Verify/fork CLI | TUI with no headless mode; Windows untested; schema invented (1, 2, 3, 4) | Add a `generate --json --progress=jsonl` command; end-to-end Windows run as an exit gate; gap table vs prototype; JSON Schema |
| P2 Skeleton, QuickPick, <10 rule | Wrong diff form for counts; PR detection without gh; quotepath (6, 7, 14) | Resolve SHAs once with merge-base; `-z`; no PR group without gh |
| P3 Runner and progress | Windows spawn, .cmd, process-tree kill, line buffering, orphaned jobs (5, 12, 13, 8) | args arrays, `taskkill /T`, line buffer, atomic writes, hashed cache keys |
| P4 Document Webview, state | CSP, state loss, key conflicts, workspaceState bloat (10, 11) | nonce CSP helper, serializer, `ready` handshake, input-focus guards, small state |
| P5 `difftour:` provider | Path form, encoding, binary or large, selection on base side, language detection (6, 9, 15, 4) | Immutable SHA URIs, Buffer decoding, size guard, filename-last URI, clamp refs |
| P6 Webview blocks | LCS with CRLF, theming, XSS from LLM text, unknown block types (10, 15, 3) | sanitize, tolerant renderer, `--vscode-*` variables |
| P7 Flow bar | Flow mapping not in CLI output (3) | derive nodes from file references in code blocks |

## Sources

- diff-tour README, https://github.com/init-co-jp/diff-tour (fetched 2026-11-03): Windows "not tested", LLM command lines, `--dump`/`--plain`, cache dir, validation with at most 2 retries. HIGH for these specific facts.
- `docs/handoff/README.md` and `.planning/PROJECT.md`: project spec. HIGH.
- Node `child_process` behaviour on Windows (`.cmd` EINVAL since CVE-2024-27980, no tree kill), `git` path and quotepath behaviour, and VS Code Webview and `vscode.diff` behaviour: from training knowledge, not re-verified today. MEDIUM to LOW. Items flagged (verify) need a spike.
