import type { RunResult } from './runner';

export type ErrorAction = 'Open Terminal' | 'Try again' | 'Show details' | 'Open Settings';

export function describeError(
  r: Pick<RunResult, 'error' | 'exitCode' | 'cancelled' | 'spawnError' | 'done'>,
): { text: string; actions: ErrorAction[] } | undefined {
  if (r.cancelled || r.error?.code === 'cancelled') return undefined;
  if (r.spawnError) return { text: `Could not start the diff-tour CLI: ${r.spawnError}`, actions: ['Open Settings', 'Show details'] };
  if (r.error) {
    const m = r.error.message;
    switch (r.error.code) {
      case 'not_signed_in':
        return { text: 'Claude Code is not signed in. Run `claude` once in a terminal, then try again.', actions: ['Open Terminal', 'Try again'] };
      case 'invalid_tour':
        return { text: 'The tour still had problems after 2 repairs.', actions: ['Try again', 'Show details'] };
      case 'git':
        return { text: `git failed: ${m}`, actions: ['Show details'] };
      case 'usage':
        return { text: `diff-tour CLI rejected the arguments: ${m}`, actions: ['Open Settings'] };
      default:
        return { text: `The LLM run failed: ${m}`, actions: ['Try again', 'Show details'] };
    }
  }
  if (r.exitCode === 0 && r.done) return undefined;
  return { text: `The diff-tour CLI stopped (exit code ${r.exitCode}) without a result.`, actions: ['Show details'] };
}
