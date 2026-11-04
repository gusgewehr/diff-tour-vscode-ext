import type { RunResult } from './runner';
import { t } from '../l10n';

export type ErrorAction = 'Open Terminal' | 'Try again' | 'Show details' | 'Open Settings';

export function describeError(
  r: Pick<RunResult, 'error' | 'exitCode' | 'cancelled' | 'spawnError' | 'done'>,
): { text: string; actions: ErrorAction[] } | undefined {
  if (r.cancelled || r.error?.code === 'cancelled') return undefined;
  if (r.spawnError) return { text: t('Could not start the diff-tour CLI: {0}', r.spawnError), actions: ['Open Settings', 'Show details'] };
  if (r.error) {
    const m = r.error.message;
    switch (r.error.code) {
      case 'not_signed_in':
        return { text: t('Claude Code is not signed in. Run `claude` once in a terminal, then try again.'), actions: ['Open Terminal', 'Try again'] };
      case 'invalid_tour':
        return { text: t('The tour still had problems after 2 repairs.'), actions: ['Try again', 'Show details'] };
      case 'git':
        return { text: t('git failed: {0}', m), actions: ['Show details'] };
      case 'usage':
        return { text: t('diff-tour CLI rejected the arguments: {0}', m), actions: ['Open Settings'] };
      default:
        return { text: t('The LLM run failed: {0}', m), actions: ['Try again', 'Show details'] };
    }
  }
  if (r.exitCode === 0 && r.done) return undefined;
  return { text: t('The diff-tour CLI stopped (exit code {0}) without a result.', String(r.exitCode)), actions: ['Show details'] };
}
