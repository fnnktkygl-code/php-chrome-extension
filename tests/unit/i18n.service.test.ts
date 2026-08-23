import { describe, it, expect } from 'vitest';
import { I18nService } from '../../src/application/i18n.service';

describe('I18nService', () => {
  it('defaults to English locale', () => {
    const i18n = new I18nService();
    expect(i18n.getLocale()).toBe('en');
    expect(i18n.t('tabAll')).toBe('All');
  });

  it('switches between locales seamlessly', () => {
    const i18n = new I18nService('en');
    expect(i18n.t('tabAll')).toBe('All');

    i18n.setLocale('fr');
    expect(i18n.getLocale()).toBe('fr');
    expect(i18n.t('tabAll')).toBe('Tout');
  });

  it('interpolates positional arguments {0}, {1}', () => {
    const i18n = new I18nService('en');
    expect(i18n.t('searchResults', 5, 's')).toBe('5 results');
    expect(i18n.t('searchResults', 1, '')).toBe('1 result');

    i18n.setLocale('fr');
    expect(i18n.t('searchResults', 5, 's')).toBe('5 résultats');
  });

  it('falls back to key if translation is missing', () => {
    const i18n = new I18nService('en');
    expect(i18n.t('nonExistentKey')).toBe('nonExistentKey');
  });

  describe('formatRelativeTime', () => {
    it('formats recent timestamps accurately', () => {
      const i18n = new I18nService('en');
      const now = Date.now();

      expect(i18n.formatRelativeTime(now - 10000)).toBe('just now');
      expect(i18n.formatRelativeTime(now - 120000)).toBe('2m ago');
      expect(i18n.formatRelativeTime(now - 7200000)).toBe('2h ago');
      expect(i18n.formatRelativeTime(now - 172800000)).toBe('2d ago');
    });

    it('formats timestamps in French', () => {
      const i18n = new I18nService('fr');
      const now = Date.now();

      expect(i18n.formatRelativeTime(now - 10000)).toBe("à l'instant");
      expect(i18n.formatRelativeTime(now - 120000)).toBe('il y a 2m');
      expect(i18n.formatRelativeTime(now - 7200000)).toBe('il y a 2h');
      expect(i18n.formatRelativeTime(now - 172800000)).toBe('il y a 2j');
    });
  });
});
