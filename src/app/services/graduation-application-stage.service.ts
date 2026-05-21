import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, tap } from 'rxjs';

import { AuthService } from './auth.service';
import type { UniversityAspiration } from './university-aspiration.service';

export type GraduationApplicationStatus =
  | 'PREPARING'
  | 'READY_TO_SUBMIT'
  | 'SUBMITTED'
  | 'WAITING_RESULT'
  | 'OFFER_RECEIVED'
  | 'OFFER_ACCEPTED';

export interface GraduationApplication {
  id: number | string;
  studentId: number;
  universityId?: number;
  universityName: string;
  programId?: number;
  programName: string;
  facultyName?: string;
  degreeType?: string;
  status: GraduationApplicationStatus;
  sortOrder: number;
  sourceAspirationId?: number;
  createdAt?: string;
  updatedAt: string;
}

export interface GraduationApplicationRequest {
  universityId: number;
  programId: number;
  status?: GraduationApplicationStatus;
  sourceAspirationId?: number;
}

export interface GraduationApplicationReorderRequest {
  id: number;
  sortOrder: number;
}

export interface GraduationApplicationHistoryFieldChange {
  path?: string;
  label?: string;
  before?: unknown;
  after?: unknown;
}

export interface GraduationApplicationHistoryEntry {
  id?: number | string;
  studentId?: number;
  applicationId?: number;
  operation?: string;
  actorUserId?: number;
  actorRole?: string;
  actorName?: string;
  changedAt?: string;
  changedFields?: GraduationApplicationHistoryFieldChange[];
}

export interface GraduationApplicationHistoryResponse {
  items: GraduationApplicationHistoryEntry[];
  total: number;
  page: number;
  size: number;
}

export interface GraduationApplicationPortalCredential {
  studentId: number;
  universityId: number;
  universityName?: string;
  schoolAccount: string;
  schoolEmail: string;
  schoolPassword: string;
  defaultSchoolEmail?: string;
  defaultSchoolPassword?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GraduationApplicationPortalCredentialRequest {
  schoolAccount?: string;
  schoolEmail?: string;
  schoolPassword?: string;
}

export interface GraduationApplicationAccountCredential {
  studentId: number;
  applicationEmail: string;
  applicationPassword: string;
  defaultApplicationEmail?: string;
  defaultApplicationPassword?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GraduationApplicationAccountCredentialRequest {
  applicationEmail?: string;
  applicationPassword?: string;
}

@Injectable({ providedIn: 'root' })
export class GraduationApplicationStageService {
  private readonly storagePrefix = 'student-management.graduation-applications.v1';
  private readonly studentUrl = '/api/students';
  private readonly applicationUrl = '/api/graduation-applications';
  private readonly enabledCache = new Map<number, boolean>();

  constructor(
    private http?: HttpClient,
    private auth?: AuthService
  ) {}

  isStageEnabled(studentId: number | null | undefined): boolean {
    const id = this.normalizeStudentId(studentId);
    if (id <= 0) return false;
    if (this.enabledCache.has(id)) return this.enabledCache.get(id) === true;
    return this.listCachedApplications(id).length > 0;
  }

  rememberStageEnabled(studentId: number | null | undefined, enabled: boolean): void {
    const id = this.normalizeStudentId(studentId);
    if (id <= 0) return;
    this.enabledCache.set(id, enabled);
  }

  listApplications(studentId: number | null | undefined): Observable<GraduationApplication[]> {
    const id = this.normalizeStudentId(studentId);
    if (id <= 0) return of([]);
    if (!this.http) return of(this.listCachedApplications(id));

    return this.http
      .get<GraduationApplication[]>(
        `${this.studentUrl}/${id}/graduation-applications`,
        this.withAuthHeaderIfAvailable()
      )
      .pipe(tap((rows) => this.cacheApplications(id, rows || [])));
  }

