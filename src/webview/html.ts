import * as crypto from 'node:crypto';
import { displayLanguage, t } from '../l10n';
import { localized } from './strings';

export function nonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function webviewHtml(o: { cspSource: string; nonce: string; scriptUri: string; styleUris: string[]; title: string }): string {
  const csp = [
    "default-src 'none'",
    `style-src ${o.cspSource}`,
    `script-src 'nonce-${o.nonce}'`,
    `font-src ${o.cspSource}`,
    `img-src ${o.cspSource} data:`,
  ].join('; ');
  const links = o.styleUris.map((u) => `<link rel="stylesheet" href="${esc(u)}">`).join('\n');
  return `<!DOCTYPE html>
<html lang="${esc(displayLanguage())}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${esc(csp)}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${links}
<title>${esc(o.title)}</title>
</head>
<body>
<div id="root" data-strings="${esc(JSON.stringify(localized((m) => t(m))))}"></div>
<script nonce="${esc(o.nonce)}" src="${esc(o.scriptUri)}"></script>
</body>
</html>`;
}
