import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, timeout } from 'rxjs';

import { deriveOssltTrackingStatus, deriveStudentOssltSummary } from '../features/osslt/osslt-derive';
import {
  OsslcCourseStatus,
  OssltResult,
  OssltTrackingManualStatus,
  OssltTrackingStatus,
  StudentOssltModuleState,
  TeacherStudentOssltSummary,
  UpdateStudentOssltPayload,
} from '../features/osslt/osslt-types';

@Injectable({ providedIn: 'root' })
export class OssltTrackingService {
  private readonly teacherStudentsBaseUrl = '/api/teacher/students';
  private readonly studentOssltModuleUrl = '/api/student/osslt-module';
  private readonly requestTimeoutMs = 12000;

  constructor(private http: HttpClient) {}

  getTeacherStudentOssltModuleState(studentId: number): Observable<StudentOssltModuleState> {
    const normalizedStudentId = this.normalizeStudentId(studentId);
    return this.http
      .get<unknown>(`${this.teacherStudentsBaseUrl}/${normalizedStudentId}/osslt-module`)
      .pipe(
        timeout({ first: this.requestTimeoutMs }),
        map((response) => this.normalizeModuleState(response, normalizedStudentId))
      );
  }

  getStudentOssltModuleState(): Observable<StudentOssltModuleState> {
    return this.http.get<unknown>(this.studentOssltModuleUrl).pipe(
      timeout({ first: this.requestTimeoutMs }),
      map((response) => this.normalizeModuleState(response, 0))
    );
  }

  updateTeacherStudentOssltData(
    studentId: number,
    payload: UpdateStudentOssltPayload
  ): Observable<StudentOssltModuleState> {
    const normalizedStudentId = this.normalizeStudentId(studentId);
    const normalizedPayload = this.normalizeUpdatePayload(payload);
    return this.http
      .put<unknown>(`${this.teacherStudentsBaseUrl}/${normalizedStudentId}/osslt-module`, normalizedPayload)
      .pipe(
        timeout({ first: this.requestTimeoutMs }),
        map((response) => this.normalizeModuleState(response, normalizedStudentId))
      );
  }

  updateStudentOssltData(payload: UpdateStudentOssltPayload): Observable<StudentOssltModuleState> {
    const normalizedPayload = this.normalizeStudentSelfUpdatePayload(payload);
    return this.http.put<unknown>(this.studentOssltModuleUrl, normalizedPayload).pipe(
      timeout({ first: this.requestTimeoutMs }),
      map((response) => this.normalizeModuleState(response, 0))
    );
  }

  getTeacherStudentOssltSummary(studentId: number): Observable<TeacherStudentOssltSummary> {
    const normalizedStudentId = this.normalizeStudentId(studentId);
    return this.getTeacherStudentsOssltSummary([normalizedStudentId]).pipe(
      map(
        (list) =>
          list.find((item) => item.studentId === normalizedStudentId) ??
          this.normalizeSummary({ studentId: normalizedStudentId }, normalizedStudentId)
      )
    );
  }

  getTeacherStudentsOssltSummary(studentIds?: readonly number[]): Observable<TeacherStudentOssltSummary[]> {
    const normalizedStudentIds = this.normalizeStudentIds(studentIds);
    let params = new HttpParams();
    if (normalizedStudentIds.length > 0) {
      params = params.set('studentIds', normalizedStudentIds.join(','));
    }
    return this.http
      .get<unknown>(`${this.teacherStudentsBaseUrl}/osslt-summary`, { params })
      .pipe(
        timeout({ first: this.requestTimeoutMs }),
        map((response) => this.normalizeSummaryList(response, normalizedStudentIds))
      );
  }

  private normalizeSummaryList(
    raw: unknown,
    fallbackStudentIds: readonly number[]
  ): TeacherStudentOssltSummary[] {
    const rows = this.unwrapArrayPayload(raw);
    if (rows.length > 0) {
      return rows.map((item, index) => this.normalizeSummary(item, fallbackStudentIds[index] ?? 0));
    }

    if (fallbackStudentIds.length <= 0) return [];
    return fallbackStudentIds.map((studentId) => this.normalizeSummary({ studentId }, studentId));
  }

