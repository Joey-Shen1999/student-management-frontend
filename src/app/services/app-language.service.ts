import { DOCUMENT } from '@angular/common';
import { effect, Inject, Injectable, signal } from '@angular/core';

import { AppLanguage, LocalizedText, translateUiText } from '../shared/i18n/ui-translations';

@Injectable({ providedIn: 'root' })
export class AppLanguageService {
  readonly language = signal<AppLanguage>(this.readInitialLanguage());
  readonly storageKey = 'student-management.app-language';

  constructor(@Inject(DOCUMENT) private readonly document: Document) {
    effect(() => {
      const language = this.language();

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, language);
      }

      const html = this.document?.documentElement;
      if (html) {
        html.lang = language === 'en' ? 'en' : 'zh-CN';
      }

      const body = this.document?.body;
      if (body) {
        body.dataset['appLanguage'] = language;
      }
    });
  }

  setLanguage(language: AppLanguage): void {
    this.language.set(language);
  }

  toggleLanguage(): void {
    this.language.update((current) => (current === 'zh' ? 'en' : 'zh'));
  }

  translate(value: string | LocalizedText | null | undefined): string {
    return translateUiText(value, this.language());
  }

  locale(): string {
    return this.language() === 'en' ? 'en-CA' : 'zh-CN';
  }

  private readInitialLanguage(): AppLanguage {
    if (typeof localStorage === 'undefined') {
      return 'zh';
    }

    const stored = String(localStorage.getItem(this.storageKey) || '').trim().toLowerCase();
    if (stored === 'zh' || stored === 'en') {
      return stored;
    }

    // Migration: previous versions used "both" for bilingual mode.
    if (stored === 'both') {
      return 'zh';
    }

    return 'zh';
  }
}
