import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { computeIeltsValidityWindow } from './ielts-derive';
import { IELTS_TRACKING_RULESET_V1 } from './ielts-rules';

describe('computeIeltsValidityWindow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses provided graduation year when it is available', () => {
    const window = computeIeltsValidityWindow(2027, IELTS_TRACKING_RULESET_V1);

    expect(window?.anchorDateText).toBe('2027-05-31');
    expect(window?.cutoffDateText).toBe('2025-05-31');
  });

  it('defaults to current cohort year when graduation year is unknown before anchor date', () => {
    vi.setSystemTime(new Date('2026-04-01T12:00:00Z'));

    const window = computeIeltsValidityWindow(null, IELTS_TRACKING_RULESET_V1);

    expect(window?.anchorDateText).toBe('2026-05-31');
    expect(window?.cutoffDateText).toBe('2024-05-31');
  });

  it('defaults to next cohort year when graduation year is unknown after anchor date', () => {
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));

    const window = computeIeltsValidityWindow(null, IELTS_TRACKING_RULESET_V1);

    expect(window?.anchorDateText).toBe('2027-05-31');
    expect(window?.cutoffDateText).toBe('2025-05-31');
  });
});
