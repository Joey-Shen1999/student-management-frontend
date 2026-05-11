import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { AuthService } from './auth.service';

export interface ServiceProgressAdvisor {
  teacherId?: number;
  id?: number;
  username?: string;
  displayName?: string;
  status?: string;
  advisorEnabled?: boolean;
  [key: string]: any;
}

export interface ServiceProgressRecord {
  id?: number;
  studentId?: number;
  appointmentTime?: string;
  advisorId?: number;
  advisorName?: string;
  followUpContent?: string;
  nextPlan?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface ServiceProgressState {
  studentId?: number;
  studentRemark?: string;
  records?: ServiceProgressRecord[];
  [key: string]: any;
}

export interface ServiceProgressRecordRequest {
  appointmentTime: string;
  advisorId: number;
  followUpContent: string;
  nextPlan: string;
}

@Injectable({ providedIn: 'root' })
export class ServiceProgressService {
  private readonly teacherBaseUrl = '/api/teacher';

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {}

  getStudentServiceProgress(studentId: number): Observable<ServiceProgressState> {
    return this.http.get<ServiceProgressState>(
      `${this.teacherBaseUrl}/students/${Math.trunc(studentId)}/service-progress`,
      this.withAuthHeaderIfAvailable()
    );
  }

  createRecord(studentId: number, payload: ServiceProgressRecordRequest): Observable<ServiceProgressRecord> {
    return this.http.post<ServiceProgressRecord>(
      `${this.teacherBaseUrl}/students/${Math.trunc(studentId)}/service-progress`,
      payload,
      this.withAuthHeaderIfAvailable()
    );
  }

  updateRecord(recordId: number, payload: ServiceProgressRecordRequest): Observable<ServiceProgressRecord> {
    return this.http.put<ServiceProgressRecord>(
      `${this.teacherBaseUrl}/service-progress/${Math.trunc(recordId)}`,
      payload,
      this.withAuthHeaderIfAvailable()
    );
  }

  deleteRecord(recordId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.teacherBaseUrl}/service-progress/${Math.trunc(recordId)}`,
      this.withAuthHeaderIfAvailable()
    );
  }

  updateStudentRemark(studentId: number, studentRemark: string): Observable<ServiceProgressState> {
    return this.http.put<ServiceProgressState>(
      `${this.teacherBaseUrl}/students/${Math.trunc(studentId)}/remark`,
      { studentRemark },
      this.withAuthHeaderIfAvailable()
    );
  }

  listAdvisors(): Observable<ServiceProgressAdvisor[] | { data?: ServiceProgressAdvisor[]; items?: ServiceProgressAdvisor[] }> {
    return this.http.get<ServiceProgressAdvisor[] | { data?: ServiceProgressAdvisor[]; items?: ServiceProgressAdvisor[] }>(
      `${this.teacherBaseUrl}/accounts/advisors`,
      this.withAuthHeaderIfAvailable()
    );
  }

  private withAuthHeaderIfAvailable() {
    const authorization = this.auth.getAuthorizationHeaderValue();
    if (!authorization) return {};
    return {
      headers: new HttpHeaders({
        Authorization: authorization,
      }),
    };
  }
}
