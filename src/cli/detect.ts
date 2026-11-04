import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Settings } from '../settings';

const win32 = process.platform === 'win32';

export function findOnPath(name: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile(win32 ? 'where' : 'which', [name], { timeout: 5000, windowsHide: true }, (err, stdout) => {
      if (err) return resolve(undefined);
      resolve(String(stdout).split(/\r?\n/).map((l) => l.trim()).find(Boolean));
    });
  });
}

function version(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, ['--version'], { timeout: 5000, windowsHide: true }, (err, stdout) => {
      if (err) reject(err); else resolve(String(stdout).trim());
    });
  });
}

export async function resolveCli(setting: string, roots: string[]): Promise<{ path?: string; version?: string; problem?: string }> {
  const candidates: string[] = setting
    ? [setting]
    : roots.map((r) => path.join(r, 'cli', 'bin', win32 ? 'tour.exe' : 'tour')).filter((p) => fs.existsSync(p));
  if (!setting) { const p = await findOnPath('tour'); if (p) candidates.push(p); }
  let reason = '';
  for (const c of candidates) {
    try { return { path: c, version: await version(c) }; } catch (e) { reason = (e as Error).message; }
  }
  if (setting) return { problem: `difftour.cliPath is "${setting}", but it could not run (${reason}).` };
  return { problem: 'The diff-tour CLI (tour) was not found: not in cli/bin/ and not on PATH.' };
}

// Where the Claude Code installers put claude. VS Code started from a desktop launcher often lacks these on PATH.
const exe = win32 ? '.exe' : '';
export const CLAUDE_SPOTS = [
  path.join(os.homedir(), '.local', 'bin', `claude${exe}`),
  path.join(os.homedir(), '.claude', 'local', `claude${exe}`),
  path.join(os.homedir(), '.npm-global', 'bin', 'claude'),
  '/usr/local/bin/claude', '/opt/homebrew/bin/claude',
];

// Last absolute path in `command -v` output; also covers aliases ("alias claude='/home/x/.claude/local/claude'").
export function pathFromShell(out: string): string | undefined {
  return out.split(/\r?\n/).map((l) => l.match(/(\/[^\s'"]+)['"]?\s*$/)?.[1]).filter((p): p is string => !!p).pop();
}

function fromLoginShell(): Promise<string | undefined> {
  if (win32) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    execFile(process.env.SHELL || '/bin/bash', ['-ilc', 'command -v claude'], { timeout: 5000 }, (_err, stdout) => {
      const p = pathFromShell(String(stdout ?? ''));
      resolve(p && fs.existsSync(p) ? p : undefined);
    });
  });
}

export async function findClaude(setting = '', spots = CLAUDE_SPOTS): Promise<string | undefined> {
  if (setting) return fs.existsSync(setting) ? setting : undefined;
  return (await findOnPath('claude')) ?? spots.find((p) => fs.existsSync(p)) ?? (await fromLoginShell());
}

// The fork runs `claude` by name, so put the folder we found first on the CLI's PATH.
export function envWithDir(dir: string, env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  return { ...env, [key]: [dir, env[key]].filter(Boolean).join(path.delimiter) };
}

export async function detectTools(settings: Pick<Settings, 'cliPath' | 'llm'> & { claudePath?: string }, roots: string[]):
  Promise<{ cli?: string; claude?: string; missing: { what: 'cli' | 'claude'; message: string }[] }> {
  const missing: { what: 'cli' | 'claude'; message: string }[] = [];
  const cli = await resolveCli(settings.cliPath, roots);
  if (!cli.path) missing.push({ what: 'cli', message: cli.problem ?? 'The diff-tour CLI was not found.' });
  const claude = settings.llm === 'claude' ? await findClaude(settings.claudePath) : undefined;
  if (settings.llm === 'claude' && !claude) {
    missing.push({ what: 'claude', message: settings.claudePath
      ? `difftour.claudePath is "${settings.claudePath}", but that file does not exist.`
      : 'Claude Code (claude) was not found on PATH, in ~/.local/bin or ~/.claude/local, or in your shell. Install it and sign in (npm install -g @anthropic-ai/claude-code, then run claude once), or set difftour.claudePath to its full path (run `which claude` in a terminal).' });
  }
  return { cli: cli.path, claude, missing };
}
