import { describe, expect, it } from 'vitest';
import { isFallback, pickBilingual, pickLocalized } from './localized-text';

const full = { en: 'Resultant force', ru: 'Равнодействующая сила', zh: '合力' };
const englishOnly = { en: 'Resultant force' };

describe('pickLocalized', () => {
  it('returns the requested language when it exists', () => {
    expect(pickLocalized(full, 'ru')).toEqual({ text: full.ru, language: 'ru', fallback: false });
    expect(pickLocalized(full, 'zh')).toEqual({ text: full.zh, language: 'zh', fallback: false });
    expect(pickLocalized(full, 'en')).toEqual({ text: full.en, language: 'en', fallback: false });
  });

  it('falls back to English and says so, instead of returning nothing', () => {
    const picked = pickLocalized(englishOnly, 'ru');
    expect(picked.text).toBe('Resultant force');
    expect(picked.language).toBe('en');
    expect(picked.fallback).toBe(true);
    expect(isFallback(englishOnly, 'ru')).toBe(true);
    expect(isFallback(full, 'ru')).toBe(false);
  });

  it('never returns an empty string', () => {
    for (const language of ['en', 'ru', 'en-ru', 'zh'] as const) {
      expect(pickLocalized(englishOnly, language).text.length).toBeGreaterThan(0);
      expect(pickLocalized(full, language).text.length).toBeGreaterThan(0);
    }
  });

  it('treats a blank translation as missing', () => {
    expect(pickLocalized({ en: 'Resultant force', ru: '   ' }, 'ru')).toEqual({
      text: 'Resultant force',
      language: 'en',
      fallback: true,
    });
  });

  it('uses English as the primary in bilingual mode and does not mark it a fallback', () => {
    expect(pickLocalized(full, 'en-ru')).toEqual({ text: full.en, language: 'en', fallback: false });
  });
});

describe('pickBilingual', () => {
  it('returns both halves when a translation exists', () => {
    expect(pickBilingual(full, 'en-ru')).toEqual({ primary: full.en, secondary: full.ru });
  });

  it('returns only the English half when there is no translation', () => {
    expect(pickBilingual(englishOnly, 'en-ru')).toEqual({ primary: 'Resultant force', secondary: null });
  });

  it('returns a single half for the single-language modes', () => {
    expect(pickBilingual(full, 'ru')).toEqual({ primary: full.ru, secondary: null });
    expect(pickBilingual(full, 'en')).toEqual({ primary: full.en, secondary: null });
  });
});
