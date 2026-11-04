import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
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

export async function detectTools(settings: Pick<Settings, 'cliPath' | 'llm'>, roots: string[]):
  Promise<{ cli?: string; missing: { what: 'cli' | 'claude'; message: string }[] }> {
  const missing: { what: 'cli' | 'claude'; message: string }[] = [];
  const cli = await resolveCli(settings.cliPath, roots);
  if (!cli.path) missing.push({ what: 'cli', message: cli.problem ?? 'The diff-tour CLI was not found.' });
  if (settings.llm === 'claude' && !(await findOnPath('claude'))) {
    missing.push({ what: 'claude', message: 'Claude Code (claude) was not found on PATH. Install it and sign in: npm install -g @anthropic-ai/claude-code, then run claude once.' });
  }
  return { cli: cli.path, missing };
}
