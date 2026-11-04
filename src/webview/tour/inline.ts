export type InlineToken =
  | { t: 'text'; v: string } | { t: 'code'; v: string } | { t: 'bold'; v: string }
  | { t: 'file'; v: string; file: string; line: number; end?: number };

const FILE = '[\\w./-]*\\w\\.[A-Za-z0-9]{1,8}:\\d+(?:-\\d+)?';
const FILE_ONLY = /^([\w./-]*\w\.[A-Za-z0-9]{1,8}):(\d+)(?:-(\d+))?$/;
const SCAN = new RegExp('`([^`\\n]+)`|\\*\\*([^*\\n]+)\\*\\*|(?<![\\w./-])(' + FILE + ')(?![\\w-])', 'g');

function fileToken(v: string): InlineToken | undefined {
  const m = FILE_ONLY.exec(v);
  if (!m) return undefined;
  return { t: 'file', v, file: m[1], line: Number(m[2]), ...(m[3] ? { end: Number(m[3]) } : {}) };
}

export function tokenize(text: string): InlineToken[] {
  const out: InlineToken[] = [];
  const pushText = (v: string) => {
    if (!v) return;
    const last = out[out.length - 1];
    if (last && last.t === 'text') last.v += v; else out.push({ t: 'text', v });
  };
  let pos = 0;
  for (const m of text.matchAll(SCAN)) {
    pushText(text.slice(pos, m.index));
    pos = m.index + m[0].length;
    if (m[1] !== undefined) out.push(fileToken(m[1]) ?? { t: 'code', v: m[1] });
    else if (m[2] !== undefined) out.push({ t: 'bold', v: m[2] });
    else out.push(fileToken(m[3])!);
  }
  pushText(text.slice(pos));
  return out;
}
