import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { AuthService } from './auth.service';

export interface CreateStudentInviteResponse {
  inviteId?: number;
  inviteToken?: string;
  inviteUrl?: string;
  registrationUrl?: string;
  expiresAt?: string;
  status?: string;
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class StudentInviteService {
  private readonly baseUrl = '/api/teacher/student-invites';

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

  createInvite(teacherId?: number): Observable<CreateStudentInviteResponse> {
    const normalizedTeacherId =
      typeof teacherId === 'number' && Number.isFinite(teacherId) && teacherId > 0
        ? Math.trunc(teacherId)
        : null;
    const payload = normalizedTeacherId ? { teacherId: normalizedTeacherId } : {};

    return this.http.post<CreateStudentInviteResponse>(
      this.baseUrl,
      payload,
      this.withAuthHeaderIfAvailable()
    );
  }
}
