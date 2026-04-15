import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, delay, map, of, timeout } from 'rxjs';

import {
  deriveStudentIeltsModuleState,
  resolveShouldShowIeltsModule,
} from '../features/ielts/ielts-derive';
import {
  cloneMockIeltsState,
  MOCK_STUDENT_IELTS_STATES,
  MOCK_TEACHER_STUDENT_NAMES,
} from '../features/ielts/ielts-mock-data';
import {
  IeltsPreparationIntent,
  LanguageCourseStatus,
  IeltsRecordFormValue,
  IeltsSummaryViewModel,
  LanguageTrackingManualStatus,
  LanguageScoreType,
  IeltsTrackingStatus,
  StudentIeltsModuleState,
  StudentLanguageRiskSnapshot,
  TeacherStudentIeltsSummary,
  UpdateStudentIeltsPayload,
} from '../features/ielts/ielts-types';

@Injectable({ providedIn: 'root' })
export class IeltsTrackingService {
  // Backend is live for integration. Keep mock mode available for local fallback only.
  private readonly useMock = false;

  private readonly studentModuleUrl = '/api/student/ielts-module';
  private readonly teacherStudentsBaseUrl = '/api/teacher/students';
  private readonly mockLatencyMs = 80;
  private readonly requestTimeoutMs = 12000;
  private readonly mockStore = new Map<number, StudentIeltsModuleState>();

  constructor(private http: HttpClient) {
    for (const [studentIdText, state] of Object.entries(MOCK_STUDENT_IELTS_STATES)) {
      const studentId = Number(studentIdText);
      if (!Number.isFinite(studentId) || studentId <= 0) continue;
      this.mockStore.set(studentId, cloneMockIeltsState(state));
    }
  }

  getStudentIeltsModuleState(studentId: number): Observable<StudentIeltsModuleState> {
    const normalizedStudentId = this.normalizeStudentId(studentId);
    if (this.useMock) {
      return of(this.safeReadMockState(normalizedStudentId)).pipe(delay(this.mockLatencyMs));
    }

    return this.http.get<unknown>(this.studentModuleUrl).pipe(
      timeout({ first: this.requestTimeoutMs }),
      map((response) => this.normalizeModuleState(response, normalizedStudentId))
    );
  }

  getTeacherStudentIeltsModuleState(studentId: number): Observable<StudentIeltsModuleState> {
    const normalizedStudentId = this.normalizeStudentId(studentId);
    if (this.useMock) {
      return of(this.safeReadMockState(normalizedStudentId)).pipe(delay(this.mockLatencyMs));
    }

    return this.http.get<unknown>(`${this.teacherStudentsBaseUrl}/${normalizedStudentId}/ielts-module`).pipe(
      timeout({ first: this.requestTimeoutMs }),
      map((response) => this.normalizeModuleState(response, normalizedStudentId))
    );
  }

  saveStudentIeltsRecords(
    studentId: number,
    languageScoreType: LanguageScoreType,
    payload: UpdateStudentIeltsPayload
  ): Observable<StudentIeltsModuleState> {
    const normalizedStudentId = this.normalizeStudentId(studentId);
    const normalizedScoreType = this.normalizeLanguageScoreType(languageScoreType) ?? 'IELTS';
    if (this.useMock) {
      const previous = this.readMockState(normalizedStudentId);
      const normalizedRecords = this.normalizeRecords(payload.records, normalizedScoreType);
      const next: StudentIeltsModuleState = {
        ...previous,
        languageScoreType: normalizedScoreType,
        hasTakenIeltsAcademic: true,
        preparationIntent: 'UNSET',
        trackingStatus: null,
        languageScoreTrackingStatus: null,
        languageTrackingStatus: null,
        languageScoreTrackingManualStatus: null,
        languageTrackingManualStatus: null,
        languageCourseStatus: previous.languageCourseStatus ?? null,
        records: normalizedRecords,
        updatedAt: new Date().toISOString(),
      };
      this.mockStore.set(normalizedStudentId, next);
      return of(cloneMockIeltsState(next)).pipe(delay(this.mockLatencyMs));
    }

    const normalizedRecords = this.normalizeRecords(payload.records, normalizedScoreType);
    const requestBody = this.buildScoreRecordPayload(
      {
        hasTakenIeltsAcademic: true,
        languageScoreType: normalizedScoreType,
      },
      normalizedRecords,
      normalizedScoreType
    );

    return this.http.put<unknown>(`${this.studentModuleUrl}/records`, requestBody).pipe(
      timeout({ first: this.requestTimeoutMs }),
      map((response) => this.normalizeModuleState(response, normalizedStudentId))
    );
  }