  private normalizeSummary(raw: unknown, fallbackStudentId: number): TeacherStudentOssltSummary {
    const source = this.unwrapObjectPayload(raw);
    const state = this.normalizeModuleState(source ?? raw, fallbackStudentId);
    return {
      studentId: state.studentId,
      studentName:
        this.toText(this.readValue(source, ['studentName', 'student_name'])) ||
        `Student #${state.studentId}`,
      summary: deriveStudentOssltSummary(state),
    };
  }

  private normalizeModuleState(raw: unknown, fallbackStudentId: number): StudentOssltModuleState {
    const source = this.unwrapObjectPayload(raw);
    const studentId = this.toInteger(
      this.readValue(source, ['studentId', 'student_id', 'id']),
      fallbackStudentId
    );
    const graduationYear = this.toNullableInteger(
      this.readValue(source, ['graduationYear', 'graduation_year'])
    );
    const latestOssltResult = this.normalizeResult(
      this.readValue(source, ['latestOssltResult', 'latest_osslt_result'])
    );
    const latestOssltDate = this.toNullableText(
      this.readValue(source, ['latestOssltDate', 'latest_osslt_date'])
    );
    const hasOsslc = this.normalizeNullableBoolean(
      this.readValue(source, ['hasOsslc', 'has_osslc', 'osslcStatus', 'osslc_status'])
    );
    const osslcCourseStatus = this.normalizeOsslcCourseStatus(
      this.readValue(source, [
        'osslcCourseStatus',
        'osslc_course_status',
        'osslcCoursePlanStatus',
        'osslc_course_plan_status',
      ])
    );
    const osslcCourseLocation = this.toNullableText(
      this.readValue(source, [
        'osslcCourseLocation',
        'osslc_course_location',
        'osslcLocation',
        'osslc_location',
      ])
    );
    const manualStatus = this.normalizeManualStatus(
      this.readValue(source, ['ossltTrackingManualStatus', 'osslt_tracking_manual_status'])
    );
    const incomingStatus = this.normalizeStatus(
      this.readValue(source, ['ossltTrackingStatus', 'osslt_tracking_status'])
    );
    const trackingStatus =
      incomingStatus ?? deriveOssltTrackingStatus(manualStatus, latestOssltResult, hasOsslc);

    return {
      studentId,
      graduationYear,
      latestOssltResult,
      latestOssltDate,
      hasOsslc,
      osslcCourseStatus,
      osslcCourseLocation,
      ossltTrackingManualStatus: manualStatus,
      ossltTrackingStatus: trackingStatus,
      updatedAt: this.toNullableText(this.readValue(source, ['updatedAt', 'updated_at'])),
    };
  }

  private normalizeUpdatePayload(payload: UpdateStudentOssltPayload): UpdateStudentOssltPayload {
    const normalized: UpdateStudentOssltPayload = {};
    if (payload.latestOssltResult !== undefined) {
      normalized.latestOssltResult = this.normalizeResult(payload.latestOssltResult);
    }
    if (payload.latestOssltDate !== undefined) {
      normalized.latestOssltDate = this.toNullableText(payload.latestOssltDate);
    }
    if (payload.hasOsslc !== undefined) {
      normalized.hasOsslc = this.normalizeNullableBoolean(payload.hasOsslc);
    }
    if (payload.osslcCourseStatus !== undefined) {
      normalized.osslcCourseStatus = this.normalizeOsslcCourseStatus(payload.osslcCourseStatus);
    }
    if (payload.osslcCourseLocation !== undefined) {
      normalized.osslcCourseLocation = this.toNullableText(payload.osslcCourseLocation);
    }
    if (payload.ossltTrackingManualStatus !== undefined) {
      normalized.ossltTrackingManualStatus = this.normalizeManualStatus(payload.ossltTrackingManualStatus);
    }

    return normalized;
  }

