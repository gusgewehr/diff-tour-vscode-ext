export type KeyAction = 'prev' | 'next' | 'understood' | 'note' | 'open' | 'blur';

export function keyAction(key: string, ctx: { typing: boolean; mod: boolean }): KeyAction | undefined {
  if (ctx.mod) return undefined;
  if (ctx.typing) return key === 'Escape' ? 'blur' : undefined;
  switch (key) {
    case 'ArrowLeft': return 'prev';
    case 'ArrowRight': return 'next';
    case 'u': case 'U': return 'understood';
    case 'n': case 'N': return 'note';
    case 'o': case 'O': return 'open';
  }
  return undefined;
}