  saveStudentIeltsPreparationIntent(
    studentId: number,
    languageScoreType: LanguageScoreType,
    intent: IeltsPreparationIntent
  ): Observable<StudentIeltsModuleState> {
    const normalizedStudentId = this.normalizeStudentId(studentId);
    const normalizedScoreType = this.normalizeLanguageScoreType(languageScoreType) ?? 'IELTS';
    if (this.useMock) {
      const previous = this.readMockState(normalizedStudentId);
      const next: StudentIeltsModuleState = {
        ...previous,
        languageScoreType: normalizedScoreType,
        hasTakenIeltsAcademic: false,
        preparationIntent: this.normalizePreparationIntent(intent),
        trackingStatus: null,
        languageScoreTrackingStatus: null,
        languageTrackingStatus: null,
        languageScoreTrackingManualStatus: null,
        languageTrackingManualStatus: null,
        languageCourseStatus: previous.languageCourseStatus ?? null,
        records: [],
        updatedAt: new Date().toISOString(),
      };
      this.mockStore.set(normalizedStudentId, next);
      return of(cloneMockIeltsState(next)).pipe(delay(this.mockLatencyMs));
    }

    const requestBody: UpdateStudentIeltsPayload = {
      languageScoreType: normalizedScoreType,
      testType: normalizedScoreType,
      hasTakenIeltsAcademic: false,
      preparationIntent: this.normalizePreparationIntent(intent),
    };

    return this.http.put<unknown>(`${this.studentModuleUrl}/preparation-intent`, requestBody).pipe(
      timeout({ first: this.requestTimeoutMs }),
      map((response) => this.normalizeModuleState(response, normalizedStudentId))
    );
  }

  getTeacherStudentIeltsSummary(studentId: number): Observable<TeacherStudentIeltsSummary> {
    const normalizedStudentId = this.normalizeStudentId(studentId);
    if (this.useMock) {
      const state = this.readMockState(normalizedStudentId);
      const derived = deriveStudentIeltsModuleState(state);
      return of({
        studentId: normalizedStudentId,
        studentName: MOCK_TEACHER_STUDENT_NAMES[normalizedStudentId] || `Student #${normalizedStudentId}`,
        summary: derived.summary,
      }).pipe(delay(this.mockLatencyMs));
    }

    return this.http.get<unknown>(`${this.teacherStudentsBaseUrl}/${normalizedStudentId}/ielts-summary`).pipe(
      timeout({ first: this.requestTimeoutMs }),
      map((response) => this.normalizeTeacherSummary(response, normalizedStudentId))
    );
  }

  getTeacherStudentsIeltsSummary(studentIds?: readonly number[]): Observable<TeacherStudentIeltsSummary[]> {
    const normalizedStudentIds = this.normalizeStudentIds(studentIds);
    if (this.useMock) {
      const results = normalizedStudentIds.map((id) => {
        const state = this.readMockState(id);
        const derived = deriveStudentIeltsModuleState(state);
        return {
          studentId: id,
          studentName: MOCK_TEACHER_STUDENT_NAMES[id] || `Student #${id}`,
          summary: derived.summary,
        };
      });
      return of(results).pipe(delay(this.mockLatencyMs));
    }

    let params = new HttpParams();
    if (normalizedStudentIds.length > 0) {
      params = params.set('studentIds', normalizedStudentIds.join(','));
    }

    return this.http
      .get<unknown>(`${this.teacherStudentsBaseUrl}/ielts-summary`, { params })
      .pipe(
        timeout({ first: this.requestTimeoutMs }),
        map((response) => this.normalizeTeacherSummaryList(response, normalizedStudentIds))
      );
  }

