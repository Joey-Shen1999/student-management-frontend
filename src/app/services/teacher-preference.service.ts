import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { AuthService } from './auth.service';

export interface TeacherPagePreferenceResponse {
  pageKey?: string;
  version?: string;
  visibleColumnKeys?: string[];
  orderedColumnKeys?: string[];
  updatedAt?: string;
  [key: string]: unknown;
}

export interface TeacherPagePreferenceRequest {
  version: string;
  visibleColumnKeys: string[];
  orderedColumnKeys?: string[];
}

@Injectable({ providedIn: 'root' })
export class TeacherPreferenceService {
  private readonly baseUrl = '/api/teacher/preferences';

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

  getPagePreference(pageKey: string): Observable<TeacherPagePreferenceResponse> {
    const normalizedPageKey = encodeURIComponent(String(pageKey || '').trim());
    return this.http.get<TeacherPagePreferenceResponse>(
      `${this.baseUrl}/${normalizedPageKey}`,
      this.withAuthHeaderIfAvailable()
    );
  }

  upsertPagePreference(
    pageKey: string,
    payload: TeacherPagePreferenceRequest
  ): Observable<TeacherPagePreferenceResponse> {
    const normalizedPageKey = encodeURIComponent(String(pageKey || '').trim());
    return this.http.put<TeacherPagePreferenceResponse>(
      `${this.baseUrl}/${normalizedPageKey}`,
      payload,
      this.withAuthHeaderIfAvailable()
    );
  }
}
