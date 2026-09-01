import type { ExplanationLanguage, LocalizedText } from '@/domain';

export interface LocalizedPick {
  /** The best available text. Never empty: English is always present. */
  text: string;
  /** The language actually shown, which may differ from the one requested. */
  language: 'en' | 'ru' | 'zh';
  /** True when the requested language had no translation for this item. */
  fallback: boolean;
}

const ORDER: Record<ExplanationLanguage, ('en' | 'ru' | 'zh')[]> = {
  en: ['en'],
  ru: ['ru', 'en'],
  'en-ru': ['en', 'ru'],
  zh: ['zh', 'en'],
};

function preferredOf(language: ExplanationLanguage): 'en' | 'ru' | 'zh' {
  return language === 'en-ru' ? 'en' : language;
}

/**
 * Chooses the text for the learner's explanation language.
 *
 * The English field is required by the schema, so there is always something to
 * show. When the requested language is missing, the caller is told, so the
 * interface can say "English only for this item" instead of rendering a blank
 * space or silently pretending the choice was honoured.
 */
export function pickLocalized(
  value: LocalizedText,
  language: ExplanationLanguage,
): LocalizedPick {
  const preferred = preferredOf(language);
  for (const candidate of ORDER[language] ?? ORDER.en) {
    const text = value[candidate];
    if (text && text.trim().length > 0) {
      return { text, language: candidate, fallback: candidate !== preferred };
    }
  }
  return { text: value.en, language: 'en', fallback: preferred !== 'en' };
}

/** True when the learner asked for a language this item does not have. */
export function isFallback(value: LocalizedText, language: ExplanationLanguage): boolean {
  return pickLocalized(value, language).fallback;
}

/** Both halves for the bilingual mode, when a translation exists. */
export function pickBilingual(
  value: LocalizedText,
  language: ExplanationLanguage,
): { primary: string; secondary: string | null } {
  if (language !== 'en-ru') return { primary: pickLocalized(value, language).text, secondary: null };
  return { primary: value.en, secondary: value.ru && value.ru !== value.en ? value.ru : null };
}
