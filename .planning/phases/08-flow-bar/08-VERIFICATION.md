---
phase: 08-flow-bar
status: passed
verified: 2026-11-04
---

# Phase 8 verification

The orchestrator checked this phase in autonomous mode: typecheck, tests (75/75) and smoke ("flow bar view, tour opened") all pass. No live window was used.

| Req | Evidence | Status |
|-----|----------|--------|
| FLOW-01 | `difftour.flowBar` WebviewView sits in the bottom-panel container `difftourFlow` (`when: difftour.tourActive`), revealed with `show(true)` when a tour opens. It stays visible while a diff editor has focus. | ✓ |
| FLOW-02 | `buildBar` gives each node a kind, current/visited state, and a tooltip that names the steps showing its file. Tested over all fixtures. | ✓ |
| FLOW-03 | `resolveClick` goes to the next step showing the node's file, and otherwise opens it with `openCode` at the node's lines. Tested. | ✓ |
| FLOW-04 | The FLOW label is accented when the current step maps to a node. | ✓ |

Accepted deviation: the bar is a 48px row inside a bottom panel whose height the user controls.
