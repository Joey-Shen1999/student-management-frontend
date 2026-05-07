import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { AuthService } from './auth.service';

export interface University {
  id: number;
  name: string;
  province?: string;
  city?: string;
  country?: string;
  website?: string;
  [key: string]: any;
}

export interface UniversityProgram {
  id: number;
  universityId?: number;
  programName: string;
  facultyName?: string;
  degreeType?: string;
  [key: string]: any;
}

export interface UniversityAspiration {
  id?: number;
  aspirationId?: number;
  studentId?: number;
  universityId?: number;
  universityName?: string;
  programId?: number;
  programName?: string;
  facultyName?: string;
  degreeType?: string;
  notes?: string;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface UniversityAspirationRequest {
  universityId: number;
  programId: number;
  notes?: string;
}

export interface UniversityAspirationReorderRequest {
  id: number;
  sortOrder: number;
}

@Injectable({ providedIn: 'root' })
export class UniversityAspirationService {
  private readonly universityUrl = '/api/universities';
  private readonly aspirationStudentUrl = '/api/students';
  private readonly aspirationUrl = '/api/university-aspirations';

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {}

  listUniversities(): Observable<University[]> {
    return this.http.get<University[]>(this.universityUrl, this.withAuthHeaderIfAvailable());
  }

  listPrograms(universityId: number): Observable<UniversityProgram[]> {
    return this.http.get<UniversityProgram[]>(
      `${this.universityUrl}/${Math.trunc(universityId)}/programs`,
      this.withAuthHeaderIfAvailable()
    );
  }

  listAspirations(studentId: number): Observable<UniversityAspiration[]> {
    return this.http.get<UniversityAspiration[]>(
      `${this.aspirationStudentUrl}/${Math.trunc(studentId)}/university-aspirations`,
      this.withAuthHeaderIfAvailable()
    );
  }

  createAspiration(
    studentId: number,
    payload: UniversityAspirationRequest
  ): Observable<UniversityAspiration> {
    return this.http.post<UniversityAspiration>(
      `${this.aspirationStudentUrl}/${Math.trunc(studentId)}/university-aspirations`,
      payload,
      this.withAuthHeaderIfAvailable()
    );
  }

  updateAspiration(
    aspirationId: number,
    payload: UniversityAspirationRequest
  ): Observable<UniversityAspiration> {
    return this.http.put<UniversityAspiration>(
      `${this.aspirationUrl}/${Math.trunc(aspirationId)}`,
      payload,
      this.withAuthHeaderIfAvailable()
    );
  }

  deleteAspiration(aspirationId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.aspirationUrl}/${Math.trunc(aspirationId)}`,
      this.withAuthHeaderIfAvailable()
    );
  }

  reorderAspirations(
    studentId: number,
    payload: UniversityAspirationReorderRequest[]
  ): Observable<UniversityAspiration[]> {
    return this.http.put<UniversityAspiration[]>(
      `${this.aspirationStudentUrl}/${Math.trunc(studentId)}/university-aspirations/reorder`,
      payload,
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
