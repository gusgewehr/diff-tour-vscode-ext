# Flow node -> file -> step mapping (CLI-07)

## Context

`FlowNode` upstream has `label`, `kind`, `note`, `next`, `start` only; no file, lines or id (docs/tour-schema.md).
The extension wants to click a flow node and jump to the code. Heuristic tested (`scripts/flow-mapping-check.mjs`): candidates are the
distinct `code.file`/`diff.file` values of the tour; label vs file scores full path 3, basename with extension 2, basename stem
(>= 3 chars, camel/snake split) as a whole word 1; best score > 0 wins, a tie is unmapped.

## Measurements

`node scripts/flow-mapping-check.mjs fixtures/tours/example-coupons.en.json fixtures/tours/real-*.json` (all v6 tours, labels without file hints):

| Tour | Non-external nodes | Mapped | Percent |
|---|---|---|---|
| example-coupons.en | 6 | 1 | 17% |
| real-b146230 | 6 | 3 | 50% |
| real-9cbe3d2 | 7 | 0 | 0% |
| real-9c18e24 (v6 run, before the change) | 8 | 0 | 0% |
| **Total** | **27** | **4** | **15%** |

Labels name functions, endpoints and ideas ("startAnswer starts a goroutine", "Saved tour for this key?"), not file names, so label matching cannot work.

## Decision

**Add file/lines to FlowNode** (fork change, not derive in the extension). 15% mapped is far below the 60% threshold.

Done in the fork: optional `file` (repo path) and `lines` ([start, end], head revision) on `FlowNode`, documented in the flow row of
`cli/internal/generate/prompts/format.md`, `PromptVersion` bumped to v7. Verified by regenerating `fixtures/tours/real-9c18e24.json`:
6 of the 7 non-external nodes carry `file` + `lines` (86%); the 7th ("Viewer (playback)") is a concept with none, and the external node has none.

Phase 8 must implement:
- A flow node with `file` is clickable: open that file (at head) at `lines[0]`; a node without `file` (external, or conceptual) is not clickable.
- Steps of a node = flat step indices whose `code` blocks reference the node's `file` (zero steps: open the file directly).
- Treat `file`/`lines` as optional (old v6 cached tours have none): fall back to non-clickable, do not run the label heuristic.
- Validation of `file` against the changed files / `lines` against file length is NOT done by the fork; the extension must tolerate bad values.
