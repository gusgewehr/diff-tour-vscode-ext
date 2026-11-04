// Replays a fixtures/tours/*.progress.jsonl like the real CLI. Usage: node fake-tour.mjs <file.progress.jsonl> [delayMs=20]
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.argv[2]);
const delay = Number(process.argv[3] ?? 20);
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
console.error(`fake-tour: replaying ${file}`);
process.stdin.resume();
let finished = false;
process.stdin.on('end', () => {
  if (finished) return;
  process.stdout.write(JSON.stringify({ v: 1, type: 'error', code: 'cancelled', message: 'context canceled' }) + '\n', () => process.exit(1));
});
process.stdin.on('error', () => {});
for (const line of lines) {
  let out = line;
  const o = JSON.parse(line);
  if (o.type === 'done') out = JSON.stringify({ ...o, path: file.replace(/\.progress\.jsonl$/, '.json') });
  process.stdout.write(out + '\n');
  if (delay > 0) await new Promise((r) => setTimeout(r, delay));
}
finished = true;
process.exit(0);
