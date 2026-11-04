# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-03)

**Core value:** A reviewer can walk an LLM-written tour of a git change inside VS Code, and every piece of code the tour points to opens read-only, side by side, at the exact commit the tour talks about.
**Current focus:** Phase 1: Verify diff-tour CLI JSON + headless fork

## Current Position

Phase: 1 of 8 (Verify diff-tour CLI JSON + headless fork)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-11-03 - Roadmap created

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

## Accumulated Context

### Decisions

- Fork the diff-tour CLI for headless JSON/JSONL output
- Phase 1 verifies the CLI and schema before any extension code depends on it
- Claude Code is the only provider tested in v1; VSIX distribution only
- Extension owns tour cache under globalStorageUri; the CLI `done` event carries key, path, SHAs

### Pending Todos

None yet.

### Blockers/Concerns

- Phases 1, 4, 6, 8 need deeper research/spikes (see ROADMAP.md)
- Go 1.27.2 toolchain not yet verified locally (local Go 1.26.1)
- Upstream CLI untested on Windows; cancel must kill the process tree
- Flow node -> file mapping has no upstream data source (decided in CLI-07)

## Session Continuity

Last session: 2026-11-03
Stopped at: Roadmap created
Resume file: None
