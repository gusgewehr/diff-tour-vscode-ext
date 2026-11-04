# Feature Landscape

**Domain:** In-editor guided code-review tour of a git change, written by an LLM (VS Code)
**Researched:** 2026-11-03
**Confidence:** MEDIUM. Comparable-product features come from training knowledge (CodeTour, GitHub Pull Requests extension, GitLens, CodeRabbit) and were not re-verified against current docs in this pass. The spec (`docs/handoff/README.md`) is the authority for scope. Items marked (verify) should be spot-checked before they drive a requirement.

## Comparable products, in one paragraph each

- **CodeTour (vsls-contrib)**: hand-authored `.tour` JSON files in `.tours/`. Each step is file + line (or directory/URI), plus Markdown. Has a tree view of tours, a step player with prev/next, a status bar entry, and an optional git `ref` pin so steps match a commit. Uses the Comments API for step UI. Its weakness is that steps are static, authored by hand, anchored to lines that drift, and not diff-aware. (MEDIUM)
- **GitHub Pull Requests extension**: Changes-in-PR tree, diff editor per file, inline comment threads via the Comments API, a per-file "Viewed" checkbox, pending review, and checkout. It is a strong review baseline but has no narrative or ordering, so the reviewer decides where to start. (MEDIUM)
- **GitLens / Git Graph**: commit and branch compare, file history, and blame. Navigation of history, not explanation. Their lesson: reviewers expect native diff editors and the SCM tree, not custom renderers. (MEDIUM)
- **AI PR reviewers (CodeRabbit in-editor, Copilot review)**: a findings list with severity, inline comments on lines, a summary and walkthrough, and "apply fix" buttons. They output findings, not a reading order. Their lesson: trust issues. Reviewers want to know whether a claim is fact or guess, and they dislike auto-applied code. (LOW to MEDIUM)

The gap diff-tour fills: **an ordered narrative of a diff, with the reviewer driving**. Authoring (CodeTour) is manual, and AI reviewers give findings without a path.

## Table Stakes

Missing any of these and the product feels broken next to CodeTour or the PR extension.

| Feature | Why Expected | Complexity | Spec step | Notes |
|---------|--------------|------------|-----------|-------|
| Pick a change (branch, commit, range, saved tour) via QuickPick | Every git tool starts here | Low | 1 | PR listing needs `gh`/GitHub auth. For v1, ship the branch/commit/range/file groups and add PRs only if `gh` is cheap |
| Activity-bar TOUR view container | CodeTour and GitLens set the expectation | Low | 1 | Same groups as QuickPick |
| Outline tree (chapters, steps) with current/done markers | CodeTour has a tour tree | Low | 4 | Native TreeView |
| Prev/next + keyboard nav | Core of any tour player | Low | 4 | Webview focus issues: keybindings must work both inside and outside the Webview |
| Persisted position and progress per tour | Reviews span sessions | Low | 4 | `workspaceState`, keyed by tour id |
| Click a file reference to open the code | CodeTour's central action | Med | 5 | Here: always `vscode.diff` read-only at the toured SHA |
| Read-only, commit-accurate content (`difftour:` provider) | Line drift is CodeTour's known flaw. Pinning to the SHA is what fixes it | Med | 5 | `git show <sha>:<path>`. Handle binary, deleted, new, renamed files |
| Native side-by-side diff for opened code | The PR extension and GitLens set this | Low | 5 | `vscode.diff` with selection |
| Way back to the step after opening code | Otherwise the reviewer gets lost in tabs | Low | 5 | "Back to step" control. A status bar item or QuickPick action may cost less than a floating mini-player (verify feasibility) |
| Progress feedback while the LLM writes (2-5 min), cancellable | A multi-minute silent wait is unacceptable | Med | 3 | Notification + Writing view. Needs a CLI progress stream (Phase 1 gate) |
| Cache and reopen saved tours instantly | Re-running the LLM costs time and money | Low | 3 | `globalStorageUri/tours/` |
| Small-change bypass (< minFiles opens plain diff) | Spec rule. Matches the PR extension for small changes | Low | 2 | Needs a git file count. Define the base for uncommitted changes |
| Settings (language, LLM binary path, minFiles) | Basic configurability | Low | 1 | Windows binary path matters |
| Theme-following UI | Webviews that ignore the theme feel foreign | Med | 4, 6 | Use `--vscode-*` variables, bundle fonts, no network |
| Code blocks with before/after alignment and marks | The core reading surface | High | 6 | LCS alignment, hatched missing side, notes under lines. Largest single UI effort |
| Error states: no repo, CLI missing, invalid JSON, cancelled | Review tools fail often | Med | 3 | Actionable messages, e.g. "tour not found on PATH" |

## Differentiators

What no comparable product has, or does worse. Rank by value to the core value statement.

