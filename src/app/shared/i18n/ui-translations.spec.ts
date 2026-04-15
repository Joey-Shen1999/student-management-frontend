import { describe, expect, it } from 'vitest';

import { translateUiText } from './ui-translations';

describe('translateUiText', () => {
  it('translates exact chinese labels to english', () => {
    expect(translateUiText('登录', 'en')).toBe('Log In');
    expect(translateUiText('一对一辅导', 'en')).toBe('One-on-One Tutoring');
  });

  it('translates common english labels back to chinese', () => {
    expect(translateUiText('Back', 'zh')).toBe('返回');
    expect(translateUiText('Account Settings', 'zh')).toBe('账号设置');
  });

  it('translates common dynamic counters', () => {
    expect(translateUiText('已选 3 项', 'en')).toBe('3 selected');
    expect(translateUiText('2项', 'en')).toBe('2 selected');
    expect(translateUiText('35.5 小时', 'en')).toBe('35.5 hrs');
  });

  it('translates label-value text recursively', () => {
    expect(translateUiText('发布老师：王老师', 'en')).toBe('Published by: 王老师');
    expect(translateUiText('Teacher mode - Student #18', 'zh')).toBe('老师模式 - 学生 #18');
  });
});
