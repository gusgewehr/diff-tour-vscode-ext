---
phase: 03-small-change-rule
status: passed
verified: 2026-11-04
---

# Phase 3 verification

Checked by the orchestrator, autonomous mode.

| Req | Evidence | Status |
|-----|----------|--------|
| SMALL-01 | `src/small/smallChange.ts` replaces the `openSmallChange` stub. It opens the first file from `listChangedFiles` (`git diff --name-status -z -M`, merge-base SHAs) in `vscode.diff`, using git-extension URIs with a `difftour-git` fallback. No CLI or LLM call. | ✓ |
| SMALL-02 | The `difftour.smallChange` tree (`when: difftour.hasSmallChange`) lists files with M/A/D/R. Clicking a file opens its diff. | ✓ |
| SMALL-03 | `noticeText` gives "N files changed. Changes under MIN files open in the standard diff, without a tour." and comes with an Open Settings button. `statusText` gives `No tour · N files (under MIN)`. | ✓ |

Checks: `npm run typecheck` clean, `npm test` 16/16 pass, `npm run smoke` reports "7 commands, 2 views".

**Not checked:** a live VS Code session. The git-extension `toGitUri` path is mocked in the smoke test only.