  confirmStage(
    studentId: number,
    applications: GraduationApplicationRequest[]
  ): Observable<GraduationApplication[]> {
    const id = this.normalizeStudentId(studentId);
    const payload = {
      applications: applications.map((item) => ({
        universityId: Math.trunc(Number(item.universityId)),
        programId: Math.trunc(Number(item.programId)),
        status: item.status || 'PREPARING',
        sourceAspirationId: this.normalizeOptionalId(item.sourceAspirationId),
      })),
    };

    if (!this.http) {
      const fallback = payload.applications.map((item, index) => ({
        id: `student-${id}-draft-${index + 1}`,
        studentId: id,
        universityId: item.universityId,
        universityName: '',
        programId: item.programId,
        programName: '',
        status: item.status as GraduationApplicationStatus,
        sortOrder: index + 1,
        sourceAspirationId: item.sourceAspirationId,
        updatedAt: new Date().toISOString(),
      }));
      this.cacheApplications(id, fallback);
      return of(fallback);
    }

    return this.http
      .put<GraduationApplication[]>(
        `${this.studentUrl}/${id}/graduation-applications/confirm`,
        payload,
        this.withAuthHeaderIfAvailable()
      )
      .pipe(tap((rows) => this.cacheApplications(id, rows || [])));
  }

  createApplication(
    studentId: number,
    payload: GraduationApplicationRequest
  ): Observable<GraduationApplication> {
    const id = this.normalizeStudentId(studentId);
    if (!this.http) {
      const cached = this.listCachedApplications(id);
      const created: GraduationApplication = {
        id: `student-${id}-manual-${Date.now()}`,
        studentId: id,
        universityId: payload.universityId,
        universityName: '',
        programId: payload.programId,
        programName: '',
        status: payload.status || 'PREPARING',
        sortOrder: cached.length + 1,
        sourceAspirationId: payload.sourceAspirationId,
        updatedAt: new Date().toISOString(),
      };
      this.cacheApplications(id, [...cached, created]);
      return of(created);
    }

    return this.http
      .post<GraduationApplication>(
        `${this.studentUrl}/${id}/graduation-applications`,
        payload,
        this.withAuthHeaderIfAvailable()
      )
      .pipe(tap(() => this.enabledCache.set(id, true)));
  }

  updateApplication(
    applicationId: number,
    payload: GraduationApplicationRequest
  ): Observable<GraduationApplication> {
    if (!this.http) {
      return of({ ...(payload as unknown as GraduationApplication), id: applicationId, updatedAt: new Date().toISOString() });
    }
    return this.http.put<GraduationApplication>(
      `${this.applicationUrl}/${Math.trunc(applicationId)}`,
      payload,
      this.withAuthHeaderIfAvailable()
    );
  }

  deleteApplication(applicationId: number): Observable<void> {
    if (!this.http) return of(undefined);
    return this.http.delete<void>(
      `${this.applicationUrl}/${Math.trunc(applicationId)}`,
      this.withAuthHeaderIfAvailable()
    );
  }

  reorderApplications(
    studentId: number,
    payload: GraduationApplicationReorderRequest[]
  ): Observable<GraduationApplication[]> {
    const id = this.normalizeStudentId(studentId);
    if (!this.http) return of(this.listCachedApplications(id));
    return this.http
      .put<GraduationApplication[]>(
        `${this.studentUrl}/${id}/graduation-applications/reorder`,
        payload,
        this.withAuthHeaderIfAvailable()
      )
      .pipe(tap((rows) => this.cacheApplications(id, rows || [])));
  }

  listHistory(
    studentId: number | null | undefined,
    query: { page?: number; size?: number } = {}
  ): Observable<GraduationApplicationHistoryResponse> {
    const id = this.normalizeStudentId(studentId);
    const rawPage = Math.trunc(Number(query.page ?? 0));
    const rawSize = Math.trunc(Number(query.size ?? 20));
    const page = Number.isFinite(rawPage) && rawPage >= 0 ? rawPage : 0;
    const size = Number.isFinite(rawSize) && rawSize > 0 ? rawSize : 20;
    if (id <= 0 || !this.http) {
      return of({ items: [], total: 0, page, size });
    }

    const params = new HttpParams()
      .set('page', String(page))
      .set('size', String(size));

    return this.http.get<GraduationApplicationHistoryResponse>(
      `${this.studentUrl}/${id}/graduation-applications/history`,
      { ...this.withAuthHeaderIfAvailable(), params }
    );
  }

