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
    expect(result.message).toContain('Password does not meet requirements:');
    expect(result.message).toContain('At least 8 characters');
    expect(result.message).toContain('Contains an uppercase letter (A-Z)');
    expect(result.message).toContain('Contains a number (0-9)');
    expect(result.message).toContain('Contains a special character (e.g. !@#$%)');
  });

  it('rejects passwords containing username when username is long enough', () => {
    const result = evaluatePasswordPolicy('Alice#2026', 'alice');

    expect(result.isValid).toBe(false);
    expect(result.message).toContain('Does not contain your username');
  });
});
