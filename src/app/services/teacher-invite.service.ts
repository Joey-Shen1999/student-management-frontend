import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CreateTeacherInviteRequest {
  username: string;
}

export interface CreateTeacherInviteResponse {
  username: string;
  tempPassword: string;
}

@Injectable({ providedIn: 'root' })
export class TeacherInviteService {
  private readonly baseUrl = 'http://localhost:8080/api/teacher/invites';

  constructor(private http: HttpClient) {}

  // ✅ 只保留 Observable，彻底避免 toPromise 的不稳定/废弃行为
  createInvite(username: string): Observable<CreateTeacherInviteResponse> {
    const payload: CreateTeacherInviteRequest = { username };
    return this.http.post<CreateTeacherInviteResponse>(this.baseUrl, payload);
  }
}
