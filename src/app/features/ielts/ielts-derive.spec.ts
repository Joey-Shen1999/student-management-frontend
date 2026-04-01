import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  computeIeltsValidityWindow,
  deriveLanguageTrackingStatus,
  deriveStudentIeltsModuleState,
} from './ielts-derive';
import { IELTS_TRACKING_RULESET_V1 } from './ielts-rules';
import { StudentIeltsModuleState } from './ielts-types';

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

describe('deriveLanguageTrackingStatus', () => {
  it('returns teacher review status when teacher selects approved', () => {
    const status = deriveLanguageTrackingStatus('TEACHER_REVIEW_APPROVED', 'YELLOW_NEEDS_PREPARATION');
    expect(status).toBe('TEACHER_REVIEW_APPROVED');
  });

  it('returns all-school pass status when teacher selects it', () => {
    const status = deriveLanguageTrackingStatus('AUTO_PASS_ALL_SCHOOLS', 'YELLOW_NEEDS_PREPARATION');
    expect(status).toBe('AUTO_PASS_ALL_SCHOOLS');
  });

  it('returns partial-school pass status when teacher selects it', () => {
    const status = deriveLanguageTrackingStatus('AUTO_PASS_PARTIAL_SCHOOLS', 'GREEN_STRICT_PASS');
    expect(status).toBe('AUTO_PASS_PARTIAL_SCHOOLS');
  });

  it('maps to all-school pass when manual status is empty and IELTS is strict pass', () => {
    const status = deriveLanguageTrackingStatus(null, 'GREEN_STRICT_PASS');
    expect(status).toBe('AUTO_PASS_ALL_SCHOOLS');
  });

  it('maps to partial-school pass when manual status is empty and IELTS is common pass', () => {
    const status = deriveLanguageTrackingStatus(null, 'GREEN_COMMON_PASS_WITH_WARNING');
    expect(status).toBe('AUTO_PASS_PARTIAL_SCHOOLS');
  });

  it('falls back to needs-tracking when manual status is empty and IELTS is yellow', () => {
    const status = deriveLanguageTrackingStatus(null, 'YELLOW_NEEDS_PREPARATION');
    expect(status).toBe('NEEDS_TRACKING');
  });
});

describe('deriveStudentIeltsModuleState', () => {
  it('prefers backend-provided tracking fields when present', () => {
    const state: StudentIeltsModuleState = {
      studentId: 1,
      graduationYear: 2027,
      hasTakenIeltsAcademic: true,
      preparationIntent: 'UNSET',
      trackingStatus: 'GREEN_COMMON_PASS_WITH_WARNING',
      languageTrackingStatus: 'AUTO_PASS_PARTIAL_SCHOOLS',
      languageTrackingManualStatus: null,
      records: [],
      languageRisk: {
        shouldShowIeltsModule: true,
      },
      updatedAt: null,
    };

    const summary = deriveStudentIeltsModuleState(state).summary;
    expect(summary.trackingStatus).toBe('GREEN_COMMON_PASS_WITH_WARNING');
    expect(summary.languageTrackingStatus).toBe('AUTO_PASS_PARTIAL_SCHOOLS');
  });
});
