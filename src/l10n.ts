// vscode-free translator: pure modules import t() from here; extension.ts injects vscode.l10n.t at activation.
export type Translate = (message: string, ...args: Array<string | number | boolean>) => string;

export function format(message: string, ...args: Array<string | number | boolean>): string {
  return message.replace(/\{(\d+)\}/g, (m, i) => (args[Number(i)] === undefined ? m : String(args[Number(i)])));
}

let impl: Translate = format;
let lang = 'en';

export function t(message: string, ...args: Array<string | number | boolean>): string {
  return impl(message, ...args);
}

export function setTranslator(fn: Translate, language: string): void {
  impl = fn;
  lang = language;
}

export function displayLanguage(): string {
  return lang;
}