  private normalizeStudentSelfUpdatePayload(payload: UpdateStudentOssltPayload): UpdateStudentOssltPayload {
    const normalized: UpdateStudentOssltPayload = {};
    if (payload.latestOssltResult !== undefined) {
      normalized.latestOssltResult = this.normalizeResult(payload.latestOssltResult);
    }
    if (payload.hasOsslc !== undefined) {
      normalized.hasOsslc = this.normalizeNullableBoolean(payload.hasOsslc);
    }
    return normalized;
  }

  private normalizeResult(value: unknown): OssltResult {
    const normalized = this.toText(value).toUpperCase();
    if (normalized === 'PASS') return 'PASS';
    if (normalized === 'FAIL') return 'FAIL';
    return 'UNKNOWN';
  }

  private normalizeManualStatus(value: unknown): OssltTrackingManualStatus {
    return this.normalizeStatus(value);
  }

  private normalizeStatus(value: unknown): OssltTrackingStatus | null {
    const normalized = this.toText(value).toUpperCase();
    if (normalized === 'WAITING_UPDATE') return 'WAITING_UPDATE';
    if (normalized === 'NEEDS_TRACKING') return 'NEEDS_TRACKING';
    if (normalized === 'PASSED') return 'PASSED';
    return null;
  }

  private normalizeOsslcCourseStatus(value: unknown): OsslcCourseStatus {
    const normalized = this.toText(value).toUpperCase();
    if (normalized === 'NOT_PLANNING' || normalized === 'NOT_PLAN' || normalized === 'NO_PLAN') {
      return 'NOT_PLANNING';
    }
    if (normalized === 'IN_PROGRESS' || normalized === 'ENROLLED' || normalized === 'TAKING') {
      return 'IN_PROGRESS';
    }
    if (
      normalized === 'NOT_ENROLLED' ||
      normalized === 'NOT_ENROLLED_YET' ||
      normalized === 'NOT_REGISTERED' ||
      normalized === 'PENDING_ENROLLMENT'
    ) {
      return 'NOT_ENROLLED';
    }
    return null;
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

  private toNullableInteger(value: unknown): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    const normalized = Math.trunc(parsed);
    if (normalized < 0) return null;
    return normalized;
  }

  private toText(value: unknown): string {
    return String(value ?? '').trim();
  }

  private toNullableText(value: unknown): string | null {
    const text = this.toText(value);
    return text ? text : null;
  }

  private normalizeNullableBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value;
    if (value === null || value === undefined) return null;

    const normalized = this.toText(value).toUpperCase();
    if (!normalized) return null;
    if (
      normalized === 'TRUE' ||
      normalized === '1' ||
      normalized === 'YES' ||
      normalized === 'Y' ||
      normalized === 'ENROLLED' ||
      normalized === 'COMPLETED'
    ) {
      return true;
    }
    if (
      normalized === 'FALSE' ||
      normalized === '0' ||
      normalized === 'NO' ||
      normalized === 'N' ||
      normalized === 'NOT_ENROLLED' ||
      normalized === 'NOT_COMPLETED'
    ) {
      return false;
    }
    return null;
  }

  private normalizeStudentIds(studentIds?: readonly number[] | null): number[] {
    if (!Array.isArray(studentIds)) return [];
    const seen = new Set<number>();
    const normalized: number[] = [];
    for (const studentId of studentIds) {
      const id = this.normalizeStudentId(studentId);
      if (id <= 0 || seen.has(id)) continue;
      seen.add(id);
      normalized.push(id);
    }
    return normalized;
  }

  private toRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') return null;
    return value as Record<string, unknown>;
  }

  private unwrapArrayPayload(value: unknown): unknown[] {
    let current: unknown = value;
    for (let depth = 0; depth < 3; depth += 1) {
      if (Array.isArray(current)) return current;
      const record = this.toRecord(current);
      if (!record) break;
      if (Array.isArray(record['items'])) return record['items'] as unknown[];
      if (Array.isArray(record['data'])) return record['data'] as unknown[];
      if (!record['data']) break;
      current = record['data'];
    }
    return Array.isArray(current) ? current : [];
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
}
