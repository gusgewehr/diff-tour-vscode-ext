export type Language = 'en' | 'ja' | 'zh' | 'zh-Hant' | 'es' | 'ru';
export interface Settings { language: Language; llm: string; minFiles: number; cliPath: string; claudePath: string; baseBranch: string }
export interface ConfigLike { get<T>(key: string, defaultValue: T): T }

const LANGS: string[] = ['en', 'ja', 'zh', 'zh-Hant', 'es', 'ru'];

export function languageFromLocale(locale: string): Language {
  const l = (locale || '').toLowerCase();
  if (l.startsWith('ja')) return 'ja';
  if (l === 'zh-tw' || l === 'zh-hk' || l === 'zh-mo' || l.startsWith('zh-hant')) return 'zh-Hant';
  if (l.startsWith('zh')) return 'zh';
  if (l.startsWith('es')) return 'es';
  if (l.startsWith('ru')) return 'ru';
  return 'en';
}

export function readSettings(config: ConfigLike, locale: string): Settings {
  const lang = config.get<string>('language', '');
  const min = Number(config.get<unknown>('minFiles', 10));
  return {
    language: LANGS.includes(lang) ? (lang as Language) : languageFromLocale(locale),
    llm: config.get<string>('llm', '') || 'claude',
    minFiles: Number.isFinite(min) ? Math.max(1, Math.floor(min)) : 10,
    cliPath: String(config.get<string>('cliPath', '') ?? '').trim(),
    claudePath: String(config.get<string>('claudePath', '') ?? '').trim(),
    baseBranch: String(config.get<string>('baseBranch', '') ?? '').trim(),
  };
}