  updateTeacherStudentIeltsData(
    studentId: number,
    payload: UpdateStudentIeltsPayload
  ): Observable<StudentIeltsModuleState> {
    const normalizedStudentId = this.normalizeStudentId(studentId);
    const normalizedPayload = this.normalizeTeacherUpdatePayload(payload);

    if (this.useMock) {
      const previous = this.readMockState(normalizedStudentId);
      const effectiveScoreType =
        this.normalizeLanguageScoreType(normalizedPayload.languageScoreType) ??
        previous.languageScoreType ??
        'IELTS';
      const next: StudentIeltsModuleState = {
        ...previous,
        languageScoreType: effectiveScoreType,
        hasTakenIeltsAcademic:
          typeof normalizedPayload.hasTakenIeltsAcademic === 'boolean'
            ? normalizedPayload.hasTakenIeltsAcademic
            : previous.hasTakenIeltsAcademic,
        preparationIntent: normalizedPayload.preparationIntent || previous.preparationIntent,
        languageScoreTrackingManualStatus:
          normalizedPayload.languageScoreTrackingManualStatus !== undefined
            ? normalizedPayload.languageScoreTrackingManualStatus
            : normalizedPayload.languageTrackingManualStatus !== undefined
              ? normalizedPayload.languageTrackingManualStatus
              : previous.languageScoreTrackingManualStatus ?? previous.languageTrackingManualStatus,
        languageTrackingManualStatus:
          normalizedPayload.languageTrackingManualStatus !== undefined
            ? normalizedPayload.languageTrackingManualStatus
            : normalizedPayload.languageScoreTrackingManualStatus !== undefined
              ? normalizedPayload.languageScoreTrackingManualStatus
              : previous.languageTrackingManualStatus,
        languageCourseStatus:
          normalizedPayload.languageCourseStatus !== undefined
            ? normalizedPayload.languageCourseStatus
            : normalizedPayload.languageCourseEnrollmentStatus !== undefined
              ? normalizedPayload.languageCourseEnrollmentStatus
              : previous.languageCourseStatus ?? null,
        records: Array.isArray(normalizedPayload.records)
          ? this.normalizeRecords(normalizedPayload.records, effectiveScoreType)
          : previous.records.map((record) => ({ ...record })),
        updatedAt: new Date().toISOString(),
      };
      this.mockStore.set(normalizedStudentId, next);
      return of(cloneMockIeltsState(next)).pipe(delay(this.mockLatencyMs));
    }

    return this.http
      .put<unknown>(`${this.teacherStudentsBaseUrl}/${normalizedStudentId}/ielts-module`, normalizedPayload)
      .pipe(
        timeout({ first: this.requestTimeoutMs }),
        map((response) => this.normalizeModuleState(response, normalizedStudentId))
      );
  }

  private readMockState(studentId: number): StudentIeltsModuleState {
    const current = this.mockStore.get(studentId);
    if (current) {
      return cloneMockIeltsState(current);
    }

    const fallback = this.buildFallbackMockState(studentId);
    this.mockStore.set(studentId, fallback);
    return cloneMockIeltsState(fallback);
  }

  private safeReadMockState(studentId: number): StudentIeltsModuleState {
    try {
      return this.readMockState(studentId);
    } catch {
      return this.buildFallbackMockState(studentId);
    }
  }

  private buildFallbackMockState(studentId: number): StudentIeltsModuleState {
    const languageRisk = {
      shouldShowIeltsModule: true,
      languageRiskFlag: 'UNKNOWN' as const,
      firstLanguage: '',
      canadaStudyYears: null,
      profileCompleteness: 'PARTIAL' as const,
      riskReasonCodes: ['MISSING_RISK_SNAPSHOT'],
    };

    return {
      studentId,
      graduationYear: null,
      languageScoreType: 'IELTS',
      hasTakenIeltsAcademic: null,
      preparationIntent: 'UNSET',
      languageScoreTrackingManualStatus: null,
      languageTrackingManualStatus: null,
      languageCourseStatus: null,
      records: [],
      languageRisk: {
        ...languageRisk,
        shouldShowIeltsModule: resolveShouldShowIeltsModule(languageRisk),
      },
      updatedAt: null,
    };
  }

  private normalizeTeacherSummaryList(
    raw: unknown,
    fallbackStudentIds: readonly number[]
  ): TeacherStudentIeltsSummary[] {
    const rows = this.unwrapArrayPayload(raw);
    if (rows.length > 0) {
      return rows.map((item, index) =>
        this.normalizeTeacherSummary(item, fallbackStudentIds[index] ?? 0)
      );
    }

    if (fallbackStudentIds.length <= 0) return [];
    return fallbackStudentIds.map((studentId) => this.normalizeTeacherSummary({ studentId }, studentId));
  }

