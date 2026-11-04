# Architecture Patterns

**Domain:** VS Code extension that runs an LLM-driven CLI (`tour`), renders its JSON in a Webview, opens code read-only as diffs at pinned commits
**Researched:** 2026-11-03
**Overall confidence:** MEDIUM (upstream schema read from source: HIGH; VS Code API behavior from training knowledge, not re-verified against current docs this session: MEDIUM; flow-bar placement: MEDIUM, needs a spike)

## 1. Upstream tour JSON (verified from github.com/init-co-jp/diff-tour `internal/tour/tour.go`)

Read from source on 2026-11-03. This is the shape `tour/model.ts` must mirror.

```
Tour      { version:int, title, base, head, chapters: Chapter[] }
Chapter   { title, steps: Step[] }
Step      { title?, question?:bool, asks?:string[], asked?, open?:Location, blocks: Block[] }
Location  { file, line:int, at? }
Block     (exactly one key besides optional `basis`):
  p:string (+ basis: "fact"|"inferred"|"opinion") | quote:string | list:string[] | pre:string
  | table:{head[],rows[][]} | code:CodeRef | diff:{file,hunks?:int[]} | snippet:{label,lang?,text}
  | schema:{migrations,tables?,focus?} | rows:{tag?,label,head[],data[][],added?}
  | flow:{nodes: FlowNode[]} | timeline:{lanes[],events:{lane,to?,text,mark?}[]}
  | files:{roles:{file,role:"core"|"mechanical"|"test",note?}[]} | target:true
CodeRef   { file, at?, lines:[a,b], show?:[a,b], note?, marks?:{line,text}[] }
FlowNode  { label, kind?, note?, next?, start?:bool }
```

Consequences (these correct assumptions in PROJECT.md and the handoff):

| Prototype assumption | Upstream reality | Action |
|---|---|---|
| `code.at: "base"\|"head"` | `at` exists, optional (example uses `"base"`); default presumably head | Model as optional, default `head`. LOW confidence on accepted values: confirm in `Validate()` |
| step `question`, paragraph `basis`, `show`, `marks`, `snippet` | All exist upstream | No fork needed for these |
| finding `weight` (Must/Suggestion/...) | Not in the struct | v2 (PR comments) only. Out of v1 scope |
| `flow.nodes[].id`, `.file`, `.lines`; step `flowNodes` | Not present. Nodes have `label, kind, note, next, start` only | Flow-to-file mapping must be **derived** (see Flow mapping). Do not require a fork for this |
| Tour `id` | No ID field; identity = `title`+`base`+`head` | Extension computes id (see State) |
| Progress stream / headless JSON | None in `tour.go`. `Load()` only reads and validates a file. Generation lives in `internal/generate` (not read) | Fork adds it. Phase 1 must read `internal/generate` and `cmd/tour` |
| Line/file validity | "checked at display time", not in `Validate()` | Extension must tolerate bad refs (show error block, never crash) |

Also: upstream has `Step.open` (a default file/line to open for `o`): use it as the "primary code" for step. Unread: `internal/generate`, `internal/git`, `cmd/tour`, any docs on the fork-needed flag. Phase 1 reads these.

## 2. Recommended Architecture

Principle: **the extension host owns all state and all I/O; the Webview is a dumb renderer** that gets a view-model and sends intents. One `TourSession` object is the single source of truth; every UI surface (tree, status bar, Webview, flow bar) subscribes to its `onDidChange`.

```
                      +--------------------------------------------+
                      |            extension host (Node)           |
 QuickPick  -------->  |  commands/tourChange                      |
 (git/changes.ts)      |        |                                  |
                       |        v                                  |
                       |  cli/runner.ts --spawn--> tour (Go) --JSONL--> stdout
                       |        | RunEvents (progress, done, error) |
                       |        v                                  |
                       |  tour/cache.ts  (globalStorageUri)        |
                       |        v                                  |
                       |  tour/model.ts (parse + normalize)        |
                       |        v                                  |
                       |  tour/session.ts  TourSession  <-- tour/state.ts (workspaceState)
                       |    ^ current step, layout, flow cursor    |
                       |    | onDidChange                          |
                       |    +--> views/outlineTree (TreeView)      |
                       |    +--> views/statusBar                   |
                       |    +--> webview/TourPanel  <--postMessage--> webview/ui (document)
                       |    +--> webview/FlowBarView <-postMessage--> webview/ui (flow bar)
                       |  git/contentProvider.ts  difftour: scheme  |
                       |  git/openDiff.ts  (executeCommand vscode.diff)
                       +--------------------------------------------+
```

