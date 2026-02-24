import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CreateTeacherInviteRequest {
  username: string;
  displayName?: string;
}

export interface CreateTeacherInviteResponse {
  username: string;
  tempPassword: string;
}

@Injectable({ providedIn: 'root' })
export class TeacherInviteService {
  private readonly baseUrl = '/api/teacher/invites';

  constructor(private http: HttpClient) {}

  createInvite(username: string, displayName?: string): Observable<CreateTeacherInviteResponse> {
    const normalizedDisplayName = (displayName || '').trim();
    const payload: CreateTeacherInviteRequest = normalizedDisplayName
      ? { username, displayName: normalizedDisplayName }
      : { username };
    return this.http.post<CreateTeacherInviteResponse>(this.baseUrl, payload);
  }
}
