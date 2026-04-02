import { describe, expect, it } from 'vitest';

import { resolveIeltsStatusDisplay } from './ielts-status-display';

describe('resolveIeltsStatusDisplay', () => {
  it('returns no-language-score-required style when module is hidden', () => {
    const display = resolveIeltsStatusDisplay({
      shouldShowModule: false,
      trackingStatus: 'YELLOW_NEEDS_PREPARATION',
      colorToken: '#b26a00',
    });

    expect(display.state).toBe('NO_IELTS_REQUIRED');
    expect(display.label).toBe('无需语言成绩');
    expect(display.background).toBe('#f1f3f5');
    expect(display.textColor).toBe('#6a7385');
  });

  it('uses light-green style for strict pass', () => {
    const display = resolveIeltsStatusDisplay({
      shouldShowModule: true,
      trackingStatus: 'GREEN_STRICT_PASS',
      colorToken: '#145a32',
    });

    expect(display.state).toBe('GREEN_STRICT_PASS');
    expect(display.label).toBe('已满足语言成绩');
    expect(display.background).toBe('#e7f6ec');
    expect(display.textColor).toBe('#2f6b43');
    expect(display.borderColor).toBe('#8fc8a3');
  });

  it('uses light-yellow style for needs-preparation', () => {
    const display = resolveIeltsStatusDisplay({
      shouldShowModule: true,
      trackingStatus: 'YELLOW_NEEDS_PREPARATION',
      colorToken: '#a66900',
    });

    expect(display.background).toBe('#fff6dc');
    expect(display.textColor).toBe('#8a5a00');
    expect(display.borderColor).toBe('#e3c77a');
    expect(display.label).toBe('可能需要语言成绩');
  });

  it('returns loading/unavailable display states for transient failures', () => {
    const loadingDisplay = resolveIeltsStatusDisplay({ isLoading: true });
    const unavailableDisplay = resolveIeltsStatusDisplay({ isUnavailable: true });

    expect(loadingDisplay.state).toBe('LOADING');
    expect(loadingDisplay.label).toBe('加载中...');

    expect(unavailableDisplay.state).toBe('UNAVAILABLE');
    expect(unavailableDisplay.label).toBe('可能需要语言成绩');
  });
});