### Component boundaries

| Component | Responsibility | Talks to | Must NOT |
|---|---|---|---|
| `extension.ts` | Register commands, providers, views; construct singletons | everything (wiring only) | hold logic |
| `git/changes.ts` | List branches/commits/ranges/saved tours; `git diff --name-only base...head` count; resolve refs to full SHAs | `child_process` git, `cache` | call the LLM |
| `git/contentProvider.ts` | `difftour:` read-only docs via `git show <sha>:<path>` | git, VS Code | write to disk or working tree |
| `git/openDiff.ts` | Build base/head URIs, call `vscode.diff` with selection, remember "opened from step N" | contentProvider, session | know about Webview |
| `cli/runner.ts` | Spawn `tour`, parse JSONL, emit typed events, cancel | `tour` binary, cache | touch UI |
| `tour/model.ts` | Types + `parseTour(json)` + normalization (derive flow mapping, step ids) | pure | import `vscode` (keeps it unit-testable) |
| `tour/flow.ts` | Derive node-to-file/step mapping; "next step showing node file" | model (pure) | import `vscode` |
| `tour/cache.ts` | Layout, atomic write, index of saved tours | `globalStorageUri` | |
| `tour/state.ts` | Per-tour progress/notes/guesses in `workspaceState` | VS Code Memento | |
| `tour/session.ts` | Active tour + current step + event emitter. Only place that mutates navigation | state, model, flow | render |
| `views/outlineTree.ts` | `TreeDataProvider` chapters-to-steps | session | own state |
| `views/statusBar.ts` | `Step 7/16`, `No tour - 3 files (under 10)` | session | |
| `webview/TourPanel.ts` | Document Webview, serializer, message protocol | session | read git directly |
| `webview/FlowBarView.ts` | Persistent flow bar (`WebviewViewProvider`) | session | |
| `webview/ui/*` | Rendering blocks (LCS alignment on **text sent by host**) | host via messages only | fetch from network, call git |

Pure modules (`model`, `flow`, LCS align) have no `vscode` import: unit-test with the prototype's `tour-data.js` converted to a fixture plus the upstream `tours/example-coupons.en.json`.

### Data flow (one direction)

1. `tourChange` -> resolve refs to SHAs -> count files -> `< minFiles` ? `vscode.diff` + notice : check cache for `(repoId, baseSha, headSha, lang)`.
2. Cache miss -> `runner.start()` -> events -> `withProgress` notification + `WritingPanel` -> on `done` write cache -> `session.open(tour)`.
3. `session.open` -> restore `state` -> fire `onDidChange` -> all views repaint.
4. User intent (Webview `{type:'goto', step}` / tree click / keybinding command / flow click) -> **command** -> `session.goto()` -> `onDidChange` -> views update. Webview never mutates its own step locally; it re-renders from host state (prevents tree/Webview/flow drift).
5. "Open code" intent -> host reads blob via git (provider), `vscode.diff`. Webview code blocks receive their text pre-resolved from the host (`git show`), never from the LLM reply (spec constraint).

## 3. Extension host to Webview protocol

Typed discriminated unions in `webview/protocol.ts`, imported by both sides (esbuild bundles two targets: `node` for host, `browser` for UI).

```ts
// host -> webview
type ToWebview =
  | { t: 'init'; tour: TourVM; state: StateVM; step: number }       // full snapshot
  | { t: 'step'; step: number; state: StateVM }                      // navigation / state delta
  | { t: 'code'; reqId: number; file: string; at: 'base'|'head'; base: string|null; head: string|null }
  | { t: 'writing'; stages: StageVM[]; log: LogLine[] };            // Writing view only
// webview -> host
type ToHost =
  | { t: 'ready' }                                                   // host sends init only after this
  | { t: 'goto'|'prev'|'next' ; step?: number }
  | { t: 'toggleDone'|'visit' ; step: number }
  | { t: 'note'|'guess'; step: number; text: string }               // debounce 400ms in UI
  | { t: 'openCode'; file: string; at: 'base'|'head'; line: number; to?: number }
  | { t: 'needCode'; reqId: number; file: string; at: string; range: [number,number] }
  | { t: 'copy'; text: string } | { t: 'cancel' } | { t: 'skipToTour' };
```

