import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

import { AppLanguageService } from '../../services/app-language.service';
import { AppLanguage } from '../i18n/ui-translations';

@Component({
  selector: 'app-language-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="global-language-toggle" data-no-auto-translate>
      <button
        type="button"
        class="language-option"
        [class.active]="language.language() === 'zh'"
        [attr.aria-pressed]="language.language() === 'zh'"
        title="\u5207\u6362\u5230\u4e2d\u6587"
        aria-label="\u5207\u6362\u5230\u4e2d\u6587"
        (click)="setLanguage('zh')"
      >
        \u4e2d\u6587
      </button>
      <button
        type="button"
        class="language-option"
        [class.active]="language.language() === 'en'"
        [attr.aria-pressed]="language.language() === 'en'"
        title="Switch to English"
        aria-label="Switch to English"
        (click)="setLanguage('en')"
      >
        English
      </button>
    </div>
  `,
  styles: [
    `
      .global-language-toggle {
        position: fixed;
        top: 14px;
        left: 14px;
        z-index: 2100;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px;
        border: 1px solid #c8d2e0;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 10px 24px rgba(21, 40, 68, 0.14);
        backdrop-filter: blur(8px);
      }

      .language-option {
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: #5a677c;
        min-width: 44px;
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 700;
        line-height: 1;
        cursor: pointer;
      }

      .language-option.active {
        background: #1f2f47;
        color: #ffffff;
      }

      .language-option:focus-visible {
        outline: 2px solid #8aa8d3;
        outline-offset: 2px;
      }

      @media (max-width: 640px) {
        .global-language-toggle {
          top: 10px;
          left: 10px;
        }

        .language-option {
          padding: 6px 9px;
        }
      }
    `,
  ],
})
export class LanguageToggleComponent {
  constructor(readonly language: AppLanguageService) {}

  setLanguage(language: AppLanguage): void {
    this.language.setLanguage(language);
  }
}
