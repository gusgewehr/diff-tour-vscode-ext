# Phase 8: Flow bar - Context

**Gathered:** 2026-11-04
**Status:** Ready for planning
**Mode:** Autonomous. Claude made these decisions per user instruction (speed over polish, never ask the user).

<domain>
## Phase Boundary

A persistent, clickable request-flow strip that stays visible during a tour, including while a diff editor is focused, and is tied to steps and files.

</domain>

<decisions>
## Implementation Decisions

### Form (accepted deviation from the 48px spec strip)
- A `WebviewView` with id `difftour.flowBar`, in a new **panel** view container `difftourFlow` (bottom panel, title "Tour flow", icon `media/route.svg`).
- It is shown with `when: difftour.tourActive`. When a tour opens, reveal it with `preserveFocus: true` (`difftour.flowBar.focus` then refocus the tour panel, or `view.show(true)`).
- The panel height is user-controlled, so a 48px height cannot be forced. The CSS is a single compact row, 48px tall, and the rest of the panel stays empty. Record the deviation in the SUMMARY.
- Tech: plain TS DOM bundled to `dist/webview/flow.js`. It uses the Phase 4 `html.ts` CSP helper and only `--vscode-*` colors.

### Data
- Gather every `flow` block in the tour, in step order. Split each into paths at `start:true`. Deduplicate nodes across blocks by `label` plus `file`.
- Paths are separated by 1px dividers. Each path shows its nodes left to right with `→` between them.
- Node → file: `node.file` when present (the Phase 1 fork adds it). Otherwise, match the label against the basenames of code-block files.
- Node → steps: the steps whose code or diff blocks reference that file.
- Reuse the mapping helper from Phase 7, likely `src/tour/flow.ts`. If Phase 7 kept it inline in `enrich.ts`, extract it into `src/tour/flow.ts` and share it.

### Node rendering (FLOW-02)
- A 30px chip with the label, truncated with an ellipsis, plus a 3px left bar coloured by kind:
  - new = `--vscode-charts-green`
  - changed = `--vscode-charts-orange` / warning colour
  - same = grey
  - external = dashed border
- **Current node:** the node whose file is referenced by the current step's code blocks (first match). It gets an accent border (`--vscode-focusBorder`), an accent-tinted background, and a dot. It is never truncated (`flex: 0 0 auto`).
- **Visited:** any of the node's steps has been visited. It gets a muted accent border.
- **Tooltip** (`title` attribute): the full label, "you are here" for the current node, and "code in steps 3, 5" or "no step shows this file".
- **FLOW label (FLOW-04):** a small uppercase "FLOW" label at the left. It uses the accent colour when the current step maps to a node, muted otherwise.

### Click (FLOW-03)
- Go to the next step after the current index that shows the node's file: `session.goto(i)`, then reveal the tour panel.
- If there is none, or the current step is already the only one, open the file read-only: `openCode({file, at:'head', lines: node.lines ?? [1,1]})` from Phase 6.
- External nodes with no file do nothing, except the tooltip.

### Updates
- Subscribe to `TourSession.onDidChange` and post the state to the view.
- The view sends `ready`, then the host posts its state. The view's messages are validated.
- The view is visible while a diff editor is focused because it lives in the bottom panel.

### Tests (`node --test`)
- Path split and dedupe on all real fixtures.
- Current and visited computation.
- The click target resolution: next step, or open file.
- Smoke test registration of the view and the panel container.
- Rebuild, package and reinstall the VSIX.

### Claude's Discretion
- Exact CSS, and whether the status bar shows the current node.

</decisions>

<code_context>
## Existing Code Insights

- Phase 5 provides `TourSession` (`onDidChange`, `goto`, visited) and the tour panel reveal.
- Phase 6 provides `openCode`.
- Phase 7 provides the node → file/steps helper.
- Read those phases' SUMMARY files for exact names.
- The real fixture `fixtures/tours/real-9c18e24.json` has flow nodes with `file`/`lines`. The two v6 fixtures do not, so they exercise the heuristic.

</code_context>

<specifics>
## Specific Ideas

- Design reference: spec section "Flow bar". Screenshots 04 to 09 show the bar.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
