// Builds one VSIX per platform with the forked CLI in cli/bin/, so the extension finds it with no cliPath.
// Run after `npm run build`. Needs Go (cross-compiles; the CLI is pure Go).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const targets = [
  { vsce: 'linux-x64', goos: 'linux', goarch: 'amd64', bin: 'tour' },
  // windows last, so cli/bin/tour.exe is left as a working local build
  { vsce: 'win32-x64', goos: 'windows', goarch: 'amd64', bin: 'tour.exe' },
];

fs.mkdirSync('cli/bin', { recursive: true });
for (const t of targets) {
  for (const f of fs.readdirSync('cli/bin')) fs.rmSync(`cli/bin/${f}`);
  execFileSync('go', ['build', '-o', `bin/${t.bin}`, './cmd/tour'], {
    cwd: 'cli', stdio: 'inherit', env: { ...process.env, GOOS: t.goos, GOARCH: t.goarch, CGO_ENABLED: '0' },
  });
  execFileSync(process.execPath, ['node_modules/@vscode/vsce/vsce', 'package', '--no-dependencies', '--allow-missing-repository',
    '--skip-license', '--target', t.vsce, '-o', `diff-tour-${t.vsce}.vsix`], { stdio: 'inherit' });
}