Rules:
- **`ready` handshake**: messages posted before the Webview script loads are lost. Host sends `init` only on `ready`. Queue otherwise.
- Version the protocol (`v:1`) since serialized panels survive extension upgrades and may run old UI.
- Send a **view-model**, not raw filesystem: host precomputes per-code-block `{base, head}` line text windows (it knows `lines`/`show`), so the UI does LCS alignment on strings. Keep messages under a few hundred KB; lazy `needCode` for large files.
- Keyboard: Webview captures keys only while focused; also register real `keybindings` for `difftour.next/prev/understood` with `when: "difftour.active"` (context key set via `setContext`) so they work from the tree and diffs, not just the Webview. Do not duplicate: in the Webview forward keydown as `{t:'key'}` to the same commands.
- CSP: nonce'd script, `default-src 'none'`, fonts/styles via `webview.asWebviewUri` from `localResourceRoots: [extensionUri/dist]`. Satisfies "offline Webview".
- Theme: use `--vscode-*` variables; `body.vscode-dark/light/high-contrast` classes toggle.

### State restore: serializer vs retainContextWhenHidden

| Option | Cost | Behavior | Verdict |
|---|---|---|---|
| `retainContextWhenHidden: true` | High memory (keeps the DOM alive); docs discourage it | Scroll, textarea contents survive tab switches | Use **only** for the Document panel, because users flip to diff tabs constantly and lose scroll/typed guess |
| `WebviewPanelSerializer` + `vscode.setState()` | Low | Survives window reload; DOM rebuilt | **Always implement** (reload/restart). Persist `{tourId, step}` via `webview.setState`; host rehydrates the rest from cache + workspaceState |
| Neither | Cheapest | Blank on every tab switch | No |

Recommendation: implement the serializer (`deserializeWebviewPanel` -> look up tour by id in cache -> `session.open` -> wait for `ready`) **and** `retainContextWhenHidden: true` for the Document panel only. Make host state authoritative so restore is just `init`. Write notes to `workspaceState` on debounce plus on `blur`/hide so nothing lives only in DOM. The Flow bar view needs neither (stateless, repaint from `init`). Confidence MEDIUM on memory advice (official guidance says use sparingly).

## 4. Tree and Webview sync of the current step

- `TourSession` holds `{tourId, step}`; `onDidChange` fires `{kind:'step'|'state'|'tour'}`.
- Outline tree: `onDidChangeTreeData` fires on `state`/`tour` only (icons depend on done/visited), and on `step` call `treeView.reveal(stepItem, {select:true, focus:false})`. Needs `getParent` implemented, and stable element identity (cache TreeItem objects by step index; ids `chapter/step`). Guard against loops: `treeView.onDidChangeSelection` -> `session.goto(step)`, which no-ops if equal (idempotent goto breaks the cycle).
- Webview: receives `step` message; also `treeView` visible. Prefer `reveal` with `focus:false` so the keyboard focus stays where the user is.
- Status bar and flow bar subscribe identically. No component calls another component's `set*`.

## 5. `difftour:` content provider and diffs

