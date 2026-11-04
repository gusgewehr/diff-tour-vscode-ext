// Measures the CLI-07 flow-node -> file heuristic. usage: node flow-mapping-check.mjs <tour.json>...
// Heuristic (port this to Phase 8): candidates = distinct code.file / diff.file in the tour; score vs lowercased label:
// full path = 3, basename with ext = 2, basename stem (len>=3) as whole word (camel/snake split) = 1; best>0 wins, tie = ambiguous.
import { readFileSync } from 'node:fs';

const words = (s) =>
  s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

export function mapNode(label, files) {
  const l = label.toLowerCase();
  const lw = words(label).join(' ');
  let best = 0, winners = [];
  for (const f of files) {
    const base = f.split('/').pop().toLowerCase();
    const stem = base.replace(/\.[^.]*$/, '');
    let s = 0;
    if (l.includes(f.toLowerCase())) s = 3;
    else if (l.includes(base)) s = 2;
    else if (stem.length >= 3 && ` ${lw} `.includes(` ${words(stem).join(' ')} `)) s = 1;
    if (s > best) { best = s; winners = [f]; } else if (s === best && s > 0) winners.push(f);
  }
  return winners.length === 1 ? winners[0] : null;
}

const tot = { flows: 0, nodes: 0, ext: 0, mapped: 0 };
for (const p of process.argv.slice(2)) {
  const t = JSON.parse(readFileSync(p, 'utf8'));
  const steps = t.chapters.flatMap((c) => c.steps);
  const files = new Set();
  steps.forEach((s) => s.blocks.forEach((b) => { if (b.code?.file) files.add(b.code.file); if (b.diff?.file) files.add(b.diff.file); }));
  const c = { flows: 0, nodes: 0, ext: 0, mapped: 0 };
  console.log(`\n${p} (${files.size} candidate files, ${steps.length} steps)`);
  steps.forEach((s) => s.blocks.forEach((b) => {
    if (!b.flow) return;
    c.flows++;
    for (const n of b.flow.nodes) {
      c.nodes++;
      if (n.kind === 'external') { c.ext++; continue; }
      const f = mapNode(n.label, files);
      if (f) {
        c.mapped++;
        const idx = steps.map((st, i) => (st.blocks.some((x) => x.code?.file === f) ? i : -1)).filter((i) => i >= 0);
        console.log(`  ${n.label} -> ${f} (steps ${idx.join(',')})`);
      } else console.log(`  ${n.label} -> UNMAPPED`);
    }
  }));
  const ne = c.nodes - c.ext;
  console.log(`  flows=${c.flows} nodes=${c.nodes} external=${c.ext} non-external=${ne} mapped=${c.mapped} (${ne ? ((100 * c.mapped) / ne).toFixed(0) : 0}%)`);
  for (const k in tot) tot[k] += c[k];
}
const ne = tot.nodes - tot.ext;
console.log(`\nTOTAL flows=${tot.flows} nodes=${tot.nodes} external=${tot.ext} non-external=${ne} mapped=${tot.mapped} percent mapped: ${ne ? ((100 * tot.mapped) / ne).toFixed(0) : 0}%`);
