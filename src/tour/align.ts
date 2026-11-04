import type { At, Mark } from './model';

export interface HunkLine { t: ' ' | '-' | '+'; text: string }
export interface Hunk { oldStart: number; oldCount: number; newStart: number; newCount: number; header: string; lines: HunkLine[] }
export interface Cell { n: number; text: string; kind: 'same' | 'del' | 'add' }
export interface Row { left?: Cell; right?: Cell; focus: boolean; marks: { side: 'left' | 'right'; text: string }[] }
export interface CodeView { rows: Row[]; lines: [number, number]; added: number; removed: number; approximate: boolean }

export function splitLines(text: string): string[] {
  if (!text) return [];
  const l = text.split(/\r?\n/);
  if (l[l.length - 1] === '') l.pop();
  return l;
}

const HEAD = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;

export function parseHunks(diff: string): Hunk[] {
  const out: Hunk[] = [];
  let h: Hunk | undefined;
  let o = 0;
  let n = 0;
  for (const raw of diff.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (line.startsWith('diff ')) { h = undefined; o = n = 0; continue; }
    if (!h || (o <= 0 && n <= 0)) {
      const m = HEAD.exec(line);
      if (m) {
        h = { oldStart: +m[1], oldCount: m[2] === undefined ? 1 : +m[2], newStart: +m[3], newCount: m[4] === undefined ? 1 : +m[4], header: m[5], lines: [] };
        o = h.oldCount; n = h.newCount;
        out.push(h);
      }
      continue;
    }
    const c = line[0];
    if (c === ' ') { h.lines.push({ t: ' ', text: line.slice(1) }); o--; n--; }
    else if (c === '-') { h.lines.push({ t: '-', text: line.slice(1) }); o--; }
    else if (c === '+') { h.lines.push({ t: '+', text: line.slice(1) }); n--; }
  }
  return out;
}

const row = (left?: Cell, right?: Cell): Row => ({ left, right, focus: false, marks: [] });
const same = (o: number, n: number, text: string): Row => row({ n: o, text, kind: 'same' }, { n, text, kind: 'same' });

function pair(dels: Cell[], adds: Cell[]): Row[] {
  const r: Row[] = [];
  for (let i = 0; i < Math.max(dels.length, adds.length); i++) r.push(row(dels[i], adds[i]));
  return r;
}

export function alignFile(oldLines: string[], newLines: string[], hunks: Hunk[]): Row[] {
  const rows: Row[] = [];
  let o = 1;
  let n = 1;
  for (const h of hunks) {
    const stop = h.oldCount === 0 ? h.oldStart : h.oldStart - 1;
    while (o <= stop && o <= oldLines.length && n <= newLines.length) { rows.push(same(o, n, newLines[n - 1])); o++; n++; }
    o = h.oldCount === 0 ? h.oldStart + 1 : h.oldStart;
    const dels: Cell[] = [];
    const adds: Cell[] = [];
    for (let i = 0; i < h.oldCount && o + i <= oldLines.length; i++) dels.push({ n: o + i, text: oldLines[o + i - 1], kind: 'del' });
    for (let i = 0; i < h.newCount && n + i <= newLines.length; i++) adds.push({ n: n + i, text: newLines[n + i - 1], kind: 'add' });
    rows.push(...pair(dels, adds));
    o += h.oldCount; n += h.newCount;
  }
  while (o <= oldLines.length && n <= newLines.length) { rows.push(same(o, n, newLines[n - 1])); o++; n++; }
  return rows;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

function count(sections: Row[][]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const s of sections) for (const r of s) { if (r.right?.kind === 'add') added++; if (r.left?.kind === 'del') removed++; }
  return { added, removed };
}

export function codeView(i: { oldLines: string[]; newLines: string[]; hunks: Hunk[]; at: At; lines: [number, number]; show?: [number, number]; marks?: Mark[] }): CodeView {
  const side: 'left' | 'right' = i.at === 'base' ? 'left' : 'right';
  const len = (side === 'left' ? i.oldLines : i.newLines).length;
  if (len === 0) return { rows: [], lines: [1, 1], added: 0, removed: 0, approximate: true };
  const l0 = clamp(i.lines[0], 1, len);
  const l1 = clamp(i.lines[1], l0, len);
  let approximate = l0 !== i.lines[0] || l1 !== i.lines[1];
  let s0: number;
  let s1: number;
  if (i.show) {
    s0 = clamp(i.show[0], 1, len); s1 = clamp(i.show[1], 1, len);
    if (s0 !== i.show[0] || s1 !== i.show[1]) approximate = true;
    s0 = Math.min(s0, l0); s1 = Math.max(s1, l1);
  } else { s0 = clamp(l0 - 2, 1, len); s1 = clamp(l1 + 2, 1, len); }
  const all = alignFile(i.oldLines, i.newLines, i.hunks);
  const num = (r: Row) => r[side]?.n;
  const a = all.findIndex((r) => (num(r) ?? -1) >= s0);
  let b = -1;
  all.forEach((r, k) => { const v = num(r); if (v !== undefined && v <= s1) b = k; });
  const rows = a < 0 || b < a ? [] : all.slice(a, b + 1);
  const inLines = (r: Row) => { const v = num(r); return v !== undefined && v >= l0 && v <= l1; };
  const f = rows.findIndex(inLines);
  if (f >= 0) {
    let g = rows.length - 1;
    while (!inLines(rows[g])) g--;
    for (let k = f; k <= g; k++) rows[k].focus = true;
  }
  for (const m of i.marks ?? []) {
    if (m.line < s0 || m.line > s1) continue;
    rows.find((r) => num(r) === m.line)?.marks.push({ side, text: m.text });
  }
  return { rows, lines: [l0, l1], ...count([rows]), approximate };
}

export function diffView(hunks: Hunk[], select?: number[]): { sections: Row[][]; added: number; removed: number; approximate: boolean } {
  let approximate = false;
  let picks = (select ?? []).filter((x) => { const ok = Number.isInteger(x) && x >= 0 && x < hunks.length; if (!ok) approximate = true; return ok; });
  if (picks.length === 0) picks = hunks.map((_, k) => k);
  const sections = picks.map((k) => {
    const h = hunks[k];
    const rows: Row[] = [];
    let o = h.oldStart;
    let n = h.newStart;
    let dels: Cell[] = [];
    let adds: Cell[] = [];
    const flush = () => { rows.push(...pair(dels, adds)); dels = []; adds = []; };
    for (const l of h.lines) {
      if (l.t === '-') { if (adds.length) flush(); dels.push({ n: o++, text: l.text, kind: 'del' }); }
      else if (l.t === '+') adds.push({ n: n++, text: l.text, kind: 'add' });
      else { flush(); rows.push(same(o++, n++, l.text)); }
    }
    flush();
    return rows;
  });
  return { sections, ...count(sections), approximate };
}