  getPortalCredential(
    studentId: number | null | undefined,
    universityId: number | null | undefined
  ): Observable<GraduationApplicationPortalCredential> {
    const student = this.normalizeStudentId(studentId);
    const university = this.normalizeOptionalId(universityId);
    if (student <= 0 || !university || !this.http) {
      return of(this.createDefaultPortalCredential(student, university || 0));
    }

    return this.http.get<GraduationApplicationPortalCredential>(
      `${this.studentUrl}/${student}/graduation-applications/universities/${university}/portal`,
      this.withAuthHeaderIfAvailable()
    );
  }

  getApplicationAccountCredential(
    studentId: number | null | undefined
  ): Observable<GraduationApplicationAccountCredential> {
    const student = this.normalizeStudentId(studentId);
    if (student <= 0 || !this.http) {
      return of(this.createDefaultApplicationAccountCredential(student));
    }

    return this.http.get<GraduationApplicationAccountCredential>(
      `${this.studentUrl}/${student}/graduation-applications/account`,
      this.withAuthHeaderIfAvailable()
    );
  }

  updateApplicationAccountCredential(
    studentId: number | null | undefined,
    payload: GraduationApplicationAccountCredentialRequest
  ): Observable<GraduationApplicationAccountCredential> {
    const student = this.normalizeStudentId(studentId);
    const normalizedPayload = {
      applicationEmail: String(payload.applicationEmail || '').trim(),
      applicationPassword: String(payload.applicationPassword || '').trim(),
    };
    if (student <= 0 || !this.http) {
      return of({
        ...this.createDefaultApplicationAccountCredential(student),
        ...normalizedPayload,
        updatedAt: new Date().toISOString(),
      });
    }

    return this.http.put<GraduationApplicationAccountCredential>(
      `${this.studentUrl}/${student}/graduation-applications/account`,
      normalizedPayload,
      this.withAuthHeaderIfAvailable()
    );
  }

  updatePortalCredential(
    studentId: number | null | undefined,
    universityId: number | null | undefined,
    payload: GraduationApplicationPortalCredentialRequest
  ): Observable<GraduationApplicationPortalCredential> {
    const student = this.normalizeStudentId(studentId);
    const university = this.normalizeOptionalId(universityId);
    const normalizedPayload = {
      schoolAccount: String(payload.schoolAccount || '').trim(),
      schoolEmail: String(payload.schoolEmail || '').trim(),
      schoolPassword: String(payload.schoolPassword || '').trim(),
    };
    if (student <= 0 || !university || !this.http) {
      return of({
        ...this.createDefaultPortalCredential(student, university || 0),
        ...normalizedPayload,
        updatedAt: new Date().toISOString(),
      });
    }

    return this.http.put<GraduationApplicationPortalCredential>(
      `${this.studentUrl}/${student}/graduation-applications/universities/${university}/portal`,
      normalizedPayload,
      this.withAuthHeaderIfAvailable()
    );
  }

  createFromAspiration(
    studentId: number,
    aspiration: UniversityAspiration,
    index: number
  ): GraduationApplication | null {
    const id = this.normalizeStudentId(studentId);
    const universityId = this.normalizeOptionalId(aspiration.universityId);
    const programId = this.normalizeOptionalId(aspiration.programId);
    const universityName = String(aspiration.universityName || '').trim();
    const programName = String(aspiration.programName || '').trim();
    if (id <= 0 || !universityId || !programId || !universityName || !programName) return null;

    const sourceAspirationId = this.normalizeOptionalId(aspiration.aspirationId ?? aspiration.id);
    return {
      id: `student-${id}-asp-${sourceAspirationId || index + 1}`,
      studentId: id,
      universityId,
      universityName,
      programId,
      programName,
      facultyName: aspiration.facultyName,
      degreeType: aspiration.degreeType,
      status: 'PREPARING',
      sortOrder: index + 1,
      sourceAspirationId,
      updatedAt: new Date().toISOString(),
    };
  }

  statusLabel(status: GraduationApplicationStatus | string | null | undefined): string {
    switch (status) {
      case 'READY_TO_SUBMIT':
        return '待提交';
      case 'SUBMITTED':
        return '已提交';
      case 'WAITING_RESULT':
        return '等待结果';
      case 'OFFER_RECEIVED':
        return '收到 Offer';
      case 'OFFER_ACCEPTED':
        return '已接收 Offer';
      case 'PREPARING':
      default:
        return '准备中';
    }
  }

