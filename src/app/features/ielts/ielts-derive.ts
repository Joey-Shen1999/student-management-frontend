import { IELTS_TRACKING_RULESET_V1 } from './ielts-rules';
import {
  DerivedThresholdMatch,
  DerivedValidityStatus,
  IeltsRecordFormValue,
  IeltsRecordViewModel,
  LanguageTrackingManualStatus,
  LanguageTrackingStatus,
  IeltsSummaryViewModel,
  IeltsTrackingRuleSet,
  IeltsTrackingStatus,
  StudentIeltsModuleState,
  StudentLanguageRiskSnapshot,
} from './ielts-types';

export interface IeltsValidityWindow {
  cutoffDate: Date;
  anchorDate: Date;
  cutoffDateText: string;
  anchorDateText: string;
}

export interface DerivedStudentIeltsModuleState {
  records: IeltsRecordViewModel[];
  summary: IeltsSummaryViewModel;
}

export function deriveStudentIeltsModuleState(
  state: StudentIeltsModuleState,
  ruleSet: IeltsTrackingRuleSet = IELTS_TRACKING_RULESET_V1
): DerivedStudentIeltsModuleState {
  const window = computeIeltsValidityWindow(state.graduationYear, ruleSet);
  const records = deriveIeltsRecordViewModels(state.records, window, ruleSet);

  const latestRecord = records.find((record) => record.isLatestRecord) ?? null;
  const latestValidRecord = records.find((record) => record.isLatestValidRecord) ?? null;
  const shouldShowModule = resolveShouldShowIeltsModule(state.languageRisk);
  const computedTrackingStatus = deriveIeltsTrackingStatus(state, latestValidRecord);
  const trackingStatus = state.trackingStatus ?? computedTrackingStatus;
  const languageTrackingStatus =
    state.languageTrackingStatus ??
    deriveLanguageTrackingStatus(state.languageTrackingManualStatus, trackingStatus);
  const messageConfig = ruleSet.messaging[trackingStatus];

  const summary: IeltsSummaryViewModel = {
    trackingStatus,
    languageTrackingStatus,
    trackingTitle: messageConfig.title,
    trackingMessage: messageConfig.message,
    colorToken: messageConfig.colorToken,
    shouldShowModule,
    graduationYear: state.graduationYear,
    validityCutoffDate: window?.cutoffDateText ?? null,
    validityAnchorDate: window?.anchorDateText ?? null,
    latestRecordId: latestRecord?.recordId ?? null,
    latestValidRecordId: latestValidRecord?.recordId ?? null,
    thresholdMatch: latestValidRecord?.thresholdMatch ?? 'NOT_APPLICABLE',
  };

  return { records, summary };
}

export function deriveLanguageTrackingStatus(
  manualStatus: LanguageTrackingManualStatus | null | undefined,
  trackingStatus: IeltsTrackingStatus
): LanguageTrackingStatus {
  if (manualStatus === 'TEACHER_REVIEW_APPROVED') return 'TEACHER_REVIEW_APPROVED';
  if (manualStatus === 'AUTO_PASS_ALL_SCHOOLS') return 'AUTO_PASS_ALL_SCHOOLS';
  if (manualStatus === 'AUTO_PASS_PARTIAL_SCHOOLS') return 'AUTO_PASS_PARTIAL_SCHOOLS';
  if (manualStatus === 'NEEDS_TRACKING') return 'NEEDS_TRACKING';
  if (trackingStatus === 'GREEN_STRICT_PASS') return 'AUTO_PASS_ALL_SCHOOLS';
  if (trackingStatus === 'GREEN_COMMON_PASS_WITH_WARNING') return 'AUTO_PASS_PARTIAL_SCHOOLS';
  return 'NEEDS_TRACKING';
}

export function computeIeltsOverall(record: IeltsRecordFormValue): number | null {
  const listening = normalizeBandScore(record.listening);
  const reading = normalizeBandScore(record.reading);
  const writing = normalizeBandScore(record.writing);
  const speaking = normalizeBandScore(record.speaking);
  if (listening === null || reading === null || writing === null || speaking === null) {
    return null;
  }

  const average = (listening + reading + writing + speaking) / 4;
  const rounded = Math.round(average * 2) / 2;
  return Number(rounded.toFixed(1));
}

