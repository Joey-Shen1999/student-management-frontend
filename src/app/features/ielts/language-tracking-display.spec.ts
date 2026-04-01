import { describe, expect, it } from 'vitest';

import { resolveLanguageTrackingStatusDisplay } from './language-tracking-display';

describe('resolveLanguageTrackingStatusDisplay', () => {
  it('returns green display for teacher-reviewed approved status', () => {
    const display = resolveLanguageTrackingStatusDisplay({ status: 'TEACHER_REVIEW_APPROVED' });

    expect(display.label).toBe('已审核通过');
    expect(display.textColor).toBe('#ffffff');
  });

  it('returns green display for all-school pass status', () => {
    const display = resolveLanguageTrackingStatusDisplay({ status: 'AUTO_PASS_ALL_SCHOOLS' });

    expect(display.label).toBe('已通过，适配全部学校');
    expect(display.textColor).toBe('#ffffff');
  });

  it('returns yellow display for partial-school pass and needs-tracking status', () => {
    const partialDisplay = resolveLanguageTrackingStatusDisplay({
      status: 'AUTO_PASS_PARTIAL_SCHOOLS',
    });
    const needsTrackingDisplay = resolveLanguageTrackingStatusDisplay({ status: 'NEEDS_TRACKING' });

    expect(partialDisplay.label).toBe('已通过，适配部分学校');
    expect(partialDisplay.textColor).toBe('#875a00');
    expect(needsTrackingDisplay.label).toBe('需要跟踪');
    expect(needsTrackingDisplay.textColor).toBe('#8a5a00');
  });

  it('returns loading and unavailable display variants', () => {
    const loadingDisplay = resolveLanguageTrackingStatusDisplay({ isLoading: true });
    const unavailableDisplay = resolveLanguageTrackingStatusDisplay({ isUnavailable: true });

    expect(loadingDisplay.state).toBe('LOADING');
    expect(loadingDisplay.label).toBe('加载中...');
    expect(unavailableDisplay.state).toBe('UNAVAILABLE');
    expect(unavailableDisplay.label).toBe('需要跟踪');
  });
});
