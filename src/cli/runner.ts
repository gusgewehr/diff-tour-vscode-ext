import { spawn, execFile } from 'node:child_process';
import { parseLine, type CliEvent, type DoneEvent, type ErrorEvent } from './progress';
import type { Target } from '../git/changes';
import type { Settings } from '../settings';

export interface SpawnSpec { command: string; args: string[]; cwd?: string; env?: NodeJS.ProcessEnv }
export interface RunResult { exitCode: number | null; done?: DoneEvent; error?: ErrorEvent; cancelled: boolean; stderrTail: string[]; spawnError?: string }
export interface RunHandle { cancel(): void; done: Promise<RunResult> }

export function run(spec: SpawnSpec, onEvent: (e: CliEvent) => void, opts: { log?: (line: string) => void; graceMs?: number } = {}): RunHandle {
  const child = spawn(spec.command, spec.args, { cwd: spec.cwd, env: spec.env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let done: DoneEvent | undefined;
  let error: ErrorEvent | undefined;
  let cancelRequested = false;
  let closed = false;
  let timer: NodeJS.Timeout | undefined;
  const stderrTail: string[] = [];
  let outBuf = '';
  let errBuf = '';
  child.stdin.on('error', () => { /* EPIPE after exit */ });

  const handleOut = (line: string) => {
    if (!line.trim()) return;
    const e = parseLine(line);
    if (!e) { opts.log?.(line); return; }
    if (e.type === 'done') { const { type: _t, ...r } = e; done = r; }
    if (e.type === 'error') error = { code: e.code, message: e.message, problems: e.problems };
    onEvent(e);
  };
  const handleErr = (line: string) => {
    if (!line) return;
    opts.log?.(line);
    stderrTail.push(line);
    if (stderrTail.length > 50) stderrTail.shift();
  };
  const feed = (buf: string, chunk: string, fn: (l: string) => void) => {
    const parts = (buf + chunk).split(/\r?\n/);
    const tail = parts.pop() ?? '';
    parts.forEach(fn);
    return tail;
  };
  child.stdout.on('data', (d) => { outBuf = feed(outBuf, d.toString('utf8'), handleOut); });
  child.stderr.on('data', (d) => { errBuf = feed(errBuf, d.toString('utf8'), handleErr); });

  const promise = new Promise<RunResult>((resolve) => {
    let settled = false;
    const finish = (r: { exitCode: number | null; spawnError?: string }) => {
      if (settled) return;
      settled = true;
      closed = true;
      if (timer) clearTimeout(timer);
      resolve({ ...r, done, error, cancelled: cancelRequested || error?.code === 'cancelled', stderrTail });
    };
    child.on('error', (err) => finish({ exitCode: null, spawnError: err.message }));
    child.on('close', (code) => {
      handleOut(outBuf); handleErr(errBuf);
      finish({ exitCode: code });
    });
  });

  return {
    done: promise,
    cancel() {
      if (cancelRequested) return;
      cancelRequested = true;
      try { child.stdin.end(); } catch { /* ignore */ }
      timer = setTimeout(() => {
        if (closed || !child.pid) return;
        if (process.platform === 'win32') execFile('taskkill', ['/T', '/F', '/PID', String(child.pid)], { windowsHide: true }, () => {});
        else child.kill('SIGTERM');
      }, opts.graceMs ?? 3000);
    },
  };
}

export function cliLlm(llm: string): string {
  return llm === 'claude' ? 'claude-code' : llm;
}

export function cliArgs(t: Pick<Target, 'kind' | 'base' | 'head' | 'baseSha' | 'headSha'>, s: Pick<Settings, 'llm' | 'language'>, repo: string): string[] {
  const range = t.kind === 'branch' ? `${t.base}..${t.head}` : `${t.baseSha}..${t.headSha}`;
  return ['--json', '--llm', cliLlm(s.llm), '--lang', s.language, '--repo', repo, range];
}
