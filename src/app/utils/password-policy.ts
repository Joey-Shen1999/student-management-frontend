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
      label: 'At least 8 characters',
      pass: normalizedPassword.length >= 8,
    },
    {
      key: 'lowercase',
      label: 'Contains a lowercase letter (a-z)',
      pass: /[a-z]/.test(normalizedPassword),
    },
    {
      key: 'uppercase',
      label: 'Contains an uppercase letter (A-Z)',
      pass: /[A-Z]/.test(normalizedPassword),
    },
    {
      key: 'number',
      label: 'Contains a number (0-9)',
      pass: /[0-9]/.test(normalizedPassword),
    },
    {
      key: 'special',
      label: 'Contains a special character (e.g. !@#$%)',
      pass: /[^A-Za-z0-9]/.test(normalizedPassword),
    },
    {
      key: 'noSpace',
      label: 'Does not contain spaces',
      pass: !/\s/.test(normalizedPassword),
    },
  ];

  if (normalizedUsername.length >= 3) {
    checks.push({
      key: 'noUsername',
      label: 'Does not contain your username',
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
      : `Password does not meet requirements: ${failed.map((item) => item.label).join('; ')}`,
  };
}
