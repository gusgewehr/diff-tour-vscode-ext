---
phase: 06-difftour-read-only-provider-side-by-side-diff
plan: 01
subsystem: git-content
tags: [content-provider, git-show, diff-mapping]
requires: [05-webview-host]
provides: [src/git/blob.ts, src/git/contentProvider.ts, src/tour/openPlan.ts]
affects: [src/small/smallChange.ts, src/tour/messages.ts]
key-files:
  created: [src/git/blob.ts, src/git/blob.test.ts, src/git/contentProvider.ts, src/tour/openPlan.ts, src/tour/openPlan.test.ts]
  modified: [src/small/smallChange.ts, src/tour/messages.ts, src/tour/messages.test.ts]
decisions:
  - "planOpen returns paths only; caller maps left to baseSha and right to headSha and checks blobExists for unchanged files"
  - "SmallChange no longer registers a provider; registration moves to openCode.ts in plan 02 (small-change diffs fall back to the shared provider until then)"
metrics: {tasks: 2, tests: "57 pass"}
completed: 2026-11-04
---

# Phase 6 Plan 01: Shared read-only blob provider and open mapping Summary

Pure `difftour-git` layer (URI query build/parse, 2 MB/NUL guard, execFile `git show`, `cat-file -e`) plus `planOpen` status-to-sides/title mapping and diff-block code targets.

## Tasks
1. Shared blob module and content provider: e6d4b99
2. planOpen mapping and diff-block targets: d831112

## Deviations from Plan
None. Note: `planOpen` also returns an `unchanged` flag so the caller knows to run `blobExists`.

## Known Stubs
None.

## Self-Check: PASSED