  private normalizeTeacherSummary(raw: unknown, fallbackStudentId: number): TeacherStudentIeltsSummary {
    const source = this.unwrapObjectPayload(raw);
    const stateForFallback = this.normalizeModuleState(source ?? raw, fallbackStudentId);
    const fallbackSummary = deriveStudentIeltsModuleState(stateForFallback).summary;

    const studentId = this.toInteger(
      this.readValue(source, ['studentId', 'student_id', 'id']),
      fallbackStudentId
    );
    const studentName =
      this.toText(this.readValue(source, ['studentName', 'student_name'])) || `Student #${studentId}`;

    const incomingSummary = this.unwrapObjectPayload(this.readValue(source, ['summary']));
    const trackingStatusRaw =
      this.readValue(incomingSummary, ['trackingStatus', 'tracking_status']) ??
      this.readValue(source, ['trackingStatus', 'tracking_status']);
    const languageTrackingStatusRaw =
      this.readValue(incomingSummary, [
        'languageScoreTrackingStatus',
        'language_score_tracking_status',
        'languageTrackingStatus',
        'language_tracking_status',
      ]) ??
      this.readValue(source, [
        'languageScoreTrackingStatus',
        'language_score_tracking_status',
        'languageTrackingStatus',
        'language_tracking_status',
      ]);
    const summary: IeltsSummaryViewModel = incomingSummary
      ? {
          trackingStatus: this.normalizeTrackingStatus(trackingStatusRaw),
          trackingTitle:
            this.toText(this.readValue(incomingSummary, ['trackingTitle', 'tracking_title'])) ||
            fallbackSummary.trackingTitle,
          trackingMessage:
            this.toText(this.readValue(incomingSummary, ['trackingMessage', 'tracking_message'])) ||
            fallbackSummary.trackingMessage,
          colorToken:
            this.toText(this.readValue(incomingSummary, ['colorToken', 'color_token'])) ||
            fallbackSummary.colorToken,
          shouldShowModule:
            typeof this.readValue(incomingSummary, ['shouldShowModule', 'should_show_module']) === 'boolean'
              ? (this.readValue(incomingSummary, ['shouldShowModule', 'should_show_module']) as boolean)
              : fallbackSummary.shouldShowModule,
          graduationYear: this.toNullableInteger(
            this.readValue(incomingSummary, ['graduationYear', 'graduation_year']),
            fallbackSummary.graduationYear
          ),
          languageTrackingStatus: this.normalizeLanguageTrackingStatus(
            languageTrackingStatusRaw,
            fallbackSummary.languageTrackingStatus
          ),
          languageScoreTrackingStatus: this.normalizeLanguageTrackingStatus(
            languageTrackingStatusRaw,
            fallbackSummary.languageScoreTrackingStatus ?? fallbackSummary.languageTrackingStatus
          ),
          validityCutoffDate:
            this.toText(this.readValue(incomingSummary, ['validityCutoffDate', 'validity_cutoff_date'])) ||
            fallbackSummary.validityCutoffDate,
          validityAnchorDate:
            this.toText(this.readValue(incomingSummary, ['validityAnchorDate', 'validity_anchor_date'])) ||
            fallbackSummary.validityAnchorDate,
          latestRecordId:
            this.toText(this.readValue(incomingSummary, ['latestRecordId', 'latest_record_id'])) ||
            fallbackSummary.latestRecordId,
          latestValidRecordId:
            this.toText(this.readValue(incomingSummary, ['latestValidRecordId', 'latest_valid_record_id'])) ||
            fallbackSummary.latestValidRecordId,
          thresholdMatch: this.normalizeThresholdMatch(
            this.readValue(incomingSummary, ['thresholdMatch', 'threshold_match'])
          ),
        }
      : {
          ...fallbackSummary,
          trackingStatus: this.normalizeTrackingStatus(trackingStatusRaw ?? fallbackSummary.trackingStatus),
          languageTrackingStatus: this.normalizeLanguageTrackingStatus(
            languageTrackingStatusRaw,
            fallbackSummary.languageTrackingStatus
          ),
          languageScoreTrackingStatus: this.normalizeLanguageTrackingStatus(
            languageTrackingStatusRaw,
            fallbackSummary.languageScoreTrackingStatus ?? fallbackSummary.languageTrackingStatus
          ),
        };

    return { studentId, studentName, summary };
  }

