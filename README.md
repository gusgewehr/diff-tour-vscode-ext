# diff-tour for VS Code

Pick a git change (branch, PR, commit, range), let an LLM CLI write a tour of it, and walk it inside VS Code. Small changes open in the standard diff; code is always shown read-only from git.

## Install

```
npm install
npm run package
code --install-extension diff-tour.vsix
```

The extension needs the diff-tour CLI fork. Build it with `cd cli && go build -o bin/tour.exe ./cmd/tour`, or point `difftour.cliPath` at a `tour` binary. Claude Code (`claude`) must be on PATH and signed in.

## Usage

Run **diff-tour: Tour a change** from the command palette, press Ctrl+Alt+T (Cmd+Alt+T on macOS), or use the Tour view in the activity bar.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `difftour.language` | `""` (auto) | Language of the tour |
| `difftour.llm` | `claude` | LLM CLI (only Claude Code is tested in v1) |
| `difftour.minFiles` | `10` | Changes with fewer files open in the standard diff |
| `difftour.cliPath` | `""` | Path to `tour`; empty = `cli/bin/tour.exe`, then PATH |
| `difftour.baseBranch` | `""` | Empty = origin/HEAD, then main, then master |
