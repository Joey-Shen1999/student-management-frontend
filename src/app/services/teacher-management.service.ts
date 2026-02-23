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

export interface UpdateTeacherRoleResponse {
  teacherId?: number;
  username?: string;
  role?: TeacherRole | string;
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

  listTeachers(): Observable<TeacherAccount[] | { items?: TeacherAccount[]; data?: TeacherAccount[] }> {
    return this.http.get<TeacherAccount[] | { items?: TeacherAccount[]; data?: TeacherAccount[] }>(
      this.baseUrl,
      { headers: this.buildManagementHeaders() }
    );
  }

  resetTeacherPassword(teacherId: number): Observable<ResetTeacherPasswordResponse> {
    return this.http.post<ResetTeacherPasswordResponse>(
      `${this.baseUrl}/${teacherId}/reset-password`,
      {},
      { headers: this.buildManagementHeaders() }
    );
  }

  updateTeacherRole(teacherId: number, role: TeacherRole): Observable<UpdateTeacherRoleResponse> {
    return this.http.patch<UpdateTeacherRoleResponse>(
      `${this.baseUrl}/${teacherId}/role`,
      { role },
      { headers: this.buildManagementHeaders() }
    );
  }

  private buildManagementHeaders(): HttpHeaders {
    const userId = this.auth.getCurrentUserId();
    return userId ? new HttpHeaders({ 'X-User-Id': String(userId) }) : new HttpHeaders();
  }
}
