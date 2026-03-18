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

  createInvite(): Observable<CreateStudentInviteResponse> {
    return this.http.post<CreateStudentInviteResponse>(
      this.baseUrl,
      {},
      this.withAuthHeaderIfAvailable()
    );
  }
}
