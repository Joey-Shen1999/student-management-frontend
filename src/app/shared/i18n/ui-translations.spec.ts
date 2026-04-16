import { describe, expect, it } from 'vitest';

import { translateUiText, uiText } from './ui-translations';

describe('translateUiText', () => {
  it('translates exact dictionary entries to english', () => {
    expect(translateUiText('\u767b\u5f55', 'en')).toBe('Log In');
    expect(translateUiText('\u5bc6\u7801', 'en')).toBe('Password');
    expect(translateUiText('\u8fd4\u56de', 'en')).toBe('Back');
  });

  it('translates exact dictionary entries to chinese', () => {
    expect(translateUiText('Log In', 'zh')).toBe('\u767b\u5f55');
    expect(translateUiText('Password', 'zh')).toBe('\u5bc6\u7801');
    expect(translateUiText('Back', 'zh')).toBe('\u8fd4\u56de');
  });

  it('supports explicit localized text objects', () => {
    const text = uiText('\u521b\u5efa\u8d26\u53f7', 'Create Account');

    expect(translateUiText(text, 'zh')).toBe('\u521b\u5efa\u8d26\u53f7');
    expect(translateUiText(text, 'en')).toBe('Create Account');
  });

  it('preserves surrounding whitespace for exact string lookups', () => {
    expect(translateUiText('  \u767b\u5f55  ', 'en')).toBe('  Log In  ');
  });

  it('translates newly added task labels', () => {
    expect(translateUiText('\u5df2\u53d1\u5e03\u4efb\u52a1', 'en')).toBe('Published Tasks');
    expect(translateUiText('\u5b8c\u6210', 'en')).toBe('Complete');
  });

  it('translates mixed Chinese fragments inside dynamic text', () => {
    expect(translateUiText('\u5df2\u5b8c\u6210\uff082/5 \u5b8c\u6210\uff09', 'en')).toBe(
      'Completed\uff082/5 Complete\uff09'
    );
  });

  it('leaves unknown or dynamic strings unchanged', () => {
    expect(translateUiText('Completely unrelated sentence.', 'zh')).toBe(
      'Completely unrelated sentence.'
    );
    expect(translateUiText('Notice published (2 recipients)', 'en')).toBe('Notice published (2 recipients)');
  });
});
