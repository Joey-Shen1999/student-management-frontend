import { HttpClient } from '@angular/common/http';
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
  IeltsRecordFormValue,
  IeltsSummaryViewModel,
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
    payload: UpdateStudentIeltsPayload
  ): Observable<StudentIeltsModuleState> {
    const normalizedStudentId = this.normalizeStudentId(studentId);
    if (this.useMock) {
      const previous = this.readMockState(normalizedStudentId);
      const next: StudentIeltsModuleState = {
        ...previous,
        hasTakenIeltsAcademic: true,
        preparationIntent: 'UNSET',
        records: this.normalizeRecords(payload.records),
        updatedAt: new Date().toISOString(),
      };
      this.mockStore.set(normalizedStudentId, next);
      return of(cloneMockIeltsState(next)).pipe(delay(this.mockLatencyMs));
    }

    const requestBody: UpdateStudentIeltsPayload = {
      hasTakenIeltsAcademic: true,
      records: this.normalizeRecords(payload.records),
    };

    return this.http.put<unknown>(`${this.studentModuleUrl}/records`, requestBody).pipe(
      timeout({ first: this.requestTimeoutMs }),
      map((response) => this.normalizeModuleState(response, normalizedStudentId))
    );
  }

  saveStudentIeltsPreparationIntent(
    studentId: number,
    intent: IeltsPreparationIntent
  ): Observable<StudentIeltsModuleState> {
    const normalizedStudentId = this.normalizeStudentId(studentId);
    if (this.useMock) {
      const previous = this.readMockState(normalizedStudentId);
      const next: StudentIeltsModuleState = {
        ...previous,
        hasTakenIeltsAcademic: false,
        preparationIntent: this.normalizePreparationIntent(intent),
        records: [],
        updatedAt: new Date().toISOString(),
      };
      this.mockStore.set(normalizedStudentId, next);
      return of(cloneMockIeltsState(next)).pipe(delay(this.mockLatencyMs));
    }

    const requestBody: UpdateStudentIeltsPayload = {
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

  updateTeacherStudentIeltsData(
    studentId: number,
    payload: UpdateStudentIeltsPayload
  ): Observable<StudentIeltsModuleState> {
    const normalizedStudentId = this.normalizeStudentId(studentId);
    const normalizedPayload = this.normalizeTeacherUpdatePayload(payload);

    if (this.useMock) {
      const previous = this.readMockState(normalizedStudentId);
      const next: StudentIeltsModuleState = {
        ...previous,
        hasTakenIeltsAcademic:
          typeof normalizedPayload.hasTakenIeltsAcademic === 'boolean'
            ? normalizedPayload.hasTakenIeltsAcademic
            : previous.hasTakenIeltsAcademic,
        preparationIntent: normalizedPayload.preparationIntent || previous.preparationIntent,
        records: Array.isArray(normalizedPayload.records)
          ? this.normalizeRecords(normalizedPayload.records)
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
      hasTakenIeltsAcademic: null,
      preparationIntent: 'UNSET',
      records: [],
      languageRisk: {
        ...languageRisk,
        shouldShowIeltsModule: resolveShouldShowIeltsModule(languageRisk),
      },
      updatedAt: null,
    };
  }

  private normalizeTeacherSummary(raw: unknown, fallbackStudentId: number): TeacherStudentIeltsSummary {
    const source = this.toRecord(raw);
    const stateForFallback = this.normalizeModuleState(source, fallbackStudentId);
    const fallbackSummary = deriveStudentIeltsModuleState(stateForFallback).summary;

    const studentId = this.toInteger(source?.['studentId'], fallbackStudentId);
    const studentName = this.toText(source?.['studentName']) || `Student #${studentId}`;

    const incomingSummary = this.toRecord(source?.['summary']);
    const summary: IeltsSummaryViewModel = incomingSummary
      ? {
          trackingStatus: this.normalizeTrackingStatus(incomingSummary['trackingStatus']),
          trackingTitle: this.toText(incomingSummary['trackingTitle']) || fallbackSummary.trackingTitle,
          trackingMessage: this.toText(incomingSummary['trackingMessage']) || fallbackSummary.trackingMessage,
          colorToken: this.toText(incomingSummary['colorToken']) || fallbackSummary.colorToken,
          shouldShowModule:
            typeof incomingSummary['shouldShowModule'] === 'boolean'
              ? (incomingSummary['shouldShowModule'] as boolean)
              : fallbackSummary.shouldShowModule,
          graduationYear: this.toNullableInteger(
            incomingSummary['graduationYear'],
            fallbackSummary.graduationYear
          ),
          validityCutoffDate:
            this.toText(incomingSummary['validityCutoffDate']) || fallbackSummary.validityCutoffDate,
          validityAnchorDate:
            this.toText(incomingSummary['validityAnchorDate']) || fallbackSummary.validityAnchorDate,
          latestRecordId: this.toText(incomingSummary['latestRecordId']) || fallbackSummary.latestRecordId,
          latestValidRecordId:
            this.toText(incomingSummary['latestValidRecordId']) || fallbackSummary.latestValidRecordId,
          thresholdMatch: this.normalizeThresholdMatch(incomingSummary['thresholdMatch']),
        }
      : fallbackSummary;

    return { studentId, studentName, summary };
  }

  private normalizeModuleState(raw: unknown, fallbackStudentId: number): StudentIeltsModuleState {
    const source = this.toRecord(raw);
    const studentId = this.toInteger(source?.['studentId'], fallbackStudentId);
    const graduationYear = this.toNullableInteger(source?.['graduationYear']);
    const hasTakenIeltsAcademic = this.toNullableBoolean(source?.['hasTakenIeltsAcademic']);
    const records = this.normalizeRecords(source?.['records']);
    const preparationIntent = this.normalizePreparationIntent(source?.['preparationIntent']);
    const languageRisk = this.normalizeLanguageRisk(source?.['languageRisk']);

    return {
      studentId,
      graduationYear,
      hasTakenIeltsAcademic,
      preparationIntent,
      records,
      languageRisk,
      updatedAt: this.toNullableText(source?.['updatedAt']),
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

    if (typeof payload.hasTakenIeltsAcademic === 'boolean' || payload.hasTakenIeltsAcademic === null) {
      normalized.hasTakenIeltsAcademic = payload.hasTakenIeltsAcademic;
    }

    if (payload.preparationIntent !== undefined) {
      normalized.preparationIntent = this.normalizePreparationIntent(payload.preparationIntent);
    }

    if (Array.isArray(payload.records)) {
      normalized.records = this.normalizeRecords(payload.records);
    }

    const teacherNote = this.toText(payload.teacherNote);
    if (teacherNote) {
      normalized.teacherNote = teacherNote;
    }

    return normalized;
  }

  private normalizeRecords(value: unknown): IeltsRecordFormValue[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((record, index) => {
      const source = this.toRecord(record);
      return {
        recordId: this.toNullableText(source?.['recordId']) || `record-${index + 1}`,
        testDate: this.toText(source?.['testDate']),
        listening: this.toNullableBandScore(source?.['listening']),
        reading: this.toNullableBandScore(source?.['reading']),
        writing: this.toNullableBandScore(source?.['writing']),
        speaking: this.toNullableBandScore(source?.['speaking']),
      };
    });
  }

  private normalizePreparationIntent(value: unknown): IeltsPreparationIntent {
    const normalized = this.toText(value).toUpperCase();
    if (normalized === 'PREPARING') return 'PREPARING';
    if (normalized === 'NOT_PREPARING') return 'NOT_PREPARING';
    return 'UNSET';
  }

  private normalizeTrackingStatus(value: unknown): IeltsTrackingStatus {
    const normalized = this.toText(value).toUpperCase();
    if (normalized === 'GREEN_STRICT_PASS') return 'GREEN_STRICT_PASS';
    if (normalized === 'GREEN_COMMON_PASS_WITH_WARNING') return 'GREEN_COMMON_PASS_WITH_WARNING';
    return 'YELLOW_NEEDS_PREPARATION';
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

  private toNullableBandScore(value: unknown): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    if (parsed < 0 || parsed > 9) return null;
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
