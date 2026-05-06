import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, of, timeout } from 'rxjs';

export type ExtracurricularActivityType =
  | 'COMPETITION'
  | 'PUBLIC_EVENT'
  | 'SUMMER_CAMP'
  | 'CLUB'
  | 'RESEARCH'
  | 'INTERNSHIP'
  | 'CERTIFICATE'
  | 'OTHER';

export type ExtracurricularActivityLevel =
  | ''
  | 'SCHOOL'
  | 'CITY'
  | 'PROVINCE'
  | 'NATIONAL'
  | 'INTERNATIONAL'
  | 'OTHER';

export interface ExtracurricularActivityVm {
  activityType: ExtracurricularActivityType;
  activityName: string;
  organization: string;
  role: string;
  activityLevel: ExtracurricularActivityLevel;
  awardOrResult: string;
  competitionCategory: string;
  activityDate: string;
  startDate: string;
  endDate: string;
  description: string;
  admissionRelevance: string;
  proofContact: string;
  proofUrl: string;
}

export interface ExtracurricularTrackingRecordVm {
  id: number;
  title: string;
  note: string;
  totalActivities: number;
  competitionCount: number;
  awardCount: number;
  activities: ExtracurricularActivityVm[];
  createdAt: string | null;
  updatedAt: string | null;
  updatedByTeacherId: number | null;
  updatedByTeacherName: string | null;
}

export interface ExtracurricularTrackingStateVm {
  studentId: number;
  note: string;
  totalActivities: number;
  competitionCount: number;
  awardCount: number;
  activities: ExtracurricularActivityVm[];
  records: ExtracurricularTrackingRecordVm[];
}

export interface UpdateExtracurricularTrackingRequestVm {
  note: string;
  activities: ExtracurricularActivityVm[];
}

