export type IeltsTrackingStatus =
  | 'GREEN_STRICT_PASS'
  | 'GREEN_COMMON_PASS_WITH_WARNING'
  | 'YELLOW_NEEDS_PREPARATION';

export type LanguageTrackingStatus =
  | 'TEACHER_REVIEW_APPROVED'
  | 'AUTO_PASS_ALL_SCHOOLS'
  | 'AUTO_PASS_PARTIAL_SCHOOLS'
  | 'NEEDS_TRACKING';

export type LanguageTrackingManualStatus = LanguageTrackingStatus | null;

export type IeltsPreparationIntent = 'PREPARING' | 'NOT_PREPARING' | 'UNSET';

export type DerivedValidityStatus =
  | 'VALID'
  | 'EXPIRED'
  | 'OUTSIDE_GRADUATION_WINDOW'
  | 'INVALID_DATE';

export type DerivedThresholdMatch = 'STRICT_PASS' | 'COMMON_PASS' | 'BELOW_COMMON' | 'NOT_APPLICABLE';

export interface IeltsRecordFormValue {
  recordId?: string;
  testDate: string;
  listening: number | null;
  reading: number | null;
  writing: number | null;
  speaking: number | null;
}

export interface IeltsRecordViewModel extends IeltsRecordFormValue {
  overall: number | null;
  validityStatus: DerivedValidityStatus;
  thresholdMatch: DerivedThresholdMatch;
  isLatestRecord: boolean;
  isLatestValidRecord: boolean;
}

export interface IeltsSummaryViewModel {
  trackingStatus: IeltsTrackingStatus;
  languageTrackingStatus: LanguageTrackingStatus;
  trackingTitle: string;
  trackingMessage: string;
  colorToken: string;
  shouldShowModule: boolean;
  graduationYear: number | null;
  validityCutoffDate: string | null;
  validityAnchorDate: string | null;
  latestRecordId: string | null;
  latestValidRecordId: string | null;
  thresholdMatch: DerivedThresholdMatch;
}

export interface StudentLanguageRiskSnapshot {
  shouldShowIeltsModule?: boolean;
  languageRiskFlag?: 'RISK' | 'NOT_RISK' | 'UNKNOWN';
  firstLanguage?: string;
  nativeLanguage?: string;
  citizenship?: string;
  canadaStudyYears?: number | null;
  hasCanadianHighSchoolExperience?: boolean;
  profileCompleteness?: 'COMPLETE' | 'PARTIAL' | 'UNKNOWN';
  riskReasonCodes?: string[];
}

export interface StudentIeltsModuleState {
  studentId: number;
  graduationYear: number | null;
  hasTakenIeltsAcademic: boolean | null;
  preparationIntent: IeltsPreparationIntent;
  trackingStatus?: IeltsTrackingStatus | null;
  languageTrackingStatus?: LanguageTrackingStatus | null;
  languageTrackingManualStatus: LanguageTrackingManualStatus;
  records: IeltsRecordFormValue[];
  languageRisk: StudentLanguageRiskSnapshot;
  updatedAt: string | null;
}

export interface TeacherStudentIeltsSummary {
  studentId: number;
  studentName: string;
  summary: IeltsSummaryViewModel;
}

export interface UpdateStudentIeltsPayload {
  hasTakenIeltsAcademic?: boolean | null;
  preparationIntent?: IeltsPreparationIntent;
  languageTrackingManualStatus?: LanguageTrackingManualStatus;
  records?: IeltsRecordFormValue[];
  teacherNote?: string;
}

export interface IeltsThresholdRule {
  minimumOverall: number;
  minimumListening: number;
  minimumReading: number;
  minimumWriting: number;
  minimumSpeaking: number;
}

export interface IeltsTrackingRuleSet {
  id: string;
  scope: 'IELTS_ACADEMIC_ONLY';
  labels: {
    strictLineName: string;
    commonLineName: string;
  };
  validity: {
    anchorMonth: number;
    anchorDay: number;
    rollingYears: number;
  };
  strictLine: IeltsThresholdRule;
  commonLine: IeltsThresholdRule;
  messaging: Record<IeltsTrackingStatus, { title: string; message: string; colorToken: string }>;
}