  private createDefaultPortalCredential(
    studentId: number,
    universityId: number
  ): GraduationApplicationPortalCredential {
    const account = this.createDefaultApplicationAccountCredential(studentId);
    return {
      studentId,
      universityId,
      schoolAccount: '',
      schoolEmail: account.applicationEmail,
      schoolPassword: account.applicationPassword,
      defaultSchoolEmail: account.defaultApplicationEmail,
      defaultSchoolPassword: account.defaultApplicationPassword,
    };
  }

  private createDefaultApplicationAccountCredential(studentId: number): GraduationApplicationAccountCredential {
    const year = new Date().getFullYear();
    return {
      studentId,
      applicationEmail: `student${studentId || ''}vip${year}@outlook.com`,
      applicationPassword: 'ZAQ!2wsxcde3',
      defaultApplicationEmail: `student${studentId || ''}vip${year}@outlook.com`,
      defaultApplicationPassword: 'ZAQ!2wsxcde3',
    };
  }

  private cacheApplications(studentId: number, applications: GraduationApplication[]): void {
    const id = this.normalizeStudentId(studentId);
    if (id <= 0) return;
    const normalized = (applications || [])
      .map((item, index) => this.normalizeApplication(id, item, index))
      .filter((item): item is GraduationApplication => item !== null)
      .sort((left, right) => left.sortOrder - right.sortOrder);
    this.enabledCache.set(id, normalized.length > 0);
    this.writeApplications(id, normalized);
  }

  private listCachedApplications(studentId: number | null | undefined): GraduationApplication[] {
    const id = this.normalizeStudentId(studentId);
    if (id <= 0) return [];

    try {
      const storage = (globalThis as { localStorage?: Storage }).localStorage;
      if (!storage) return [];
      const raw = storage.getItem(this.resolveStorageKey(id));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item, index) => this.normalizeApplication(id, item, index))
        .filter((item): item is GraduationApplication => item !== null)
        .sort((left, right) => left.sortOrder - right.sortOrder);
    } catch {
      return [];
    }
  }

  private writeApplications(studentId: number, applications: GraduationApplication[]): void {
    try {
      const storage = (globalThis as { localStorage?: Storage }).localStorage;
      if (!storage) return;
      storage.setItem(this.resolveStorageKey(studentId), JSON.stringify(applications));
    } catch {}
  }

  private normalizeApplication(
    studentId: number,
    value: unknown,
    index: number
  ): GraduationApplication | null {
    if (!value || typeof value !== 'object') return null;
    const source = value as Record<string, unknown>;
    const universityName = String(source['universityName'] || '').trim();
    const programName = String(source['programName'] || '').trim();
    const universityId = this.normalizeOptionalId(source['universityId']);
    const programId = this.normalizeOptionalId(source['programId']);
    if (!universityName || !programName) return null;

    const id = source['id'];
    const sortOrder = Math.trunc(Number(source['sortOrder']));
    const sourceAspirationId = this.normalizeOptionalId(source['sourceAspirationId']);
    const status = String(source['status'] || 'PREPARING') as GraduationApplicationStatus;
    return {
      id: typeof id === 'number' || typeof id === 'string' ? id : `student-${studentId}-draft-${index + 1}`,
      studentId,
      universityId,
      universityName,
      programId,
      programName,
      facultyName: String(source['facultyName'] || '').trim() || undefined,
      degreeType: String(source['degreeType'] || '').trim() || undefined,
      status,
      sortOrder: Number.isFinite(sortOrder) && sortOrder > 0 ? sortOrder : index + 1,
      sourceAspirationId,
      createdAt: String(source['createdAt'] || '').trim() || undefined,
      updatedAt: String(source['updatedAt'] || '').trim(),
    };
  }

  private resolveStorageKey(studentId: number): string {
    return `${this.storagePrefix}.student-${studentId}`;
  }

  private normalizeStudentId(value: number | null | undefined): number {
    const numeric = Math.trunc(Number(value));
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
  }

  private normalizeOptionalId(value: unknown): number | undefined {
    const numeric = Math.trunc(Number(value));
    return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
  }

  private withAuthHeaderIfAvailable() {
    const authorization = this.auth?.getAuthorizationHeaderValue();
    if (!authorization) return {};
    return {
      headers: new HttpHeaders({
        Authorization: authorization,
      }),
    };
  }
}
