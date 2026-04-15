import { DOCUMENT } from '@angular/common';
import { effect, Inject, Injectable, signal } from '@angular/core';

import { AppLanguage, translateUiText } from '../shared/i18n/ui-translations';

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
    this.language.update((current) => (current === 'en' ? 'zh' : 'en'));
  }

  translate(value: string | null | undefined): string {
    return translateUiText(String(value ?? ''), this.language());
  }

  locale(): string {
    return this.language() === 'en' ? 'en-CA' : 'zh-CN';
  }

  private readInitialLanguage(): AppLanguage {
    if (typeof localStorage === 'undefined') {
      return 'zh';
    }

    const stored = String(localStorage.getItem(this.storageKey) || '').trim().toLowerCase();
    return stored === 'en' ? 'en' : 'zh';
  }
}
