// Spawns tour.exe the way the extension will (stdin pipe kept open, no shell) and logs its JSONL.
// usage: node scripts/headless-run.mjs --out <file.jsonl> [--close-stdin-after <sec>] [--kill-after <sec>] -- <tour.exe> <args...>
import { spawn } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
const opts = argv.slice(0, sep);
const [exe, ...args] = argv.slice(sep + 1);
const opt = (name) => {
  const i = opts.indexOf(name);
  return i < 0 ? undefined : opts[i + 1];
};
const out = opt('--out');
const closeAfter = opt('--close-stdin-after');
const killAfter = opt('--kill-after');
if (sep < 0 || !exe || !out) {
  console.error('usage: node headless-run.mjs --out <file> [--close-stdin-after s] [--kill-after s] -- <exe> <args...>');
  process.exit(2);
}

writeFileSync(out, '');
const t0 = Date.now();
const el = () => ((Date.now() - t0) / 1000).toFixed(1);
const child = spawn(exe, args, { stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true, shell: false });

let rest = '';
const line = (l) => {
  if (!l) return;
  appendFileSync(out, l + '\n');
  console.log(`[${el()}s] ${l}`);
};
child.stdout.on('data', (d) => {
  const parts = (rest + d).split(/\r?\n/);
  rest = parts.pop();
  parts.forEach(line);
});
if (closeAfter) setTimeout(() => child.stdin.end(), Number(closeAfter) * 1000);
if (killAfter) setTimeout(() => process.kill(child.pid), Number(killAfter) * 1000); // hard kill, no tree
child.on('error', (e) => {
  console.error('spawn failed:', e.message);
  process.exit(1);
});
child.on('close', (code) => {
  line(rest);
  console.log(`exit=${code}`);
  process.exit(code ?? 1);
});