| Feature | Value Proposition | Complexity | Spec step | Notes |
|---------|-------------------|------------|-----------|-------|
| LLM-written tour of a diff (chapters, steps, rationale) | Replaces both hand-authoring (CodeTour) and unordered findings (CodeRabbit) | External (CLI) | 3 | Product core, but the work sits in the CLI, not the extension |
| Flow bar (clickable request-flow strip, always visible) | Gives a spatial map that no linear tour player has | High | 7 | Depends on the flow-to-file-to-step mapping existing in the JSON, or on derivation. Highest schema risk |
| Evidence-basis tags (Verified / From the code / Senior view) | Answers "can I trust this sentence?", the main AI-review complaint | Low | 6 | Render-only if the JSON has `basis`. Cheap trust win |
| Question / guess blocks ("Stop and predict") | Active review instead of passive reading | Med | 6 | Guess stored in state and shown again on the answer step |
| Mark understood + private notes (never in repo) | Review as a checklist with memory | Low | 4 | Part of the player |
| Rich non-code blocks: timeline, schema, table, flow diagrams | Explains the change, not only the lines | High | 6 | Build in order of use in the fixture. Start with list/quote/table/target/files, then timeline/flow/schema |
| Example snippet (copy only, never applied) | Shows a fix without breaking the read-only promise | Low | 6 | Copy button only |
| Findings with weight (Must / Suggestion / Question / Nit / Praise) | Triage built into the narrative | Low in v1 | 6 | Render as badges. The "Draft PR comment" button is v2 |
| Provenance banner on opened code | Explains why the code differs from the working tree | Low | 5 | Diff editor title and a description string. A banner may need a status bar or notification (verify) |
| Skip-the-tour rule | Honest about when a tour is overkill | Low | 2 | Already table stakes inside the product |

## Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Auto-apply LLM fixes / "Fix with AI" | Breaks the read-only guarantee, which is part of the trust story | Copy-only Example snippet |
| Writing to the working tree or checking out the toured branch | PR-extension-style checkout is intrusive and risks data loss | Read from git objects via `difftour:` |
| Hand-authoring or editing tours in the extension | CodeTour already owns this and it is out of the product's idea | Saved tours are read-only JSON |
| Custom diff renderer for opened files | Native `vscode.diff` is already better and themed | Webview code blocks only inside the tour document |
| Webview-rendered prose with remote fonts or assets | Offline constraint, and it is a CSP risk | Bundle locally |
| Multi-provider LLM matrix in v1 | Only Claude Code is tested | Pass the CLI choice through settings, label others untested |
| Copying prototype HTML/JS as production code | Spec forbids it | Port the design, not the code |
| Line-anchored tours that point at the working tree | Drift is the known CodeTour failure | Always anchor to base/head SHAs |
| Telemetry or sending repo data from the extension | The CLI already controls what the LLM sees | Do nothing in the extension |

## v2 deferrals: confirmed correct

| Deferred | Verdict | Reasoning |
|----------|---------|-----------|
| Focus layout | Defer | A second layout over the same Webview. Needs the Document layout proven first |
| Inline layout (decorations, CodeLens, gutter badges, balloon) | Defer, high cost | Highest-complexity item. The balloon needs a Webview inset, which VS Code does not offer to ordinary extensions, so this is a real feasibility risk (verify). Likely a Comments-API or CodeLens fallback |
| PR comments | Defer | Needs GitHub auth and a pending-review API. Not needed to prove the walk-through |
| Setup screen | Defer | Settings suffice for one provider. Worth adding a minimal "CLI not found" notice in v1 (see Error states) |
| i18n | Defer | Tour language already flows through `difftour.language` |

One cheap addition to consider for v1: **a "Copy as Markdown" on findings**. It needs no GitHub integration and gives reviewers an escape hatch until PR comments land. (Low complexity, optional.)

## Feature Dependencies

```
Phase 1 CLI JSON + progress verified
  -> CLI runner + Writing view (3)
  -> Tour model / cache (3)
       -> Document webview + outline + state (4)
            -> Blocks: code, diagrams, question/guess, snippet (6)
            -> difftour: provider + vscode.diff + Back to step (5)
                 -> Code blocks' "open" links (6)
                 -> Flow bar click -> next step or open file (7)
       -> flow.nodes in JSON (or derivation from code blocks) -> Flow bar (7)
QuickPick + file counts (1) -> Small-change rule (2) -> runner (3)
Weights on findings (6) -> [v2] Draft PR comment
Layout switch (4) -> [v2] Focus / Inline
```

Key sequencing facts:
- Step 5 (provider) must exist before step 6 code blocks have working "open" actions.
- Flow bar (7) is the only feature whose data may not exist upstream. If `flow` is absent, derive nodes from code-block files, and treat explicit `flowNodes` as an enhancement.
- Notes/guesses/understood state shares one store, so build it once in step 4.

## MVP Recommendation

Prioritize, in this order:
1. Steps 1-3 plus the CLI gate. Nothing else works without tour JSON.
2. Document layout with outline, nav, state (4).
3. `difftour:` read-only diffs and Back to step (5). This delivers the core value on its own.
4. Code blocks side by side plus list/table/quote/target/files/question/snippet blocks (6, first half).
5. Basis tags and weight badges (render only, cheap trust signals).

Then: timeline/flow/schema blocks, and the Flow bar (7), after confirming the JSON carries flow data.

Defer: everything in the v2 list; the floating mini-player if the native alternative works; PR listing if `gh` is not already set up.

## Sources

- `docs/handoff/README.md` and `.planning/PROJECT.md` (HIGH, project authority)
- CodeTour, GitHub Pull Requests, GitLens, Git Graph, CodeRabbit: training knowledge only, not re-fetched (MEDIUM to LOW). Spot-check the CodeTour `ref` field and the Comments API limits before committing to Inline-layout or banner design.
