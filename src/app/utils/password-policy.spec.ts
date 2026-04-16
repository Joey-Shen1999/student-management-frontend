import { describe, expect, it } from 'vitest';

import { evaluatePasswordPolicy } from './password-policy';

describe('evaluatePasswordPolicy', () => {
  it('accepts a strong password', () => {
    const result = evaluatePasswordPolicy('Aa1!goodPass', 'alice');

    expect(result.isValid).toBe(true);
    expect(result.message).toBeNull();
    expect(result.checks.every((check) => check.pass)).toBe(true);
  });

  it('rejects weak passwords and returns localized failure details', () => {
    const result = evaluatePasswordPolicy('abc', 'alice');

    expect(result.isValid).toBe(false);
    expect(result.message?.zh).toContain('密码不符合要求：');
    expect(result.message?.zh).toContain('至少 8 个字符');
    expect(result.message?.zh).toContain('包含大写字母（A-Z）');
    expect(result.message?.zh).toContain('包含数字（0-9）');
    expect(result.message?.zh).toContain('包含特殊字符（如 !@#$%）');

    expect(result.message?.en).toContain('Password does not meet the requirements:');
    expect(result.message?.en).toContain('At least 8 characters');
    expect(result.message?.en).toContain('Include an uppercase letter (A-Z)');
    expect(result.message?.en).toContain('Include a number (0-9)');
    expect(result.message?.en).toContain('Include a special character (such as !@#$%)');
  });

  it('rejects passwords containing username when username is long enough', () => {
    const result = evaluatePasswordPolicy('Alice#2026', 'alice');

    expect(result.isValid).toBe(false);
    expect(result.message?.zh).toContain('不能包含用户名');
    expect(result.message?.en).toContain('Do not include the username');
  });
});
