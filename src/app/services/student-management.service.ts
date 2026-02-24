import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { AuthService } from './auth.service';

export interface StudentAccount {
  studentId?: number;
  userId?: number;
  id?: number;
  username: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  status?: 'ACTIVE' | 'ARCHIVED' | string;
  createdAt?: string;
  [key: string]: any;
}

export interface ResetStudentPasswordResponse {
  studentId?: number;
  username?: string;
  tempPassword: string;
  message?: string;
  [key: string]: any;
}

export type StudentAccountStatus = 'ACTIVE' | 'ARCHIVED';

export interface UpdateStudentStatusResponse {
  studentId?: number;
  username?: string;
  status?: StudentAccountStatus | string;
  archived?: boolean;
  active?: boolean;
  enabled?: boolean;
  message?: string;
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class StudentManagementService {
  private readonly baseUrl = '/api/teacher/student-accounts';

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

  listStudents(): Observable<StudentAccount[] | { items?: StudentAccount[]; data?: StudentAccount[] }> {
    return this.http.get<StudentAccount[] | { items?: StudentAccount[]; data?: StudentAccount[] }>(
      this.baseUrl,
      this.withAuthHeaderIfAvailable()
    );
  }

  resetStudentPassword(studentId: number): Observable<ResetStudentPasswordResponse> {
    return this.http.post<ResetStudentPasswordResponse>(
      `${this.baseUrl}/${studentId}/reset-password`,
      {},
      this.withAuthHeaderIfAvailable()
    );
  }

  updateStudentStatus(
    studentId: number,
    status: StudentAccountStatus
  ): Observable<UpdateStudentStatusResponse> {
    const normalizedStatus = String(status || '').toUpperCase() as StudentAccountStatus;
    return this.http.patch<UpdateStudentStatusResponse>(
      `${this.baseUrl}/${studentId}/status`,
      { status: normalizedStatus },
      this.withAuthHeaderIfAvailable()
    );
  }
}
