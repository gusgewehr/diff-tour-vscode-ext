# Tour JSON schema (upstream diff-tour)

## Source

- Upstream commit `b47b39f05ff66101a9066292e38d17b0cedda9db` (see `cli/FORK.md`).
- Types: `cli/internal/tour/tour.go`. `tour.Version = 1`. Checks: `Validate()`, `checkDiagram()`, and `render.Check()` in `cli/internal/render/check.go`.
- `generate.PromptVersion = "v6"`. The prompt text is `cli/internal/generate/prompts/format.md`.
- LLM output is decoded with `DisallowUnknownFields`: any field the fork wants to add must first be added to the Go struct, or the tour is rejected.
- Saved tours are plain `json.MarshalIndent` of `Tour`. Example: `fixtures/tours/example-coupons.en.json`.

## Top level

Tour:

| JSON | Go type | Req | Meaning / rule |
|---|---|---|---|
| version | int | yes | must equal 1 |
| title | string | yes | tour title |
| base, head | string | yes | ref names (not SHAs), pinned to the request by `generate.parse` |
| chapters | []Chapter | yes | at least one step overall ("no steps" otherwise) |

Chapter: `title` string, `steps` []Step.

Step:

| JSON | Go type | Req | Meaning / rule |
|---|---|---|---|
| title | string | yes | must be non-empty |
| question | bool | no | step shows only the question; the next step has the answer (a last-step question fails `render.Check`) |
| asks | []string | no | likely reader questions (`?` key); dropped on question steps and the step before by `DropRevealingAsks` |
| asked | string | no | on a step answering a reader question: that question |
| open | Location | no | where "open" goes; defaults to first code block |
| blocks | []Block | yes | see below |

Location: `file` string, `line` int, `at` "base" | "head" (empty = head).

## Blocks

A block holds exactly one kind (`kinds()` must equal 1): p, quote, list, pre, table, code, diff, snippet, schema, rows, flow, timeline, files, target. `basis` is allowed only together with `p`.

### p
`{"p": "text", "basis": "fact"}`. `basis`: `fact` (verified), `inferred` (readable from code structure), `opinion` (senior's view); empty allowed; anything else is an error.

### quote
`{"quote": "string"}` e.g. a commit message.

### list
`{"list": ["...", "..."]}` []string.

### pre
`{"pre": "string"}` preformatted text.

### table
`{"table": {"head": [..], "rows": [[..]]}}` all strings.

### code
| JSON | Type | Meaning |
|---|---|---|
| file | string | path in repo |
| at | "base"/"head" | revision, empty = head |
| lines | [2]int | highlighted range |
| show | [2]int, optional | displayed range; default = lines +-2. Must be inside the file and contain lines |
| note | string | side note, e.g. "unchanged" |
| marks | []{line,text} | notes under single lines; line must be within the shown range |

`render.Check`: file must exist at `at`; `1 <= lines[0] <= lines[1] <= file length`.
Example: `{"code": {"file": "src/orders/orderService.ts", "at": "base", "lines": [33, 41], "show": [30, 49], "note": "unchanged", "marks": [{"line": 33, "text": "..."}]}}`

### diff
`{"diff": {"file": "...", "hunks": [0, 2]}}`. `hunks` 0-based indexes, default all. Check: hunks must be valid and the file changed. There is no `at` on diff (it is always base to head).

### snippet
`{"snippet": {"label": "Not in this repository: ...", "lang": "typescript", "text": "..."}}`. Code that is not in the repo; the label must say so.

### schema
`{"schema": {"migrations": "db/migrations", "tables": [..], "focus": ["table.column"]}}`. Check: migrations load at base and head; each named table exists before or after.

### rows
`{"rows": {"tag": "example", "label": "...", "head": [..], "data": [[..]], "added": ["col"]}}`. `tag` defaults to "example" (made-up data).

### flow
`{"flow": {"nodes": [FlowNode]}}`. At least one node. See FlowNode below.

### timeline
`{"timeline": {"lanes": [..], "events": [{lane, to, text, mark}]}}`. 1 to `MaxLanes` (4) lanes; at least one event; `lane` and `to` must be listed lanes and `to` differs from `lane`; `mark` is "", "ok", "bad" or "note".

### files
`{"files": {"roles": [{file, role, note}]}}`. The tool reads file list and sizes from git; roles only classify. Check: each file must be among the changed files.

### target
`{"target": true}`: shows base and head, commits.

## Allowed `at` values

`"base"` or `"head"` (empty means head), on Location and CodeRef. DiffRef has no `at`. `render.Check` resolves `at` through `ctx.Ref()` and reads the file from that revision with `git show`.

## FlowNode

| JSON | Meaning |
|---|---|
| label | required, non-empty |
| kind | "changed", "new", "same" (default), "external" |
| note | shown beside the box |
| next | a string: the label of the arrow to the following node (not an id, not a reference) |
| start | bool: begins a separate flow, no arrow from the previous node |

There is no `id`, `file` or `lines` field.

## files block roles

`core`, `mechanical`, `test`, `config`, `docs` (anything else is an error).

## Identity and cache

- A tour has no id. Identity is the cache key: `CacheKey` = first 24 hex chars of sha256 over merge-base SHA, head SHA, lang, `PromptVersion`, backend name (NUL-separated).
- Saved to `os.UserCacheDir()/tour/tours/<key>.json` (Windows: `%LocalAppData%\tour\tours\`).
- `base`/`head` in the JSON are ref names, which can move after generation; resolved SHAs are not stored (the fork adds them to its output event).

## Gap table

| Prototype assumes (tour-data.js / README) | Upstream reality | Consequence for the extension |
|---|---|---|
| `code {file, at, lines, show, marks}` | Identical, plus `note` | none |
| question steps (`question: true`) | Exists | none |
| `questions: [6, 9]` index list on the tour | Does not exist | derive from `step.question` |
| paragraph `basis` fact/inferred/opinion | Exists, same values | none |
| `snippet {label, text}` | Exists, plus `lang` | none |
| finding `weight` (Must/Suggestion/...) | Missing everywhere | v2 only (PR comments) |
| flow node `id` | Missing | cannot reference nodes by id; use index |
| flow node `file` / `lines` | Missing | derive from code blocks, or add optional fields to fork (flow mapping decision) |
| step `flowNodes: [id]` | Missing | derive: steps whose code blocks reference the node's file |
| flow edges by id | `next` is an arrow label string to the following node | edges are implicit by order, `start` breaks them |
| tour `id` | None; cache key only | key comes from the fork's `done` event |
| `files` roles + `visits` map in tour-data.js | `files.roles` only; no visits (UI state) | visits live in extension workspaceState |
| `chapter.steps` as strings | Objects `{title, question, asks, asked, open, blocks}` | render from objects |
| `base`/`head` as stable refs | Ref names only, can move | fork emits `baseSha`/`headSha` |
| (not in prototype) `asks` / `asked` | Upstream-only reader Q&A fields | ignore or support later |
| (not in prototype) `open` Location | Upstream-only open target | use as default open target |
| (not in prototype) `diff`, `pre`, `rows`, `schema` blocks | Exist | extension must render or fall back |
