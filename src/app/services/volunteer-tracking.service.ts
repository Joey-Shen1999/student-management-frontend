import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, of, timeout } from 'rxjs';

export interface VolunteerTrackingTaskVm {
  taskName: string;
  description: string;
  durationHours: number;
  startDate: string;
  endDate: string;
  verifierContact: string;
}

export interface VolunteerTrackingRecordVm {
  id: number;
  title: string;
  note: string;
  totalHours: number;
  tasks: VolunteerTrackingTaskVm[];
  createdAt: string | null;
  updatedAt: string | null;
  updatedByTeacherId: number | null;
  updatedByTeacherName: string | null;
}

export interface VolunteerTrackingStateVm {
  studentId: number;
  records: VolunteerTrackingRecordVm[];
}

export interface UpdateVolunteerTrackingRequestVm {
  note: string;
  totalHours: number;
  tasks: VolunteerTrackingTaskVm[];
}

export interface VolunteerTrackingBatchSummaryItemVm {
  studentId: number;
  totalVolunteerHours: number;
  volunteerCompleted: boolean;
  updatedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class VolunteerTrackingService {
  private readonly teacherStudentsBaseUrl = '/api/teacher/students';
  private readonly studentVolunteerTrackingUrl = '/api/student/volunteer-tracking';
  private readonly requestTimeoutMs = 12000;

  constructor(private http: HttpClient) {}

  getTeacherStudentVolunteerTracking(studentId: number): Observable<VolunteerTrackingStateVm> {
    const normalizedStudentId = this.normalizeStudentId(studentId);
    return this.http
      .get<unknown>(`${this.teacherStudentsBaseUrl}/${normalizedStudentId}/volunteer-tracking`)
      .pipe(
        timeout({ first: this.requestTimeoutMs }),
        map((response) => this.normalizeTrackingState(response, normalizedStudentId))
      );
  }

  updateTeacherStudentVolunteerTracking(
    studentId: number,
    request: UpdateVolunteerTrackingRequestVm
  ): Observable<VolunteerTrackingStateVm> {
    const normalizedStudentId = this.normalizeStudentId(studentId);
    const normalizedRequest = this.normalizeUpdateRequest(request);
    return this.http
      .put<unknown>(
        `${this.teacherStudentsBaseUrl}/${normalizedStudentId}/volunteer-tracking`,
        normalizedRequest
      )
      .pipe(
        timeout({ first: this.requestTimeoutMs }),
        map((response) => this.normalizeTrackingState(response, normalizedStudentId))
      );
  }

  getMyVolunteerTracking(): Observable<VolunteerTrackingStateVm> {
    return this.http.get<unknown>(this.studentVolunteerTrackingUrl).pipe(
      timeout({ first: this.requestTimeoutMs }),
      map((response) => this.normalizeTrackingState(response, 0))
    );
  }

  getTeacherStudentsVolunteerBatchSummary(
    studentIds: readonly number[]
  ): Observable<VolunteerTrackingBatchSummaryItemVm[]> {
    const normalizedStudentIds = Array.from(
      new Set(
        (studentIds || [])
          .map((studentId) => this.normalizeStudentId(Number(studentId)))
          .filter((studentId) => studentId > 0)
      )
    );

    if (normalizedStudentIds.length <= 0) {
      return of([]);
    }

    return this.http
      .post<unknown>(`${this.teacherStudentsBaseUrl}/volunteer-tracking/batch-summary`, {
        studentIds: normalizedStudentIds,
      })
      .pipe(
        timeout({ first: this.requestTimeoutMs }),
        map((response) => this.normalizeBatchSummaryList(response))
      );
  }

  private normalizeTrackingState(raw: unknown, fallbackStudentId: number): VolunteerTrackingStateVm {
    const source = this.unwrapObjectPayload(raw);
    const studentId = this.toPositiveInteger(
      this.readValue(source, ['studentId', 'student_id', 'id']),
      fallbackStudentId
    );
    const records = this.normalizeRecordList(raw, source, studentId);

    return {
      studentId,
      records,
    };
  }

  private normalizeRecordList(
    raw: unknown,
    source: Record<string, unknown> | null,
    studentId: number
  ): VolunteerTrackingRecordVm[] {
    const arrays: unknown[][] = [
      this.unwrapArrayPayload(this.readValue(source, ['records'])),
      this.unwrapArrayPayload(this.readValue(source, ['items'])),
      this.unwrapArrayPayload(this.readValue(source, ['history'])),
      this.unwrapArrayPayload(raw),
    ];

    for (const rows of arrays) {
      if (rows.length <= 0) continue;
      return rows
        .map((row, index) => this.normalizeRecord(row, studentId, index + 1))
        .filter((row) => this.isRecordMeaningful(row))
        .sort((a, b) => this.toTimestamp(b.updatedAt || b.createdAt) - this.toTimestamp(a.updatedAt || a.createdAt));
    }

    const single = this.normalizeRecord(source ?? raw, studentId, 1);
    return this.isRecordMeaningful(single) ? [single] : [];
  }

  private normalizeBatchSummaryList(raw: unknown): VolunteerTrackingBatchSummaryItemVm[] {
    const rows = this.unwrapArrayPayload(raw);
    if (rows.length <= 0) return [];

    const seen = new Set<number>();
    const summaries: VolunteerTrackingBatchSummaryItemVm[] = [];
    for (const row of rows) {
      const summary = this.normalizeBatchSummaryItem(row);
      if (!summary) continue;
      if (seen.has(summary.studentId)) continue;
      seen.add(summary.studentId);
      summaries.push(summary);
    }
    return summaries;
  }

  private normalizeBatchSummaryItem(raw: unknown): VolunteerTrackingBatchSummaryItemVm | null {
    const source = this.unwrapObjectPayload(raw) ?? this.toRecord(raw);
    if (!source) return null;

    const studentId = this.toPositiveInteger(
      this.readValue(source, ['studentId', 'student_id', 'id']),
      0
    );
    if (studentId <= 0) return null;

    const totalVolunteerHours = this.round2(
      this.toPositiveNumber(
        this.readValue(source, [
          'totalVolunteerHours',
          'total_volunteer_hours',
          'totalHours',
          'total_hours',
          'hours',
        ]),
        0
      )
    );
    const volunteerCompleted = this.toBoolean(
      this.readValue(source, ['volunteerCompleted', 'volunteer_completed', 'completed']),
      totalVolunteerHours >= 40
    );

    return {
      studentId,
      totalVolunteerHours,
      volunteerCompleted,
      updatedAt: this.toNullableText(this.readValue(source, ['updatedAt', 'updated_at'])),
    };
  }

  private normalizeRecord(
    raw: unknown,
    studentId: number,
    fallbackId: number
  ): VolunteerTrackingRecordVm {
    const source = this.unwrapObjectPayload(raw) ?? this.toRecord(raw);
    const tasks = this.normalizeTaskList(
      this.readValue(source, ['tasks', 'taskItems', 'task_items', 'items'])
    );
    const totalHoursFromField = this.toPositiveNumber(
      this.readValue(source, ['totalHours', 'total_hours', 'totalDurationHours']),
      0
    );
    const totalHoursFromTasks = this.round2(tasks.reduce((sum, row) => sum + row.durationHours, 0));
    const totalHours = totalHoursFromField > 0 ? totalHoursFromField : totalHoursFromTasks;

    return {
      id: this.toPositiveInteger(
        this.readValue(source, ['id', 'recordId', 'record_id', 'versionId', 'version_id']),
        fallbackId
      ),
      title: this.toText(this.readValue(source, ['title', 'name'])) || `义工记录 #${fallbackId}`,
      note: this.toText(this.readValue(source, ['note', 'remark', 'contentNote', 'content_note'])),
      totalHours,
      tasks,
      createdAt: this.toNullableText(this.readValue(source, ['createdAt', 'created_at'])),
      updatedAt: this.toNullableText(this.readValue(source, ['updatedAt', 'updated_at'])),
      updatedByTeacherId: this.toNullablePositiveInteger(
        this.readValue(source, [
          'updatedByTeacherId',
          'updated_by_teacher_id',
          'publishedByTeacherId',
          'published_by_teacher_id',
        ])
      ),
      updatedByTeacherName:
        this.toNullableText(
          this.readValue(source, [
            'updatedByTeacherName',
            'updated_by_teacher_name',
            'publishedByTeacherName',
            'published_by_teacher_name',
          ])
        ) || null,
    };
  }

  private normalizeTaskList(raw: unknown): VolunteerTrackingTaskVm[] {
    const rows = this.unwrapArrayPayload(raw);
    return rows
      .map((row) => {
        const source = this.unwrapObjectPayload(row) ?? this.toRecord(row);
        const task: VolunteerTrackingTaskVm = {
          taskName: this.toText(this.readValue(source, ['taskName', 'task_name', 'name'])),
          description: this.toText(this.readValue(source, ['description', 'desc'])),
          durationHours: this.round2(
            this.toPositiveNumber(this.readValue(source, ['durationHours', 'duration_hours', 'hours']), 0)
          ),
          startDate: this.toText(this.readValue(source, ['startDate', 'start_date'])),
          endDate: this.toText(this.readValue(source, ['endDate', 'end_date'])),
          verifierContact: this.toText(
            this.readValue(source, ['verifierContact', 'verifier_contact', 'proofContact', 'proof_contact'])
          ),
        };
        return task;
      })
      .filter((row) => this.isTaskMeaningful(row));
  }

  private normalizeUpdateRequest(
    payload: UpdateVolunteerTrackingRequestVm
  ): UpdateVolunteerTrackingRequestVm {
    const tasks = (payload.tasks || [])
      .map((task) => ({
        taskName: this.toText(task.taskName),
        description: this.toText(task.description),
        durationHours: this.round2(this.toPositiveNumber(task.durationHours, 0)),
        startDate: this.toText(task.startDate),
        endDate: this.toText(task.endDate),
        verifierContact: this.toText(task.verifierContact),
      }))
      .filter((task) => this.isTaskMeaningful(task));
    const totalHours = this.round2(tasks.reduce((sum, task) => sum + task.durationHours, 0));

    return {
      note: this.toText(payload.note),
      totalHours,
      tasks,
    };
  }

  private isRecordMeaningful(record: VolunteerTrackingRecordVm): boolean {
    return (
      record.tasks.length > 0 ||
      record.totalHours > 0 ||
      !!record.note ||
      !!record.updatedAt ||
      !!record.createdAt
    );
  }

  private isTaskMeaningful(task: VolunteerTrackingTaskVm): boolean {
    return (
      !!task.taskName ||
      !!task.description ||
      task.durationHours > 0 ||
      !!task.startDate ||
      !!task.endDate ||
      !!task.verifierContact
    );
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

  private toNullablePositiveInteger(value: unknown): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.trunc(parsed);
  }

  private toPositiveNumber(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
  }

  private toBoolean(value: unknown, fallback = false): boolean {
    if (typeof value === 'boolean') return value;

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return fallback;
      return value > 0;
    }

    const normalized = this.toText(value).toLowerCase();
    if (!normalized) return fallback;
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
    return fallback;
  }

  private round2(value: number): number {
    return Math.round(Number(value || 0) * 100) / 100;
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
      if (Array.isArray(record['history'])) return record['history'] as unknown[];
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
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        return source[key];
      }
    }
    return undefined;
  }
}
