import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { AuthService } from './auth.service';

export interface CreateTeacherInviteRequest {
  username: string;
}

export interface CreateTeacherInviteResponse {
  username: string;
  tempPassword: string;
}

@Injectable({ providedIn: 'root' })
export class TeacherInviteService {
  private readonly baseUrl = '/api/teacher/invites';

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {}

  createInvite(username: string): Observable<CreateTeacherInviteResponse> {
    const payload: CreateTeacherInviteRequest = { username };
    return this.http.post<CreateTeacherInviteResponse>(this.baseUrl, payload, {
      headers: this.buildManagementHeaders(),
    });
  }

  private buildManagementHeaders(): HttpHeaders {
    const userId = this.auth.getCurrentUserId();
    return userId ? new HttpHeaders({ 'X-User-Id': String(userId) }) : new HttpHeaders();
  }
}
