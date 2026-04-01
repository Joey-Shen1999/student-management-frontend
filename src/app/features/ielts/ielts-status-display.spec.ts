import { describe, expect, it } from 'vitest';

import { IELTS_TRACKING_RULESET_V1 } from './ielts-rules';
import { resolveIeltsStatusDisplay } from './ielts-status-display';

describe('resolveIeltsStatusDisplay', () => {
  it('returns no-IELTS-required style when module is hidden', () => {
    const display = resolveIeltsStatusDisplay({
      shouldShowModule: false,
      trackingStatus: 'YELLOW_NEEDS_PREPARATION',
      colorToken: '#b26a00',
    });

    expect(display.state).toBe('NO_IELTS_REQUIRED');
    expect(display.label).toBe('无需雅思');
    expect(display.background).toBe('#f1f3f5');
    expect(display.textColor).toBe('#6a7385');
  });

  it('uses tracking summary color token for strict pass when available', () => {
    const display = resolveIeltsStatusDisplay({
      shouldShowModule: true,
      trackingStatus: 'GREEN_STRICT_PASS',
      colorToken: '#145a32',
    });

    expect(display.state).toBe('GREEN_STRICT_PASS');
    expect(display.label).toBe('已满足雅思');
    expect(display.background).toBe('#145a32');
    expect(display.textColor).toBe('#ffffff');
  });

  it('falls back to rule-set color token when summary color is missing', () => {
    const display = resolveIeltsStatusDisplay({
      shouldShowModule: true,
      trackingStatus: 'YELLOW_NEEDS_PREPARATION',
      colorToken: '',
    });

    expect(display.background).toBe(
      IELTS_TRACKING_RULESET_V1.messaging.YELLOW_NEEDS_PREPARATION.colorToken
    );
    expect(display.label).toBe('可能需要雅思');
  });

  it('returns loading/unavailable display states for transient failures', () => {
    const loadingDisplay = resolveIeltsStatusDisplay({ isLoading: true });
    const unavailableDisplay = resolveIeltsStatusDisplay({ isUnavailable: true });

    expect(loadingDisplay.state).toBe('LOADING');
    expect(loadingDisplay.label).toBe('加载中...');

    expect(unavailableDisplay.state).toBe('UNAVAILABLE');
    expect(unavailableDisplay.label).toBe('可能需要雅思');
  });
});
