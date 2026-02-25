export interface PasswordPolicyCheck {
  key: string;
  label: string;
  pass: boolean;
}

export interface PasswordPolicyResult {
  isValid: boolean;
  checks: PasswordPolicyCheck[];
  message: string;
}

export function evaluatePasswordPolicy(password: string, username = ''): PasswordPolicyResult {
  const normalizedPassword = password || '';
  const normalizedUsername = (username || '').trim().toLowerCase();

  const checks: PasswordPolicyCheck[] = [
    {
      key: 'length',
      label: '至少 8 个字符',
      pass: normalizedPassword.length >= 8,
    },
    {
      key: 'lowercase',
      label: '包含小写字母（a-z）',
      pass: /[a-z]/.test(normalizedPassword),
    },
    {
      key: 'uppercase',
      label: '包含大写字母（A-Z）',
      pass: /[A-Z]/.test(normalizedPassword),
    },
    {
      key: 'number',
      label: '包含数字（0-9）',
      pass: /[0-9]/.test(normalizedPassword),
    },
    {
      key: 'special',
      label: '包含特殊字符（如 !@#$%）',
      pass: /[^A-Za-z0-9]/.test(normalizedPassword),
    },
    {
      key: 'noSpace',
      label: '不包含空格',
      pass: !/\s/.test(normalizedPassword),
    },
  ];

  if (normalizedUsername.length >= 3) {
    checks.push({
      key: 'noUsername',
      label: '不能包含用户名',
      pass: !normalizedPassword.toLowerCase().includes(normalizedUsername),
    });
  }

  const failed = checks.filter((check) => !check.pass);
  const isValid = failed.length === 0;

  return {
    isValid,
    checks,
    message: isValid
      ? ''
      : `密码不符合要求：${failed.map((item) => item.label).join('；')}`,
  };
}
