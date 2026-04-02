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
  it('recomputes tracking fields from records and manual status', () => {
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
    expect(summary.trackingStatus).toBe('YELLOW_NEEDS_PREPARATION');
    expect(summary.languageTrackingStatus).toBe('NEEDS_TRACKING');
  });

  it('ignores stale backend statuses when TOEFL records satisfy strict line', () => {
    const state: StudentIeltsModuleState = {
      studentId: 11,
      graduationYear: 2027,
      languageScoreType: 'TOEFL',
      hasTakenIeltsAcademic: true,
      preparationIntent: 'UNSET',
      trackingStatus: 'YELLOW_NEEDS_PREPARATION',
      languageTrackingStatus: 'NEEDS_TRACKING',
      languageTrackingManualStatus: null,
      records: [
        {
          recordId: 'toefl-5-pass',
          testDate: '2026-01-15',
          listening: 5.0,
          reading: 5.0,
          writing: 5.0,
          speaking: 5.0,
        },
      ],
      languageRisk: {
        shouldShowIeltsModule: true,
      },
      updatedAt: null,
    };

    const summary = deriveStudentIeltsModuleState(state).summary;
    expect(summary.trackingStatus).toBe('GREEN_STRICT_PASS');
    expect(summary.languageTrackingStatus).toBe('AUTO_PASS_ALL_SCHOOLS');
  });

  it('uses TOEFL strict thresholds when language score type is TOEFL', () => {
    const state: StudentIeltsModuleState = {
      studentId: 2,
      graduationYear: 2027,
      languageScoreType: 'TOEFL',
      hasTakenIeltsAcademic: true,
      preparationIntent: 'UNSET',
      languageTrackingManualStatus: null,
      records: [
        {
          recordId: 'toefl-strict',
          testDate: '2026-01-15',
          listening: 5.0,
          reading: 5.0,
          writing: 5.0,
          speaking: 5.0,
        },
      ],
      languageRisk: {
        shouldShowIeltsModule: true,
      },
      updatedAt: null,
    };

    const summary = deriveStudentIeltsModuleState(state).summary;
    expect(summary.trackingStatus).toBe('GREEN_STRICT_PASS');
    expect(summary.languageTrackingStatus).toBe('AUTO_PASS_ALL_SCHOOLS');
    expect(summary.trackingMessage).toContain('TOEFL iBT');
  });

  it('uses TOEFL common thresholds when language score type is TOEFL', () => {
    const state: StudentIeltsModuleState = {
      studentId: 3,
      graduationYear: 2027,
      languageScoreType: 'TOEFL',
      hasTakenIeltsAcademic: true,
      preparationIntent: 'UNSET',
      languageTrackingManualStatus: null,
      records: [
        {
          recordId: 'toefl-common',
          testDate: '2026-01-15',
          listening: 4.5,
          reading: 4.5,
          writing: 4.0,
          speaking: 4.0,
        },
      ],
      languageRisk: {
        shouldShowIeltsModule: true,
      },
      updatedAt: null,
    };

    const summary = deriveStudentIeltsModuleState(state).summary;
    expect(summary.trackingStatus).toBe('GREEN_COMMON_PASS_WITH_WARNING');
    expect(summary.languageTrackingStatus).toBe('AUTO_PASS_PARTIAL_SCHOOLS');
  });

  it('uses Duolingo strict thresholds when language score type is DUOLINGO', () => {
    const state: StudentIeltsModuleState = {
      studentId: 4,
      graduationYear: 2027,
      languageScoreType: 'DUOLINGO',
      hasTakenIeltsAcademic: true,
      preparationIntent: 'UNSET',
      languageTrackingManualStatus: null,
      records: [
        {
          recordId: 'duolingo-strict',
          testDate: '2026-01-15',
          listening: 135,
          reading: 130,
          writing: 130,
          speaking: 125,
        },
      ],
      languageRisk: {
        shouldShowIeltsModule: true,
      },
      updatedAt: null,
    };

    const summary = deriveStudentIeltsModuleState(state).summary;
    expect(summary.trackingStatus).toBe('GREEN_STRICT_PASS');
    expect(summary.languageTrackingStatus).toBe('AUTO_PASS_ALL_SCHOOLS');
    expect(summary.trackingMessage).toContain('Duolingo English Test');
  });

  it('uses Duolingo common thresholds when language score type is DUOLINGO', () => {
    const state: StudentIeltsModuleState = {
      studentId: 5,
      graduationYear: 2027,
      languageScoreType: 'DUOLINGO',
      hasTakenIeltsAcademic: true,
      preparationIntent: 'UNSET',
      languageTrackingManualStatus: null,
      records: [
        {
          recordId: 'duolingo-common',
          testDate: '2026-01-15',
          listening: 125,
          reading: 120,
          writing: 115,
          speaking: 110,
        },
      ],
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