  private normalizeModuleState(raw: unknown, fallbackStudentId: number): StudentIeltsModuleState {
    const source = this.unwrapObjectPayload(raw);
    const studentId = this.toInteger(
      this.readValue(source, ['studentId', 'student_id', 'id']),
      fallbackStudentId
    );
    const graduationYear = this.toNullableInteger(
      this.readValue(source, ['graduationYear', 'graduation_year'])
    );
    const explicitScoreType = this.normalizeLanguageScoreType(
      this.readValue(source, ['languageScoreType', 'language_score_type', 'testType', 'test_type'])
    );
    const hasToeflRecords = Array.isArray(this.readValue(source, ['toeflRecords', 'toefl_records']));
    const hasDuolingoRecords = Array.isArray(
      this.readValue(source, ['duolingoRecords', 'duolingo_records'])
    );
    const inferredScoreType: LanguageScoreType | null =
      explicitScoreType ?? (hasToeflRecords ? 'TOEFL' : hasDuolingoRecords ? 'DUOLINGO' : null);
    const recordScoreType = inferredScoreType ?? 'IELTS';
    const hasTakenIeltsAcademic = this.toNullableBoolean(
      this.readValue(source, ['hasTakenIeltsAcademic', 'has_taken_ielts_academic'])
    );
    const records = this.normalizeRecords(
      this.resolveRecordsNode(source, recordScoreType),
      recordScoreType
    );
    const preparationIntent = this.normalizePreparationIntent(
      this.readValue(source, ['preparationIntent', 'preparation_intent'])
    );
    const summaryNode = this.unwrapObjectPayload(this.readValue(source, ['summary']));
    const trackingStatus =
      this.normalizeOptionalTrackingStatus(this.readValue(source, ['trackingStatus', 'tracking_status'])) ??
      this.normalizeOptionalTrackingStatus(this.readValue(summaryNode, ['trackingStatus', 'tracking_status']));
    const languageTrackingStatus =
      this.normalizeOptionalLanguageTrackingStatus(
        this.readValue(source, [
          'languageScoreTrackingStatus',
          'language_score_tracking_status',
          'languageTrackingStatus',
          'language_tracking_status',
        ])
      ) ??
      this.normalizeOptionalLanguageTrackingStatus(
        this.readValue(summaryNode, [
          'languageScoreTrackingStatus',
          'language_score_tracking_status',
          'languageTrackingStatus',
          'language_tracking_status',
        ])
      );
    const languageTrackingManualStatus = this.normalizeLanguageTrackingManualStatus(
      this.readValue(source, [
        'languageScoreTrackingManualStatus',
        'language_score_tracking_manual_status',
        'languageTrackingManualStatus',
        'language_tracking_manual_status',
      ])
    );
    const languageCourseStatus = this.normalizeLanguageCourseStatus(
      this.readValue(source, [
        'languageCourseStatus',
        'language_course_status',
        'languageCourseEnrollmentStatus',
        'language_course_enrollment_status',
      ])
    );
    const languageRisk = this.normalizeLanguageRisk(this.readValue(source, ['languageRisk', 'language_risk']));

    return {
      studentId,
      graduationYear,
      languageScoreType: inferredScoreType,
      hasTakenIeltsAcademic,
      preparationIntent,
      trackingStatus,
      languageScoreTrackingStatus: languageTrackingStatus,
      languageTrackingStatus,
      languageScoreTrackingManualStatus: languageTrackingManualStatus,
      languageTrackingManualStatus,
      languageCourseStatus,
      records,
      languageRisk,
      updatedAt: this.toNullableText(this.readValue(source, ['updatedAt', 'updated_at'])),
    };
  }

  private normalizeLanguageRisk(value: unknown): StudentLanguageRiskSnapshot {
    const source = this.toRecord(value);
    const riskReasonCodes = Array.isArray(source?.['riskReasonCodes'])
      ? source['riskReasonCodes']
          .map((item) => this.toText(item))
          .filter((item) => item.length > 0)
      : [];

    const snapshot: StudentLanguageRiskSnapshot = {
      shouldShowIeltsModule:
        typeof source?.['shouldShowIeltsModule'] === 'boolean'
          ? (source['shouldShowIeltsModule'] as boolean)
          : undefined,
      languageRiskFlag: this.normalizeLanguageRiskFlag(source?.['languageRiskFlag']),
      firstLanguage: this.toNullableText(source?.['firstLanguage']) || undefined,
      nativeLanguage: this.toNullableText(source?.['nativeLanguage']) || undefined,
      citizenship: this.toNullableText(source?.['citizenship']) || undefined,
      canadaStudyYears: this.toNullableNumber(source?.['canadaStudyYears']),
      hasCanadianHighSchoolExperience:
        typeof source?.['hasCanadianHighSchoolExperience'] === 'boolean'
          ? (source['hasCanadianHighSchoolExperience'] as boolean)
          : undefined,
      profileCompleteness: this.normalizeProfileCompleteness(source?.['profileCompleteness']),
      riskReasonCodes,
    };

    snapshot.shouldShowIeltsModule = resolveShouldShowIeltsModule(snapshot);
    return snapshot;
  }