```
difftour:/<repoPathEncoded>/<file path>?sha=<fullSha>&side=base|head&repo=<repoRoot>
```
- Use **full SHA** in the query (resolve branch names once at tour creation and store in the cache meta; branch tips move, tour refers to commits). Tour JSON `base`/`head` may be refs; resolve and pin.
- Keep the file's real extension at the end of the path so language mode and syntax highlighting work. Put sha/side in the query, not the path.
- Provider: `provideTextDocumentContent(uri)` -> `git show sha:path` via `execFile` (not shell; Windows quoting). Absent blob (new/deleted file) -> return `''` and let the diff show an empty side; track existence in the opener to label "did not exist". Binary files: detect and return a message. Do not use `workspace.fs.writeFile`; documents from a content provider are read-only by construction (editor shows the lock).
- Cache blobs in-memory (LRU by `sha:path`): immutable by definition, so the `onDidChange` emitter is not needed.
- Open: `commands.executeCommand('vscode.diff', baseUri, headUri, title, { selection: new Range(l-1,0,l2-1,0), preview: true, preserveFocus: false })`. The selection applies to the **modified (right)** side; to highlight a range on the base side open `at:'base'` diff and accept that it reveals in the right; for base-only refs, consider revealing via `window.activeTextEditor` on the left editor after open (LOW confidence: the diff editor exposes both sides in `visibleTextEditors`; spike).
- Tabs titled `file (main <-> feature)`; mark with `$(lock)` is automatic for read-only? Verify; the handoff's lock icon in the tab may be a title string instead.
- "Back to step" mini control: **not a floating overlay** (the extension cannot draw over native editors). Implement as (a) status bar item `$(arrow-left) Back to step 7`, (b) `editor/title` button for diffs whose URI scheme is `difftour` (`when: resourceScheme == difftour`), (c) `Esc` keybinding with `when: "difftour.active && resourceScheme == difftour"` closing the diff and revealing the Document panel. The spec's 440px floating player is not achievable natively; the flow bar view (below) can host prev/next/back.

## 6. Flow bar persistence: what is actually possible

| Option | Persistent when a diff editor is focused? | Rich UI (chips, colored bars, tooltips) | Verdict |
|---|---|---|---|
| Webview **in the editor area** (the Document panel) | No: it is a tab; hidden when another tab active | Yes | Not a flow bar |
| `WebviewViewProvider` in a **bottom Panel** container (`viewsContainers.panel`) | **Yes**: panel is independent of the editor group | Yes (full HTML), min height roughly 1-2 lines of panel chrome plus content; user-resizable, but can be collapsed or hidden by the user | **Recommended primary** |
| Webview view in sidebar / secondary sidebar | Yes while sidebar visible; shares space with outline tree | Yes | Good complement: place flow view in the same TOUR container under the outline tree; secondary-sidebar placement is user-driven (LOW confidence contributions can default there) |
| `editor/title` / `editor/title/run` menu | Yes, per editor, including diffs | **No**: icon/text commands only, no custom widgets; cap on width | Use only for prev/next/back buttons |
| Status bar items | Yes always (window-level) | Text + codicons + MarkdownString hover, per-item click; no colored bars, no layout control | **Recommended secondary**: `Step 7/16`, current node label, back |
| Notification / webview inset / decorations | Insets only exist for notebooks/custom editors; not for diff | n/a | No |

Decision: **Flow bar = `WebviewView` in a panel container "TOUR FLOW" (`difftour.flowBar`), plus status-bar items for step and current node**. A bottom panel is not "under the title bar at 48px" as in the design, so expect a visible deviation: a short panel (~60-90px). Document this as accepted. The panel view appears only while a tour is active (`when: difftour.active`) and auto-reveals via `commands.executeCommand('difftour.flowBar.focus')` (use `preserveFocus` semantics; check, since `.focus` steals focus; alternative is `view.show(true)`). **Spike in the skeleton phase** to measure minimum height and whether it auto-reopens after the user closes the panel. Flow node click -> host command `difftour.goNode(label)`.

## 7. Flow mapping (`tour/flow.ts`)

Upstream `FlowNode` is `{label, kind, note, next, start}`: no file, no lines, no id, no step list. Derive:

1. Flow blocks may appear in several steps; build the tour-level graph from the **first** flow block (or union by label). Node id = slug(label) disambiguated by index. `next` is a label (verify whether string or list: unread; treat as string-or-array defensively).
2. Node to file: heuristic match of node label tokens against file paths appearing in `code`/`files` blocks (e.g. label `apply()` + code ref whose file defines `apply`; cheap check: label token in file path or in `marks[].text`/`note`). **Heuristic and fallible.** If ambiguous: no file, node is informational only.
3. Node to steps: steps whose `code` blocks reference the node's file. "Click": next step after current with that file; else open file via `openDiff` at first matching `lines`; else do nothing but flash tooltip.
4. If the node-to-file heuristic proves poor on real Claude-written tours, fork the CLI prompt/schema to add optional `file`/`lines` to FlowNode (small Go change; backward compatible with `omitempty`). **Flag for Phase 1**: sample 3+ real tours before committing to derivation.

