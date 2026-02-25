import { evaluatePasswordPolicy } from './password-policy';

describe('evaluatePasswordPolicy', () => {
  it('accepts a strong password', () => {
    const result = evaluatePasswordPolicy('Aa1!goodPass', 'alice');

    expect(result.isValid).toBe(true);
    expect(result.message).toBe('');
    expect(result.checks.every((check) => check.pass)).toBe(true);
  });

  it('rejects weak passwords and returns failure details', () => {
    const result = evaluatePasswordPolicy('abc', 'alice');

    expect(result.isValid).toBe(false);
    expect(result.message).toContain('密码不符合要求：');
    expect(result.message).toContain('至少 8 个字符');
    expect(result.message).toContain('包含大写字母（A-Z）');
    expect(result.message).toContain('包含数字（0-9）');
    expect(result.message).toContain('包含特殊字符（如 !@#$%）');
  });

  it('rejects passwords containing username when username is long enough', () => {
    const result = evaluatePasswordPolicy('Alice#2026', 'alice');

    expect(result.isValid).toBe(false);
    expect(result.message).toContain('不能包含用户名');
  });
});