  private normalizeTeacherUpdatePayload(payload: UpdateStudentIeltsPayload): UpdateStudentIeltsPayload {
    const normalized: UpdateStudentIeltsPayload = {};
    const normalizedScoreType =
      this.normalizeLanguageScoreType(payload.languageScoreType) ??
      this.normalizeLanguageScoreType(payload.testType) ??
      this.normalizeLanguageScoreType(payload.test_type) ??
      null;

    if (normalizedScoreType) {
      normalized.languageScoreType = normalizedScoreType;
      normalized.testType = normalizedScoreType;
    }

    if (typeof payload.hasTakenIeltsAcademic === 'boolean' || payload.hasTakenIeltsAcademic === null) {
      normalized.hasTakenIeltsAcademic = payload.hasTakenIeltsAcademic;
    }

    if (payload.preparationIntent !== undefined) {
      normalized.preparationIntent = this.normalizePreparationIntent(payload.preparationIntent);
    }

    const manualStatusInput =
      payload.languageScoreTrackingManualStatus !== undefined
        ? payload.languageScoreTrackingManualStatus
        : payload.languageTrackingManualStatus;
    if (manualStatusInput !== undefined) {
      normalized.languageTrackingManualStatus = this.normalizeLanguageTrackingManualStatus(
        manualStatusInput
      );
      normalized.languageScoreTrackingManualStatus = normalized.languageTrackingManualStatus;
    }

    const languageCourseStatusInput =
      payload.languageCourseStatus !== undefined
        ? payload.languageCourseStatus
        : payload.languageCourseEnrollmentStatus;
    if (languageCourseStatusInput !== undefined) {
      normalized.languageCourseStatus = this.normalizeLanguageCourseStatus(languageCourseStatusInput);
    }

    const rawRecords = Array.isArray(payload.records)
      ? payload.records
      : Array.isArray(payload.toeflRecords)
        ? payload.toeflRecords
        : Array.isArray(payload.duolingoRecords)
          ? payload.duolingoRecords
        : null;
    if (rawRecords) {
      const effectiveScoreType = normalizedScoreType ?? 'IELTS';
      const normalizedRecords = this.normalizeRecords(rawRecords, effectiveScoreType);
      Object.assign(
        normalized,
        this.buildScoreRecordPayload(
          {
            languageScoreType: effectiveScoreType,
            testType: effectiveScoreType,
          },
          normalizedRecords,
          effectiveScoreType
        )
      );
    }

    const teacherNote = this.toText(payload.teacherNote);
    if (teacherNote) {
      normalized.teacherNote = teacherNote;
    }

    return normalized;
  }

  private buildScoreRecordPayload(
    basePayload: UpdateStudentIeltsPayload,
    records: IeltsRecordFormValue[],
    languageScoreType: LanguageScoreType
  ): UpdateStudentIeltsPayload {
    const scorePayload: UpdateStudentIeltsPayload = {
      ...basePayload,
      languageScoreType,
      testType: languageScoreType,
      records,
    };
    if (languageScoreType === 'TOEFL') {
      scorePayload.toeflRecords = records;
    }
    if (languageScoreType === 'DUOLINGO') {
      scorePayload.duolingoRecords = records;
    }

    return {
      ...scorePayload,
    };
  }

  private resolveRecordsNode(
    source: Record<string, unknown> | null,
    languageScoreType: LanguageScoreType
  ): unknown {
    if (languageScoreType === 'TOEFL') {
      return this.readValue(source, ['toeflRecords', 'toefl_records', 'records', 'ieltsRecords', 'ielts_records']);
    }
    if (languageScoreType === 'DUOLINGO') {
      return this.readValue(source, [
        'duolingoRecords',
        'duolingo_records',
        'records',
        'ieltsRecords',
        'ielts_records',
      ]);
    }
    return this.readValue(source, ['records', 'ieltsRecords', 'ielts_records', 'toeflRecords', 'toefl_records']);
  }