export function computeIeltsValidityWindow(
  graduationYear: number | null,
  ruleSet: IeltsTrackingRuleSet = IELTS_TRACKING_RULESET_V1
): IeltsValidityWindow | null {
  const normalizedYear = resolveEffectiveGraduationYear(graduationYear, ruleSet);
  if (normalizedYear === null) {
    return null;
  }

  const anchorDate = new Date(
    Date.UTC(normalizedYear, ruleSet.validity.anchorMonth - 1, ruleSet.validity.anchorDay, 0, 0, 0, 0)
  );
  const cutoffDate = new Date(
    Date.UTC(
      normalizedYear - ruleSet.validity.rollingYears,
      ruleSet.validity.anchorMonth - 1,
      ruleSet.validity.anchorDay,
      0,
      0,
      0,
      0
    )
  );

  return {
    cutoffDate,
    anchorDate,
    cutoffDateText: toIsoDate(cutoffDate),
    anchorDateText: toIsoDate(anchorDate),
  };
}

export function deriveIeltsRecordViewModels(
  records: IeltsRecordFormValue[],
  window: IeltsValidityWindow | null,
  ruleSet: IeltsTrackingRuleSet = IELTS_TRACKING_RULESET_V1
): IeltsRecordViewModel[] {
  const normalizedRecords = records.map((record, index) => normalizeRecord(record, index));
  const parsedDatesById = new Map<string, Date | null>();
  for (const record of normalizedRecords) {
    parsedDatesById.set(record.recordId || '', parseIsoDate(record.testDate));
  }

  const latestRecord = pickLatestRecord(normalizedRecords, parsedDatesById);
  const validRecords = normalizedRecords.filter((record) => {
    const status = deriveValidityStatus(record.testDate, window);
    return status === 'VALID';
  });
  const latestValidRecord = pickLatestRecord(validRecords, parsedDatesById);

  const viewModels = normalizedRecords.map((record) => {
    const overall = computeIeltsOverall(record);
    const validityStatus = deriveValidityStatus(record.testDate, window);
    const thresholdMatch =
      validityStatus === 'VALID'
        ? deriveThresholdMatch(record, ruleSet)
        : 'NOT_APPLICABLE';

    return {
      ...record,
      overall,
      validityStatus,
      thresholdMatch,
      isLatestRecord: latestRecord?.recordId === record.recordId,
      isLatestValidRecord: latestValidRecord?.recordId === record.recordId,
    };
  });

  return [...viewModels].sort((left, right) => {
    const leftDate = parsedDatesById.get(left.recordId || '')?.getTime() ?? Number.NEGATIVE_INFINITY;
    const rightDate = parsedDatesById.get(right.recordId || '')?.getTime() ?? Number.NEGATIVE_INFINITY;
    return rightDate - leftDate;
  });
}

export function deriveValidityStatus(
  testDate: string,
  window: IeltsValidityWindow | null
): DerivedValidityStatus {
  const parsed = parseIsoDate(testDate);
  if (!parsed) return 'INVALID_DATE';
  if (!window) return 'OUTSIDE_GRADUATION_WINDOW';
  if (parsed.getTime() > window.anchorDate.getTime()) return 'OUTSIDE_GRADUATION_WINDOW';
  if (parsed.getTime() < window.cutoffDate.getTime()) return 'EXPIRED';
  return 'VALID';
}

export function deriveThresholdMatch(
  record: IeltsRecordFormValue,
  ruleSet: IeltsTrackingRuleSet = IELTS_TRACKING_RULESET_V1
): DerivedThresholdMatch {
  if (matchesThresholdRule(record, ruleSet.strictLine)) return 'STRICT_PASS';
  if (matchesThresholdRule(record, ruleSet.commonLine)) return 'COMMON_PASS';
  const overall = computeIeltsOverall(record);
  return overall === null ? 'NOT_APPLICABLE' : 'BELOW_COMMON';
}

export function resolveShouldShowIeltsModule(snapshot: StudentLanguageRiskSnapshot | null | undefined): boolean {
  if (!snapshot || typeof snapshot !== 'object') return true;
  if (typeof snapshot.shouldShowIeltsModule === 'boolean') return snapshot.shouldShowIeltsModule;
  if (snapshot.languageRiskFlag === 'RISK') return true;
  if (snapshot.languageRiskFlag === 'NOT_RISK') return false;

  const firstLanguage = normalizeText(snapshot.firstLanguage || snapshot.nativeLanguage);
  if (firstLanguage && !looksLikeEnglishLanguage(firstLanguage)) return true;

  const canadaStudyYears = Number(snapshot.canadaStudyYears);
  if (!Number.isFinite(canadaStudyYears)) return true;
  if (canadaStudyYears < 4) return true;

  return snapshot.profileCompleteness !== 'COMPLETE';
}

