import { StudentIeltsModuleState } from './ielts-types';

export const MOCK_TEACHER_STUDENT_NAMES: Record<number, string> = {
  20001: 'Zhang San',
  20002: 'Li Si',
  20003: 'Wang Wu',
  20004: 'Chen Yu',
  20005: 'Liu Yi',
  20006: 'Sun Ning',
  20007: 'Zhao Lin',
  20008: 'He Ping',
};

export const MOCK_STUDENT_IELTS_STATES: Record<number, StudentIeltsModuleState> = {
  // Scenario 1: never tested + preparing
  20001: {
    studentId: 20001,
    graduationYear: 2027,
    hasTakenIeltsAcademic: false,
    preparationIntent: 'PREPARING',
    languageTrackingManualStatus: 'NEEDS_TRACKING',
    records: [],
    languageRisk: {
      shouldShowIeltsModule: true,
      languageRiskFlag: 'RISK',
      firstLanguage: 'Chinese',
      citizenship: 'China (Mainland)',
      canadaStudyYears: 2,
      riskReasonCodes: ['NON_ENGLISH_PRIMARY_LANGUAGE'],
      profileCompleteness: 'COMPLETE',
    },
    updatedAt: '2026-03-30T10:20:00Z',
  },
  // Scenario 2: never tested + not preparing
  20002: {
    studentId: 20002,
    graduationYear: 2027,
    hasTakenIeltsAcademic: false,
    preparationIntent: 'NOT_PREPARING',
    languageTrackingManualStatus: 'NEEDS_TRACKING',
    records: [],
    languageRisk: {
      shouldShowIeltsModule: true,
      languageRiskFlag: 'RISK',
      firstLanguage: 'Korean',
      citizenship: 'South Korea',
      canadaStudyYears: 1,
      riskReasonCodes: ['NO_VALID_ENGLISH_TEST'],
      profileCompleteness: 'COMPLETE',
    },
    updatedAt: '2026-03-29T16:00:00Z',
  },
  // Scenario 3: tested but expired
  20003: {
    studentId: 20003,
    graduationYear: 2026,
    hasTakenIeltsAcademic: true,
    preparationIntent: 'UNSET',
    languageTrackingManualStatus: 'NEEDS_TRACKING',
    records: [
      {
        recordId: 'r-20003-1',
        testDate: '2023-04-20',
        listening: 7.0,
        reading: 6.5,
        writing: 6.0,
        speaking: 6.0,
      },
    ],
    languageRisk: {
      shouldShowIeltsModule: true,
      languageRiskFlag: 'RISK',
      firstLanguage: 'Japanese',
      canadaStudyYears: 2,
      profileCompleteness: 'COMPLETE',
    },
    updatedAt: '2026-03-28T09:15:00Z',
  },
  // Scenario 4: valid + common line
  20004: {
    studentId: 20004,
    graduationYear: 2027,
    hasTakenIeltsAcademic: true,
    preparationIntent: 'UNSET',
    languageTrackingManualStatus: 'AUTO_PASS_PARTIAL_SCHOOLS',
    records: [
      {
        recordId: 'r-20004-1',
        testDate: '2025-10-12',
        listening: 6.5,
        reading: 6.5,
        writing: 6.0,
        speaking: 6.0,
      },
    ],
    languageRisk: {
      shouldShowIeltsModule: true,
      languageRiskFlag: 'RISK',
      firstLanguage: 'Chinese',
      canadaStudyYears: 3,
      profileCompleteness: 'COMPLETE',
    },
    updatedAt: '2026-03-25T11:40:00Z',
  },
  // Scenario 5: valid + strict line
  20005: {
    studentId: 20005,
    graduationYear: 2027,
    hasTakenIeltsAcademic: true,
    preparationIntent: 'UNSET',
    languageTrackingManualStatus: 'TEACHER_REVIEW_APPROVED',
    records: [
      {
        recordId: 'r-20005-1',
        testDate: '2025-11-08',
        listening: 7.0,
        reading: 7.0,
        writing: 6.5,
        speaking: 6.5,
      },
    ],
    languageRisk: {
      shouldShowIeltsModule: true,
      languageRiskFlag: 'RISK',
      firstLanguage: 'Chinese',
      canadaStudyYears: 3,
      profileCompleteness: 'COMPLETE',
    },
    updatedAt: '2026-03-26T11:40:00Z',
  },
  // Scenario 6: multi records, old expired + latest valid
  20006: {
    studentId: 20006,
    graduationYear: 2027,
    hasTakenIeltsAcademic: true,
    preparationIntent: 'UNSET',
    languageTrackingManualStatus: 'AUTO_PASS_PARTIAL_SCHOOLS',
    records: [
      {
        recordId: 'r-20006-1',
        testDate: '2023-02-11',
        listening: 7.0,
        reading: 7.0,
        writing: 6.5,
        speaking: 6.5,
      },
      {
        recordId: 'r-20006-2',
        testDate: '2025-09-01',
        listening: 6.5,
        reading: 6.0,
        writing: 6.0,
        speaking: 6.0,
      },
    ],
    languageRisk: {
      shouldShowIeltsModule: true,
      languageRiskFlag: 'RISK',
      firstLanguage: 'Vietnamese',
      canadaStudyYears: 2,
      profileCompleteness: 'COMPLETE',
    },
    updatedAt: '2026-03-27T13:20:00Z',
  },
  // Scenario 7: multi records, latest outside graduation window + earlier valid
  20007: {
    studentId: 20007,
    graduationYear: 2027,
    hasTakenIeltsAcademic: true,
    preparationIntent: 'UNSET',
    languageTrackingManualStatus: 'NEEDS_TRACKING',
    records: [
      {
        recordId: 'r-20007-1',
        testDate: '2025-08-16',
        listening: 6.5,
        reading: 6.5,
        writing: 6.0,
        speaking: 6.0,
      },
      {
        recordId: 'r-20007-2',
        testDate: '2028-01-15',
        listening: 7.0,
        reading: 7.0,
        writing: 6.5,
        speaking: 6.5,
      },
    ],
    languageRisk: {
      shouldShowIeltsModule: true,
      languageRiskFlag: 'RISK',
      firstLanguage: 'Thai',
      canadaStudyYears: 2,
      profileCompleteness: 'COMPLETE',
    },
    updatedAt: '2026-03-28T18:45:00Z',
  },
  // Optional non-risk sample: module hidden
  20008: {
    studentId: 20008,
    graduationYear: 2027,
    hasTakenIeltsAcademic: null,
    preparationIntent: 'UNSET',
    languageTrackingManualStatus: 'NEEDS_TRACKING',
    records: [],
    languageRisk: {
      shouldShowIeltsModule: false,
      languageRiskFlag: 'NOT_RISK',
      firstLanguage: 'English',
      canadaStudyYears: 8,
      profileCompleteness: 'COMPLETE',
    },
    updatedAt: '2026-03-30T09:00:00Z',
  },
};

export function cloneMockIeltsState(state: StudentIeltsModuleState): StudentIeltsModuleState {
  return {
    ...state,
    records: state.records.map((record) => ({ ...record })),
    languageRisk: { ...state.languageRisk, riskReasonCodes: [...(state.languageRisk.riskReasonCodes || [])] },
  };
}
