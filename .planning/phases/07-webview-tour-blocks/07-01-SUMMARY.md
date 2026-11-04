---
phase: 07-webview-tour-blocks
plan: 01
subsystem: tour-host
tags: [git, alignment, enrichment, webview-data]
requires: []
provides: [align.ts, flow.ts, enrich.ts, copy intent, blockData/previousGuess in RenderMsg]
affects: [07-02, 07-03, 08]
key-files:
  created: [src/tour/align.ts, src/tour/flow.ts, src/tour/enrich.ts, src/tour/align.test.ts, src/tour/flow.test.ts, src/tour/enrich.test.ts]
  modified: [src/tour/model.ts, src/tour/messages.ts, src/tour/messages.test.ts, src/tour/controller.ts, scripts/smoke-activate.mjs]
decisions:
  - "Flow node mapping falls back from label to note for file basename matching"
  - "Controller render is async; a post is dropped if session or step changed while git ran"
metrics:
  completed: 2026-11-04
---

# Phase 7 Plan 01: Host enrichment Summary

Host-side block data from git: -U0 hunk parsing and side-by-side alignment, flow node to step mapping, a cached per-step StepEnricher (code, diff, target, files, flow), a `copy` intent, `previousGuess`, and async render in the controller.

## Tasks
1. Pure align.ts / flow.ts + model type fixes (FlowNode.next string, SchemaRef, Rows) - 60b7f38
2. StepEnricher + parsers, temp-repo test - c5aa8b2
3. messages (copy, blockData, previousGuess), async controller, smoke - c787616

## Deviations from Plan
- None functional. A temp-repo test expected 2 diff sections; git's -U3 merges nearby edits into 1 hunk, so the assertion was corrected to 1.
- alignFile does not reset the new-side counter per hunk (it advances in lockstep with the old side), which also handles pure-delete hunks where git reports newStart as the preceding line.

## Verification
typecheck, 72 tests, build, smoke all pass.

## Self-Check: PASSED
