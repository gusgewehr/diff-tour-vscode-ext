---
phase: 02-extension-skeleton-change-picker
plan: 01
subsystem: extension-scaffold
tags: [vscode, esbuild, git, settings]
requires: [phase-01 CLI --count contract]
provides: [package.json manifest, src/settings.ts, src/git/changes.ts]
affects: [02-02, 02-03]
tech-stack:
  added: [typescript@6, esbuild@0.28, "@types/vscode@1.110.0", "@types/node@22", "@vscode/vsce@4"]
key-files:
  created: [package.json, tsconfig.json, .vscodeignore, media/route.svg, src/settings.ts, src/git/changes.ts, src/settings.test.ts, src/git/changes.test.ts]
  modified: [.gitignore]
decisions:
  - "Target resolved via merge-base + git diff --name-only -z; cross-checked against tour.exe --count in tests (matches)"
  - "untrustedWorkspaces unsupported and cliPath scope machine (threat T-02-01/02)"
metrics:
  tasks: 2
  completed: 2026-11-04
---

# Phase 2 Plan 01: Scaffold and git change model Summary

Extension project scaffold (manifest with command, keybinding, view container, 5 settings; esbuild/tsc/node --test tooling) plus pure vscode-free settings and git modules (base detection, three-dot Target resolution, candidates, commits, ranges, gh PRs, saved tours, mapLimit), 8 passing tests including a real `tour.exe --count` cross-check.

## Deviations from Plan

None. The two tasks were committed separately (9a21b80, 0ab5eff). The CLI cross-check ran (not skipped) and agreed with resolveTarget.

## Self-Check: PASSED