Persist the derived map in the model, not the cache, so heuristic fixes apply to old tours.

## 8. CLI runner (`cli/runner.ts`)

```ts
interface RunHandle { events: AsyncIterable<RunEvent>; cancel(): void; done: Promise<string /*tour json path*/> }
type RunEvent =
 | {t:'stage'; stage:'export'|'write'|'check'|'show'; state:'active'|'done'}
 | {t:'read'; tool:'Read'|'Grep'|'Glob'; path:string; tag?:'NOT_IN_DIFF'|'BASE'}
 | {t:'retry'; n:number; reason:string}
 | {t:'done'; tourPath:string} | {t:'error'; message:string};
```
- `child_process.spawn(bin, args, {cwd: repo, windowsHide:true, env})` with `shell:false`. Set `stdio: ['ignore','pipe','pipe']`. A `tour` TUI needs a TTY; the **fork must add a headless mode** (e.g. `--headless --progress=jsonl --out <path>`). Without it the extension cannot work: Phase 1 gate.
- Parse stdout with a line splitter (buffer partial chunks; `readline.createInterface`). **Reserve stdout for JSONL; stderr for human logs**. Unknown event types ignored (forward compatible). Include a `version` first event; fail fast on mismatch.
- Result delivery: write tour JSON to a temp file path given by `--out`, then runner validates with `parseTour` and moves it into the cache (atomic rename). Do not stream the full JSON through stdout.
- Cancel: `CancellationToken.onCancellationRequested` -> kill. **On Windows `child.kill()` kills only the direct child, not the LLM subprocess tree**: use `taskkill /pid <pid> /T /F` on `win32`, `process.kill(-pid)` with `detached:true` elsewhere. Also clean the CLI's export dir (it deletes on success only). Also kill on extension `deactivate`.
- One run at a time per `(repo, base, head)`; a second request attaches to the existing run.
- Binary resolution: `difftour.cliPath` setting, else PATH; run `tour --version` at start and surface a clear error. Passing `--lang` from `difftour.language`.
- Failure classes to surface distinctly: binary missing, LLM CLI not signed in, validation failed after retries, cancelled, git error.

## 9. State store and cache layout

**Tour id**: `sha1(repoId + '\0' + baseSha + '\0' + headSha + '\0' + lang)` truncated; `repoId` = `git rev-parse --git-common-dir` hash or first remote URL. Resolved SHAs avoid the "branch moved" problem; a moved branch is a new tour (offer "saved tour for old tip").

```
globalStorageUri/
  tours/<repoId>/<baseSha12>..<headSha12>.<lang>.json     tour (as emitted by CLI)
  tours/<repoId>/<baseSha12>..<headSha12>.<lang>.meta.json   { id, title, baseRef, headRef, baseSha, headSha, createdAt, cliVersion, fileCount, repoPath }
  runs/<runId>/                                            temp out + log; deleted on completion
```
Handoff uses `<repo>/<base>..<head>.json`; branch names contain `/` and change, so use SHAs and keep refs in `meta`. Keep `meta` so the QuickPick "SAVED" group lists without parsing big JSON. Windows: keep paths short, ensure `fs.mkdir recursive`, write temp then `rename`.

**workspaceState** key `difftour.state.<tourId>`: `{ v:1, step, layout, done:{}, visited:{}, notes:{}, guesses:{} }` (pendingComments deferred to v2). Notes "never in repo" is satisfied. Caveat: `workspaceState` is per-workspace; opening the same tour from another folder loses notes. Acceptable v1; if wanted use `globalState` keyed by tourId. Bound growth: prune states with no cache entry on activation. Step index is fragile if the tour JSON is regenerated: key `done/notes` by `chapterIdx.stepIdx` plus a content hash of the step title; on hash mismatch drop quietly.

## 10. Patterns to follow