function deriveIeltsTrackingStatus(
  state: StudentIeltsModuleState,
  latestValidRecord: IeltsRecordViewModel | null
): IeltsTrackingStatus {
  if (state.hasTakenIeltsAcademic !== true) {
    return 'YELLOW_NEEDS_PREPARATION';
  }
  if (!latestValidRecord) {
    return 'YELLOW_NEEDS_PREPARATION';
  }
  if (latestValidRecord.thresholdMatch === 'STRICT_PASS') {
    return 'GREEN_STRICT_PASS';
  }
  if (latestValidRecord.thresholdMatch === 'COMMON_PASS') {
    return 'GREEN_COMMON_PASS_WITH_WARNING';
  }
  return 'YELLOW_NEEDS_PREPARATION';
}

function matchesThresholdRule(
  record: IeltsRecordFormValue,
  rule: {
    minimumOverall: number;
    minimumListening: number;
    minimumReading: number;
    minimumWriting: number;
    minimumSpeaking: number;
  }
): boolean {
  const overall = computeIeltsOverall(record);
  if (overall === null || overall < rule.minimumOverall) return false;
  const listening = normalizeBandScore(record.listening);
  const reading = normalizeBandScore(record.reading);
  const writing = normalizeBandScore(record.writing);
  const speaking = normalizeBandScore(record.speaking);
  if (listening === null || reading === null || writing === null || speaking === null) return false;
  return (
    listening >= rule.minimumListening &&
    reading >= rule.minimumReading &&
    writing >= rule.minimumWriting &&
    speaking >= rule.minimumSpeaking
  );
}

function normalizeRecord(record: IeltsRecordFormValue, index: number): IeltsRecordFormValue {
  const recordId = normalizeText(record.recordId) || `record-${index + 1}`;
  return {
    recordId,
    testDate: normalizeIsoDateText(record.testDate),
    listening: normalizeBandScore(record.listening),
    reading: normalizeBandScore(record.reading),
    writing: normalizeBandScore(record.writing),
    speaking: normalizeBandScore(record.speaking),
  };
}

function pickLatestRecord(
  records: IeltsRecordFormValue[],
  parsedDatesById: Map<string, Date | null>
): IeltsRecordFormValue | null {
  let latest: IeltsRecordFormValue | null = null;
  let latestTs = Number.NEGATIVE_INFINITY;
  for (const record of records) {
    const recordId = record.recordId || '';
    const parsed = parsedDatesById.get(recordId) ?? null;
    if (!parsed) continue;
    const ts = parsed.getTime();
    if (ts > latestTs) {
      latest = record;
      latestTs = ts;
    }
  }
  return latest;
}

function resolveEffectiveGraduationYear(
  graduationYear: number | null,
  ruleSet: IeltsTrackingRuleSet
): number | null {
  const normalized = normalizeGraduationYear(graduationYear);
  if (normalized !== null) {
    return normalized;
  }
  return resolveCurrentCohortGraduationYear(ruleSet);
}

function normalizeGraduationYear(graduationYear: number | null): number | null {
  const year = Number(graduationYear);
  if (!Number.isFinite(year) || year < 1900 || year > 2999) {
    return null;
  }
  return Math.trunc(year);
}

function resolveCurrentCohortGraduationYear(
  ruleSet: IeltsTrackingRuleSet,
  now: Date = new Date()
): number | null {
  const anchorMonth = Math.trunc(ruleSet.validity.anchorMonth);
  const anchorDay = Math.trunc(ruleSet.validity.anchorDay);
  if (
    !Number.isFinite(anchorMonth) ||
    !Number.isFinite(anchorDay) ||
    anchorMonth < 1 ||
    anchorMonth > 12 ||
    anchorDay < 1 ||
    anchorDay > 31
  ) {
    return null;
  }

  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const currentDay = now.getUTCDate();
  const hasPassedAnchor =
    currentMonth > anchorMonth || (currentMonth === anchorMonth && currentDay > anchorDay);

  const candidateYear = hasPassedAnchor ? currentYear + 1 : currentYear;
  if (candidateYear < 1900 || candidateYear > 2999) {
    return null;
  }
  return candidateYear;
}

function normalizeBandScore(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0 || parsed > 9) return null;
  return Number(parsed.toFixed(1));
}

function normalizeIsoDateText(value: unknown): string {
  const text = String(value ?? '').trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : text;
}

function parseIsoDate(value: unknown): Date | null {
  const text = normalizeIsoDateText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function looksLikeEnglishLanguage(value: string): boolean {
  return value.includes('english') || value === 'en' || value === 'eng';
}