  private normalizeRecords(
    value: unknown,
    languageScoreType: LanguageScoreType = 'IELTS'
  ): IeltsRecordFormValue[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((record, index) => {
      const source = this.toRecord(record);
      return {
        recordId:
          this.toNullableText(this.readValue(source, ['recordId', 'record_id', 'id'])) ||
          `record-${index + 1}`,
        testDate: this.toText(this.readValue(source, ['testDate', 'test_date'])),
        listening: this.toNullableBandScore(this.readValue(source, ['listening']), languageScoreType),
        reading: this.toNullableBandScore(this.readValue(source, ['reading']), languageScoreType),
        writing: this.toNullableBandScore(this.readValue(source, ['writing']), languageScoreType),
        speaking: this.toNullableBandScore(this.readValue(source, ['speaking']), languageScoreType),
      };
    });
  }

  private unwrapObjectPayload(value: unknown): Record<string, unknown> | null {
    let current = this.toRecord(value);
    for (let depth = 0; depth < 3; depth += 1) {
      const nested = this.toRecord(current?.['data']);
      if (!nested || nested === current) {
        break;
      }
      current = nested;
    }
    return current;
  }

  private readValue(source: Record<string, unknown> | null, keys: readonly string[]): unknown {
    if (!source) return undefined;
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        return source[key];
      }
    }
    return undefined;
  }

  private normalizePreparationIntent(value: unknown): IeltsPreparationIntent {
    const normalized = this.toText(value).toUpperCase();
    if (normalized === 'PREPARING') return 'PREPARING';
    if (normalized === 'NOT_PREPARING') return 'NOT_PREPARING';
    return 'UNSET';
  }

  private normalizeLanguageScoreType(value: unknown): LanguageScoreType | null {
    const normalized = this.toText(value).toUpperCase();
    if (normalized === 'IELTS') return 'IELTS';
    if (normalized === 'TOEFL') return 'TOEFL';
    if (normalized === 'DUOLINGO') return 'DUOLINGO';
    if (normalized === 'OTHER') return 'OTHER';
    return null;
  }

  private normalizeTrackingStatus(value: unknown): IeltsTrackingStatus {
    const normalized = this.toText(value).toUpperCase();
    if (normalized === 'GREEN_STRICT_PASS') return 'GREEN_STRICT_PASS';
    if (normalized === 'GREEN_COMMON_PASS_WITH_WARNING') return 'GREEN_COMMON_PASS_WITH_WARNING';
    return 'YELLOW_NEEDS_PREPARATION';
  }

  private normalizeOptionalTrackingStatus(value: unknown): IeltsTrackingStatus | null {
    const normalized = this.toText(value).toUpperCase();
    if (normalized === 'GREEN_STRICT_PASS') return 'GREEN_STRICT_PASS';
    if (normalized === 'GREEN_COMMON_PASS_WITH_WARNING') return 'GREEN_COMMON_PASS_WITH_WARNING';
    if (normalized === 'YELLOW_NEEDS_PREPARATION') return 'YELLOW_NEEDS_PREPARATION';
    return null;
  }

  private normalizeLanguageTrackingStatus(
    value: unknown,
    fallback: IeltsSummaryViewModel['languageTrackingStatus']
  ): IeltsSummaryViewModel['languageTrackingStatus'] {
    const normalized = this.toText(value).toUpperCase();
    if (normalized === 'TEACHER_REVIEW_APPROVED') return 'TEACHER_REVIEW_APPROVED';
    if (normalized === 'AUTO_PASS_ALL_SCHOOLS') return 'AUTO_PASS_ALL_SCHOOLS';
    if (normalized === 'AUTO_PASS_PARTIAL_SCHOOLS') return 'AUTO_PASS_PARTIAL_SCHOOLS';
    if (normalized === 'NEEDS_TRACKING') return 'NEEDS_TRACKING';
    return fallback;
  }

  private normalizeLanguageTrackingManualStatus(value: unknown): LanguageTrackingManualStatus {
    const normalized = this.toText(value).toUpperCase();
    if (normalized === 'TEACHER_REVIEW_APPROVED') return 'TEACHER_REVIEW_APPROVED';
    if (normalized === 'AUTO_PASS_ALL_SCHOOLS') return 'AUTO_PASS_ALL_SCHOOLS';
    if (normalized === 'AUTO_PASS_PARTIAL_SCHOOLS') return 'AUTO_PASS_PARTIAL_SCHOOLS';
    if (normalized === 'NEEDS_TRACKING') return 'NEEDS_TRACKING';
    return null;
  }

  private normalizeLanguageCourseStatus(value: unknown): LanguageCourseStatus | null {
    const normalized = this.toText(value).toUpperCase();
    if (normalized === 'NOT_RECEIVED_TRAINING' || normalized === '1') {
      return 'NOT_RECEIVED_TRAINING';
    }
    if (normalized === 'ENROLLED_GLOBAL_IELTS' || normalized === '2') {
      return 'ENROLLED_GLOBAL_IELTS';
    }
    if (normalized === 'ENROLLED_OTHER_IELTS' || normalized === '3') {
      return 'ENROLLED_OTHER_IELTS';
    }
    if (normalized === 'COURSE_COMPLETED_NOT_EXAMINED' || normalized === '4') {
      return 'COURSE_COMPLETED_NOT_EXAMINED';
    }
    if (normalized === 'EXAM_REGISTERED' || normalized === '5') {
      return 'EXAM_REGISTERED';
    }
    if (normalized === 'SCORE_RELEASED' || normalized === '6') {
      return 'SCORE_RELEASED';
    }
    return null;
  }

  private normalizeOptionalLanguageTrackingStatus(
    value: unknown
  ): IeltsSummaryViewModel['languageTrackingStatus'] | null {
    const normalized = this.toText(value).toUpperCase();
    if (normalized === 'TEACHER_REVIEW_APPROVED') return 'TEACHER_REVIEW_APPROVED';
    if (normalized === 'AUTO_PASS_ALL_SCHOOLS') return 'AUTO_PASS_ALL_SCHOOLS';
    if (normalized === 'AUTO_PASS_PARTIAL_SCHOOLS') return 'AUTO_PASS_PARTIAL_SCHOOLS';
    if (normalized === 'NEEDS_TRACKING') return 'NEEDS_TRACKING';
    return null;
  }

  private normalizeThresholdMatch(
    value: unknown
  ): 'STRICT_PASS' | 'COMMON_PASS' | 'BELOW_COMMON' | 'NOT_APPLICABLE' {
    const normalized = this.toText(value).toUpperCase();
    if (normalized === 'STRICT_PASS') return 'STRICT_PASS';
    if (normalized === 'COMMON_PASS') return 'COMMON_PASS';
    if (normalized === 'BELOW_COMMON') return 'BELOW_COMMON';
    return 'NOT_APPLICABLE';
  }

  private normalizeLanguageRiskFlag(value: unknown): 'RISK' | 'NOT_RISK' | 'UNKNOWN' | undefined {
    const normalized = this.toText(value).toUpperCase();
    if (normalized === 'RISK') return 'RISK';
    if (normalized === 'NOT_RISK') return 'NOT_RISK';
    if (normalized === 'UNKNOWN') return 'UNKNOWN';
    return undefined;
  }

  private normalizeProfileCompleteness(value: unknown): 'COMPLETE' | 'PARTIAL' | 'UNKNOWN' | undefined {
    const normalized = this.toText(value).toUpperCase();
    if (normalized === 'COMPLETE') return 'COMPLETE';
    if (normalized === 'PARTIAL') return 'PARTIAL';
    if (normalized === 'UNKNOWN') return 'UNKNOWN';
    return undefined;
  }

  private normalizeStudentId(value: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0;
    }
    return Math.trunc(parsed);
  }

  private toInteger(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.trunc(parsed);
  }

  private toNullableInteger(value: unknown, fallback: number | null = null): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const normalized = Math.trunc(parsed);
    if (normalized < 0) return fallback;
    return normalized;
  }

  private toNullableNumber(value: unknown): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  }

  private toNullableBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value;
    return null;
  }

  private toNullableBandScore(value: unknown, languageScoreType: LanguageScoreType = 'IELTS'): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    const min = languageScoreType === 'TOEFL' ? 1 : languageScoreType === 'DUOLINGO' ? 10 : 0;
    const max = languageScoreType === 'TOEFL' ? 6 : languageScoreType === 'DUOLINGO' ? 160 : 9;
    if (parsed < min || parsed > max) return null;
    if (languageScoreType === 'DUOLINGO') {
      return Number(parsed.toFixed(0));
    }
    return Number(parsed.toFixed(1));
  }

  private toText(value: unknown): string {
    return String(value ?? '').trim();
  }

  private toNullableText(value: unknown): string | null {
    const text = this.toText(value);
    return text ? text : null;
  }

  private toRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') return null;
    return value as Record<string, unknown>;
  }
}
