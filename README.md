# diff-tour for VS Code

Pick a git change (branch, PR, commit, range), let an LLM CLI write a tour of it, and walk it inside VS Code. Small changes open in the standard diff; code is always shown read-only from git.

## Install

Download the VSIX for your platform from [Releases](https://github.com/gusgewehr/diff-tour-vscode-ext/releases) (`diff-tour-win32-x64.vsix` or `diff-tour-linux-x64.vsix`) and run `code --install-extension <file>`. It includes the forked diff-tour CLI, so there is nothing to configure. The official diff-tour CLI has no `--json` mode and does not work with the extension. Install git and Claude Code (`claude`), and sign in to Claude Code once.

To build from source (needs Node and Go): `npm install && npm run package`, which writes one VSIX per platform.

## Usage

Run **diff-tour: Tour a change** from the command palette, press Ctrl+Alt+T (Cmd+Alt+T on macOS), or use the Tour view in the activity bar.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `difftour.language` | `""` (auto) | Language of the tour |
| `difftour.llm` | `claude` | LLM CLI (only Claude Code is tested in v1) |
| `difftour.minFiles` | `10` | Changes with fewer files open in the standard diff |
| `difftour.cliPath` | `""` | Path to `tour`; empty = the CLI bundled in the VSIX, then PATH |
| `difftour.baseBranch` | `""` | Empty = origin/HEAD, then main, then master |
