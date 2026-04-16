import { LocalizedText, uiText } from '../shared/i18n/ui-translations';

export interface PasswordPolicyCheck {
  key: string;
  label: LocalizedText;
  pass: boolean;
}

export interface PasswordPolicyResult {
  isValid: boolean;
  checks: PasswordPolicyCheck[];
  message: LocalizedText | null;
}

export function evaluatePasswordPolicy(password: string, username = ''): PasswordPolicyResult {
  const normalizedPassword = password || '';
  const normalizedUsername = (username || '').trim().toLowerCase();

  const checks: PasswordPolicyCheck[] = [
    {
      key: 'length',
      label: uiText('至少 8 个字符', 'At least 8 characters'),
      pass: normalizedPassword.length >= 8,
    },
    {
      key: 'lowercase',
      label: uiText('包含小写字母（a-z）', 'Include a lowercase letter (a-z)'),
      pass: /[a-z]/.test(normalizedPassword),
    },
    {
      key: 'uppercase',
      label: uiText('包含大写字母（A-Z）', 'Include an uppercase letter (A-Z)'),
      pass: /[A-Z]/.test(normalizedPassword),
    },
    {
      key: 'number',
      label: uiText('包含数字（0-9）', 'Include a number (0-9)'),
      pass: /[0-9]/.test(normalizedPassword),
    },
    {
      key: 'special',
      label: uiText('包含特殊字符（如 !@#$%）', 'Include a special character (such as !@#$%)'),
      pass: /[^A-Za-z0-9]/.test(normalizedPassword),
    },
    {
      key: 'noSpace',
      label: uiText('不包含空格', 'Do not include spaces'),
      pass: !/\s/.test(normalizedPassword),
    },
  ];

  if (normalizedUsername.length >= 3) {
    checks.push({
      key: 'noUsername',
      label: uiText('不能包含用户名', 'Do not include the username'),
      pass: !normalizedPassword.toLowerCase().includes(normalizedUsername),
    });
  }

  const failed = checks.filter((check) => !check.pass);
  const isValid = failed.length === 0;

  return {
    isValid,
    checks,
    message: isValid
      ? null
      : uiText(
          `密码不符合要求：${failed.map((item) => item.label.zh).join('、')}`,
          `Password does not meet the requirements: ${failed.map((item) => item.label.en).join(', ')}`
        ),
  };
}