export interface ExtracurricularTrackingBatchSummaryItemVm {
  studentId: number;
  totalActivities: number;
  competitionCount: number;
  awardCount: number;
  updatedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class ExtracurricularTrackingService {
  private readonly teacherStudentsBaseUrl = '/api/teacher/students';
  private readonly studentTrackingUrl = '/api/student/extracurricular-tracking';
  private readonly requestTimeoutMs = 12000;

  constructor(private http: HttpClient) {}

  getTeacherStudentExtracurricularTracking(studentId: number): Observable<ExtracurricularTrackingStateVm> {
    const normalizedStudentId = this.normalizeStudentId(studentId);
    return this.http
      .get<unknown>(`${this.teacherStudentsBaseUrl}/${normalizedStudentId}/extracurricular-tracking`)
      .pipe(
        timeout({ first: this.requestTimeoutMs }),
        map((response) => this.normalizeTrackingState(response, normalizedStudentId))
      );
  }

  updateTeacherStudentExtracurricularTracking(
    studentId: number,
    request: UpdateExtracurricularTrackingRequestVm
  ): Observable<ExtracurricularTrackingStateVm> {
    const normalizedStudentId = this.normalizeStudentId(studentId);
    return this.http
      .put<unknown>(
        `${this.teacherStudentsBaseUrl}/${normalizedStudentId}/extracurricular-tracking`,
        this.normalizeUpdateRequest(request)
      )
      .pipe(
        timeout({ first: this.requestTimeoutMs }),
        map((response) => this.normalizeTrackingState(response, normalizedStudentId))
      );
  }

  getMyExtracurricularTracking(): Observable<ExtracurricularTrackingStateVm> {
    return this.http.get<unknown>(this.studentTrackingUrl).pipe(
      timeout({ first: this.requestTimeoutMs }),
      map((response) => this.normalizeTrackingState(response, 0))
    );
  }

  updateMyExtracurricularTracking(
    request: UpdateExtracurricularTrackingRequestVm
  ): Observable<ExtracurricularTrackingStateVm> {
    return this.http.put<unknown>(this.studentTrackingUrl, this.normalizeUpdateRequest(request)).pipe(
      timeout({ first: this.requestTimeoutMs }),
      map((response) => this.normalizeTrackingState(response, 0))
    );
  }

  getTeacherStudentsExtracurricularBatchSummary(
    studentIds: readonly number[]
  ): Observable<ExtracurricularTrackingBatchSummaryItemVm[]> {
    const normalizedStudentIds = Array.from(
      new Set(
        (studentIds || [])
          .map((studentId) => this.normalizeStudentId(Number(studentId)))
          .filter((studentId) => studentId > 0)
      )
    );
    if (normalizedStudentIds.length <= 0) return of([]);

    return this.http
      .post<unknown>(`${this.teacherStudentsBaseUrl}/extracurricular-tracking/batch-summary`, {
        studentIds: normalizedStudentIds,
      })
      .pipe(
        timeout({ first: this.requestTimeoutMs }),
        map((response) => this.normalizeBatchSummaryList(response))
      );
  }

  private normalizeTrackingState(raw: unknown, fallbackStudentId: number): ExtracurricularTrackingStateVm {
    const source = this.unwrapObjectPayload(raw);
    const studentId = this.toPositiveInteger(
      this.readValue(source, ['studentId', 'student_id', 'id']),
      fallbackStudentId
    );
    const activities = this.normalizeActivityList(
      this.readValue(source, ['activities', 'activityItems', 'activity_items', 'items'])
    );
    const records = this.normalizeRecordList(raw, source, studentId, activities);
    const totalActivities = this.toNonNegativeInteger(
      this.readValue(source, ['totalActivities', 'total_activities']),
      activities.length
    );
    const competitionCount = this.toNonNegativeInteger(
      this.readValue(source, ['competitionCount', 'competition_count']),
      activities.filter((activity) => activity.activityType === 'COMPETITION').length
    );
    const awardCount = this.toNonNegativeInteger(
      this.readValue(source, ['awardCount', 'award_count']),
      activities.filter((activity) => !!activity.awardOrResult).length
    );
    return {
      studentId,
      note: this.toText(this.readValue(source, ['note', 'remark'])),
      totalActivities,
      competitionCount,
      awardCount,
      activities,
      records,
    };
  }

  private normalizeRecordList(
    raw: unknown,
    source: Record<string, unknown> | null,
    studentId: number,
    fallbackActivities: ExtracurricularActivityVm[]
  ): ExtracurricularTrackingRecordVm[] {
    const arrays: unknown[][] = [
      this.unwrapArrayPayload(this.readValue(source, ['records'])),
      this.unwrapArrayPayload(this.readValue(source, ['history'])),
      this.unwrapArrayPayload(raw),
    ];
    for (const rows of arrays) {
      if (rows.length <= 0) continue;
      return rows
        .map((row, index) => this.normalizeRecord(row, studentId, index + 1))
        .filter((row) => row.activities.length > 0 || !!row.note || !!row.updatedAt || !!row.createdAt)
        .sort((a, b) => this.toTimestamp(b.updatedAt || b.createdAt) - this.toTimestamp(a.updatedAt || a.createdAt));
    }
    const single = this.normalizeRecord(source ?? raw, studentId, 1, fallbackActivities);
    return single.activities.length > 0 || !!single.note || !!single.updatedAt || !!single.createdAt ? [single] : [];
  }

  private normalizeRecord(
    raw: unknown,
    studentId: number,
    fallbackId: number,
    fallbackActivities: ExtracurricularActivityVm[] = []
  ): ExtracurricularTrackingRecordVm {
    const source = this.unwrapObjectPayload(raw) ?? this.toRecord(raw);
    const activities = this.normalizeActivityList(
      this.readValue(source, ['activities', 'activityItems', 'activity_items', 'items'])
    );
    const effectiveActivities = activities.length > 0 ? activities : fallbackActivities;
    return {
      id: this.toPositiveInteger(this.readValue(source, ['id', 'recordId', 'record_id']), fallbackId),
      title: this.toText(this.readValue(source, ['title', 'name'])) || `课外活动记录 #${fallbackId}`,
      note: this.toText(this.readValue(source, ['note', 'remark'])),
      totalActivities: this.toNonNegativeInteger(this.readValue(source, ['totalActivities']), effectiveActivities.length),
      competitionCount: this.toNonNegativeInteger(
        this.readValue(source, ['competitionCount']),
        effectiveActivities.filter((activity) => activity.activityType === 'COMPETITION').length
      ),
      awardCount: this.toNonNegativeInteger(
        this.readValue(source, ['awardCount']),
        effectiveActivities.filter((activity) => !!activity.awardOrResult).length
      ),
      activities: effectiveActivities,
      createdAt: this.toNullableText(this.readValue(source, ['createdAt', 'created_at'])),
      updatedAt: this.toNullableText(this.readValue(source, ['updatedAt', 'updated_at'])),
      updatedByTeacherId: this.toNullablePositiveInteger(
        this.readValue(source, ['updatedByTeacherId', 'updated_by_teacher_id'])
      ),
      updatedByTeacherName:
        this.toNullableText(this.readValue(source, ['updatedByTeacherName', 'updated_by_teacher_name'])) || null,
    };
  }

  private normalizeBatchSummaryList(raw: unknown): ExtracurricularTrackingBatchSummaryItemVm[] {
    return this.unwrapArrayPayload(raw)
      .map((row) => {
        const source = this.unwrapObjectPayload(row) ?? this.toRecord(row);
        const studentId = this.toPositiveInteger(this.readValue(source, ['studentId', 'student_id', 'id']), 0);
        if (studentId <= 0) return null;
        return {
          studentId,
          totalActivities: this.toNonNegativeInteger(this.readValue(source, ['totalActivities', 'total_activities']), 0),
          competitionCount: this.toNonNegativeInteger(this.readValue(source, ['competitionCount', 'competition_count']), 0),
          awardCount: this.toNonNegativeInteger(this.readValue(source, ['awardCount', 'award_count']), 0),
          updatedAt: this.toNullableText(this.readValue(source, ['updatedAt', 'updated_at'])),
        };
      })
      .filter((row): row is ExtracurricularTrackingBatchSummaryItemVm => !!row);
  }

  private normalizeActivityList(raw: unknown): ExtracurricularActivityVm[] {
    return this.unwrapArrayPayload(raw)
      .map((row) => {
        const source = this.unwrapObjectPayload(row) ?? this.toRecord(row);
        const activityType = this.normalizeActivityType(this.readValue(source, ['activityType', 'activity_type', 'type']));
        const activity: ExtracurricularActivityVm = {
          activityType,
          activityName: this.toText(this.readValue(source, ['activityName', 'activity_name', 'name'])),
          organization: this.toText(this.readValue(source, ['organization', 'host', 'provider'])),
          role: this.toText(this.readValue(source, ['role', 'activityRole', 'activity_role'])),
          activityLevel: this.normalizeActivityLevel(this.readValue(source, ['activityLevel', 'activity_level', 'level'])),
          awardOrResult: this.toText(this.readValue(source, ['awardOrResult', 'award_or_result', 'result', 'award'])),
          competitionCategory: this.toText(
            this.readValue(source, ['competitionCategory', 'competition_category', 'category'])
          ),
          activityDate: this.toText(this.readValue(source, ['activityDate', 'activity_date', 'date'])),
          startDate: this.toText(this.readValue(source, ['startDate', 'start_date'])),
          endDate: this.toText(this.readValue(source, ['endDate', 'end_date'])),
          description: this.toText(this.readValue(source, ['description', 'desc'])),
          admissionRelevance: this.toText(
            this.readValue(source, ['admissionRelevance', 'admission_relevance', 'relevance'])
          ),
          proofContact: this.toText(this.readValue(source, ['proofContact', 'proof_contact', 'verifierContact'])),
          proofUrl: this.toText(this.readValue(source, ['proofUrl', 'proof_url', 'url'])),
        };
        return activity;
      })
      .filter((activity) => this.isActivityMeaningful(activity));
  }

  private normalizeUpdateRequest(
    payload: UpdateExtracurricularTrackingRequestVm
  ): UpdateExtracurricularTrackingRequestVm {
    return {
      note: this.toText(payload.note),
      activities: (payload.activities || [])
        .map((activity) => ({
          activityType: this.normalizeActivityType(activity.activityType),
          activityName: this.toText(activity.activityName),
          organization: this.toText(activity.organization),
          role: this.toText(activity.role),
          activityLevel: this.normalizeActivityLevel(activity.activityLevel),
          awardOrResult: this.toText(activity.awardOrResult),
          competitionCategory: this.toText(activity.competitionCategory),
          activityDate: this.toText(activity.activityDate),
          startDate: this.toText(activity.startDate),
          endDate: this.toText(activity.endDate),
          description: this.toText(activity.description),
          admissionRelevance: this.toText(activity.admissionRelevance),
          proofContact: this.toText(activity.proofContact),
          proofUrl: this.toText(activity.proofUrl),
        }))
        .filter((activity) => this.isActivityMeaningful(activity)),
    };
  }

  private isActivityMeaningful(activity: ExtracurricularActivityVm): boolean {
    return !!(
      activity.activityName ||
      activity.organization ||
      activity.awardOrResult ||
      activity.description ||
      activity.activityDate ||
      activity.startDate ||
      activity.endDate
    );
  }

  private normalizeActivityType(value: unknown): ExtracurricularActivityType {
    const normalized = this.toText(value).toUpperCase();
    if (
      normalized === 'PUBLIC_EVENT' ||
      normalized === 'SUMMER_CAMP' ||
      normalized === 'CLUB' ||
      normalized === 'RESEARCH' ||
      normalized === 'INTERNSHIP' ||
      normalized === 'CERTIFICATE' ||
      normalized === 'OTHER'
    ) {
      return normalized;
    }
    return 'COMPETITION';
  }

  private normalizeActivityLevel(value: unknown): ExtracurricularActivityLevel {
    const normalized = this.toText(value).toUpperCase();
    if (
      normalized === 'SCHOOL' ||
      normalized === 'CITY' ||
      normalized === 'PROVINCE' ||
      normalized === 'NATIONAL' ||
      normalized === 'INTERNATIONAL' ||
      normalized === 'OTHER'
    ) {
      return normalized;
    }
    return '';
  }

  private normalizeStudentId(value: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.trunc(parsed);
  }

  private toText(value: unknown): string {
    return String(value ?? '').trim();
  }

  private toNullableText(value: unknown): string | null {
    const text = this.toText(value);
    return text ? text : null;
  }

  private toPositiveInteger(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return Math.max(0, Math.trunc(fallback));
    return Math.trunc(parsed);
  }

  private toNonNegativeInteger(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return Math.max(0, Math.trunc(fallback));
    return Math.trunc(parsed);
  }

  private toNullablePositiveInteger(value: unknown): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.trunc(parsed);
  }

  private toTimestamp(value: unknown): number {
    const parsed = Date.parse(String(value ?? ''));
    return Number.isFinite(parsed) ? parsed : 0;
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
      if (Array.isArray(record['records'])) return record['records'] as unknown[];
      if (Array.isArray(record['activities'])) return record['activities'] as unknown[];
      if (!record['data']) break;
      current = record['data'];
    }
    return Array.isArray(current) ? current : [];
  }

  private unwrapObjectPayload(value: unknown): Record<string, unknown> | null {
    let current = this.toRecord(value);
    for (let depth = 0; depth < 3; depth += 1) {
      const nested = this.toRecord(current?.['data']);
      if (!nested || nested === current) break;
      current = nested;
    }
    return current;
  }

  private readValue(source: Record<string, unknown> | null, keys: readonly string[]): unknown {
    if (!source) return undefined;
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];
    }
    return undefined;
  }
}
