import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { AuthService } from './auth.service';

export interface TeacherAccount {
  teacherId?: number;
  userId?: number;
  id?: number;
  username: string;
  role?: 'TEACHER' | 'ADMIN' | string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface ResetTeacherPasswordResponse {
  teacherId?: number;
  username?: string;
  tempPassword: string;
  message?: string;
  [key: string]: any;
}

export type TeacherRole = 'TEACHER' | 'ADMIN';
export type TeacherAccountStatus = 'ACTIVE' | 'ARCHIVED';

export interface UpdateTeacherRoleResponse {
  teacherId?: number;
  username?: string;
  role?: TeacherRole | string;
  message?: string;
  [key: string]: any;
}

export interface UpdateTeacherStatusResponse {
  teacherId?: number;
  username?: string;
  status?: TeacherAccountStatus | string;
  archived?: boolean;
  active?: boolean;
  enabled?: boolean;
  message?: string;
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class TeacherManagementService {
  private readonly baseUrl = '/api/teacher/accounts';

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {}

  private withAuthHeaderIfAvailable() {
    const authorization = this.auth.getAuthorizationHeaderValue();
    if (!authorization) {
      return {};
    }

    return {
      headers: new HttpHeaders({
        Authorization: authorization,
      }),
    };
  }

  listTeachers(): Observable<TeacherAccount[] | { items?: TeacherAccount[]; data?: TeacherAccount[] }> {
    return this.http.get<TeacherAccount[] | { items?: TeacherAccount[]; data?: TeacherAccount[] }>(
      this.baseUrl,
      this.withAuthHeaderIfAvailable()
    );
  }

  resetTeacherPassword(teacherId: number): Observable<ResetTeacherPasswordResponse> {
    return this.http.post<ResetTeacherPasswordResponse>(
      `${this.baseUrl}/${teacherId}/reset-password`,
      {},
      this.withAuthHeaderIfAvailable()
    );
  }

  updateTeacherRole(teacherId: number, role: TeacherRole): Observable<UpdateTeacherRoleResponse> {
    const normalizedRole = String(role || '').toUpperCase() as TeacherRole;
    return this.http.patch<UpdateTeacherRoleResponse>(
      `${this.baseUrl}/${teacherId}/role`,
      { role: normalizedRole },
      this.withAuthHeaderIfAvailable()
    );
  }

  updateTeacherStatus(
    teacherId: number,
    status: TeacherAccountStatus
  ): Observable<UpdateTeacherStatusResponse> {
    const normalizedStatus = String(status || '').toUpperCase() as TeacherAccountStatus;
    return this.http.patch<UpdateTeacherStatusResponse>(
      `${this.baseUrl}/${teacherId}/status`,
      { status: normalizedStatus },
      this.withAuthHeaderIfAvailable()
    );
  }
}