- **Single session, many subscribers** (section 2). Avoids tree/Webview/flow desync.
- **Host resolves, UI renders**: git access only in host.
- **Pure core**: model/flow/align pure TS, tested with Vitest, fixture tours.
- **Idempotent navigation**: `goto(n)` no-ops on equal; clamps range.
- **Defensive parse**: unknown block keys render as a muted "unsupported block" (`diff`, `schema`, `rows`, `pre` exist upstream beyond the handoff list; handle gracefully, implement later).
- **Dependency injection of `exec`** for git/CLI so runner and provider tests run without real processes.

## 11. Anti-patterns

- Webview keeps its own current step (drift).
- Passing LLM-quoted code to the UI: always read from git (spec, and the CLI validates refs only at display time).
- Branch names in URIs/cache keys (moving targets, slash characters).
- `shell: true` / string-concatenated commands for git or the CLI (Windows quoting, injection from branch names). Use `execFile` with arg arrays.
- Floating overlays over native editors: not possible; use status bar / title buttons / panel view.
- Loading Google Fonts from the Webview; bundle woff2 in `dist/`.
- Depending on the TUI binary unmodified.

## 12. Suggested build order (dependency-driven)

| # | Component set | Depends on | Notes / research flag |
|---|---|---|---|
| 0 | **CLI spike**: read `internal/generate` + `cmd/tour`; build `tour` on Windows; headless/JSONL fork; tour from real Claude run; sample flow nodes | none | Gate for everything. DEEPER RESEARCH. Windows untested upstream |
| 1 | `model.ts` + fixtures + `flow.ts` heuristics (pure) | 0 (real tours) | Cheap, unblocks UI; tests first |
| 2 | Skeleton: package.json, session, state, cache, git/changes, QuickPick, < minFiles rule, status bar | 1 | Standard patterns |
| 3 | `difftour:` provider + `openDiff` | 2 (git helpers) | Independent of CLI; can be built parallel with 0. Spike: left-side selection, lock icon |
| 4 | Runner + Writing view + cancel + cache write | 0, 2 | Windows process-tree kill; DEEPER RESEARCH on CLI flags |
| 5 | Document Webview + protocol + outline tree + nav + keys + notes + serializer | 1, 2 | Protocol finalized here |
| 6 | Block renderers (code LCS side-by-side, timeline, flow, table, snippet, question/guess...) | 5, 3 | Largest UI chunk; port markup from `Tour Blocks.dc.html` as reference only. Do code/p/list/files first, rest incrementally |
| 7 | Flow bar view + node click + back-to-step controls | 5, 3, flow.ts | Spike on panel height first; do this spike in phase 2 |
| 8+ (v2) | Focus, Inline, PR comments, Setup, i18n | | Reuse `session` untouched; layouts are alternative subscribers |

Phases 3 and 4 can proceed in parallel after phase 2. Phase 1 can start before the fork completes using the upstream example tour.

## Scalability Considerations

| Concern | Typical tour (16 steps) | Huge diff (300 files) | Mitigation |
|---|---|---|---|
| Webview payload | small | many code blocks | lazy `needCode`, windowed text |
| Blob reads | few `git show` | many | LRU cache, on-demand only |
| Cache growth | KBs per tour | | prune by age/count setting |
| Tree size | ~20 nodes | ~100 | trivial |

## Sources

- Upstream struct definitions: https://raw.githubusercontent.com/init-co-jp/diff-tour/main/internal/tour/tour.go (HIGH, read 2026-11-03)
- Upstream example tour: https://raw.githubusercontent.com/init-co-jp/diff-tour/main/tours/example-coupons.en.json (HIGH; summarized via fetch tool, not the raw bytes)
- Upstream README / CLI surface: https://github.com/init-co-jp/diff-tour (HIGH)
- `docs/handoff/README.md`, `.planning/PROJECT.md` (project spec)
- VS Code API claims (WebviewViewProvider in panel container, `editor/title` menus, serializer, `retainContextWhenHidden`, `vscode.diff` options): training knowledge consistent with https://code.visualstudio.com/api/extension-guides/webview and https://code.visualstudio.com/api/references/vscode-api; **not re-fetched this session**, MEDIUM. Items marked "spike" are intentionally unverified.
