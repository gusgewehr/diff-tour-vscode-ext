---
phase: 01-verify-diff-tour-cli-json-headless-fork
plan: 03
subsystem: cli
tags: [windows, claude-code, fixtures, flow-mapping]
requires: [01-01, 01-02]
provides:
  - "3 real headless tours (11/14/16 files) + JSONL logs under fixtures/tours/"
  - "Windows cancel proof (stdin close, hard kill)"
  - "CLI-07 decision: FlowNode file/lines in fork, prompt v7"
key-files:
  created: [fixtures/tours/README.md, fixtures/tours/real-*.json, fixtures/tours/real-*.progress.jsonl, scripts/flow-mapping-check.mjs, docs/decisions/flow-mapping.md]
  modified: [cli/internal/tour/tour.go, cli/internal/generate/prompts/format.md, cli/internal/generate/generate.go, cli/FORK.md]
decisions:
  - "Flow mapping: add optional file/lines to FlowNode (heuristic mapped only 15%); PromptVersion v7"
  - "Third target 9cbe3d2 (14 files) instead of d05c686 (only 5 files)"
metrics:
  completed: 2026-11-04
requirements: [CLI-05, CLI-06, CLI-07, CLI-02, CLI-03]
---

# Phase 1 Plan 03: Windows proof, fixtures, flow decision Summary

The fork cancels cleanly on Windows, three real 10+ file tours are saved as fixtures, and the flow-node mapping is decided from measurements: add `file`/`lines` to FlowNode.

## Commits
- d863c39: fixtures, cancel results, FlowNode file/lines, prompt v7
- 0fc8712: docs/decisions/flow-mapping.md

## Results
- Stdin close at 45 s: `cancelled`, exit 1, 0 tour claude.exe, work dir removed. Hard kill: 0 claude.exe (Job Object), work dir left, removed by the next run of the same key.
- Real tours: b146230 (11 files, $1.94, 399 s), 9cbe3d2 (14, $1.83, 396 s), 9c18e24 (16, $2.24, 474 s, v7). 0 repairs. All pass `--dump`. Cache re-run: `cached:true` in 0.26 s.
- Flow heuristic mapped 4 of 27 non-external nodes (15%) -> fallback taken; the v7 regeneration gave file+lines on 6 of 7 non-external nodes.

## Deviations
- d05c686 had 5 files; used 9cbe3d2 (14) as third target.
- 9c18e24 first run hit an LLM safeguard false positive (code `llm`); the retry passed.
- The plan's process counter also matches bash wrappers; counted `claude.exe` by name instead.
- Only the 9c18e24 fixture is v7; the other two are v6 (no file/lines). Not regenerated for cost.
- No new go tests for the FlowNode fields; same 7 baseline internal/generate failures remain.

## Known Stubs
None.

## Self-Check: PASSED
