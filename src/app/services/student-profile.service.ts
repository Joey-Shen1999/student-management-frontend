import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { AuthService } from './auth.service';

export interface StudentProfileCoursePayload {
  schoolType?: string;
  schoolName?: string;
  address?: StudentProfileAddressPayload;
  streetAddress?: string;
  city?: string;
  state?: string;
  country?: string;
  postal?: string;
  courseCode?: string;
  mark?: number | null;
  gradeLevel?: number | null;
  startTime?: string;
  endTime?: string;
  [key: string]: any;
}

export interface StudentProfileSchoolPayload {
  schoolType?: string;
  schoolName?: string;
  address?: StudentProfileAddressPayload;
  streetAddress?: string;
  city?: string;
  state?: string;
  country?: string;
  postal?: string;
  startTime?: string;
  endTime?: string;
  [key: string]: any;
}

export interface CanadianHighSchoolLookupItem {
  name: string;
  streetAddress: string;
  city: string;
  state: string;
  country: string;
  postal: string;
  displayAddress: string;
  lookupKey: string;
  boardName?: string;
  schoolSpecialConditions?: string;
}

export interface StudentProfileAddressPayload {
  streetAddress?: string;
  streetAddressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  postal?: string;
  [key: string]: any;
}

export interface StudentProfilePayload {
  legalFirstName?: string;
  legalLastName?: string;
  preferredName?: string;
  gender?: string;
  birthday?: string;
  phone?: string;
  email?: string;
  statusInCanada?: string;
  citizenship?: string;
  firstLanguage?: string;
  firstBoardingDate?: string;
  firstEntryDateInCanada?: string;
  firstEntryDate?: string;
  firstArrivalDateInCanada?: string;
  address?: StudentProfileAddressPayload;
  oenNumber?: string;
  ib?: string;
  ap?: boolean;
  identityFileNote?: string;
  schools?: StudentProfileSchoolPayload[];
  schoolRecords?: StudentProfileSchoolPayload[];
  otherCourses?: StudentProfileCoursePayload[];
  externalCourses?: StudentProfileCoursePayload[];
  [key: string]: any;
}

export interface StudentProfileResponse {
  profile?: StudentProfilePayload;
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class StudentProfileService {
  private readonly selfProfileUrl = '/api/student/profile';
  private readonly teacherStudentProfileBaseUrl = '/api/teacher/students';
  private readonly canadianHighSchoolSearchUrl = '/api/reference/canadian-high-schools/search';
  private readonly ontarioCourseProviderSearchUrl = '/api/reference/ontario-course-providers/search';

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

  getMyProfile(): Observable<StudentProfilePayload | StudentProfileResponse> {
    return this.http.get<StudentProfilePayload | StudentProfileResponse>(
      this.selfProfileUrl,
      this.withAuthHeaderIfAvailable()
    );
  }

  saveMyProfile(
    payload: StudentProfilePayload
  ): Observable<StudentProfilePayload | StudentProfileResponse> {
    return this.http.put<StudentProfilePayload | StudentProfileResponse>(
      this.selfProfileUrl,
      payload,
      this.withAuthHeaderIfAvailable()
    );
  }

  getStudentProfileForTeacher(
    studentId: number
  ): Observable<StudentProfilePayload | StudentProfileResponse> {
    return this.http.get<StudentProfilePayload | StudentProfileResponse>(
      this.resolveTeacherStudentProfileUrl(studentId),
      this.withAuthHeaderIfAvailable()
    );
  }

  saveStudentProfileForTeacher(
    studentId: number,
    payload: StudentProfilePayload
  ): Observable<StudentProfilePayload | StudentProfileResponse> {
    return this.http.put<StudentProfilePayload | StudentProfileResponse>(
      this.resolveTeacherStudentProfileUrl(studentId),
      payload,
      this.withAuthHeaderIfAvailable()
    );
  }

  searchCanadianHighSchools(query: string): Observable<CanadianHighSchoolLookupItem[]> {
    const text = String(query ?? '').trim();
    if (text.length < 2) {
      return of([]);
    }

    return this.searchCanadianHighSchoolsFromBackend(text).pipe(catchError(() => of([])));
  }

  searchOntarioCourseProviders(query: string): Observable<CanadianHighSchoolLookupItem[]> {
    const text = String(query ?? '').trim();
    if (text.length < 2) {
      return of([]);
    }

    const params = new HttpParams()
      .set('q', text)
      .set('limit', '15')
      .set('country', 'Canada');

    return this.http
      .get<any>(this.ontarioCourseProviderSearchUrl, {
        params,
        ...this.withAuthHeaderIfAvailable(),
      })
      .pipe(
        map((resp) => this.mapBackendSchoolResults(resp)),
        catchError(() => of([]))
      );
  }

  private searchCanadianHighSchoolsFromBackend(query: string): Observable<CanadianHighSchoolLookupItem[]> {
    const params = new HttpParams()
      .set('q', query)
      .set('limit', '15')
      .set('country', 'Canada');

    return this.http
      .get<any>(this.canadianHighSchoolSearchUrl, {
        params,
        ...this.withAuthHeaderIfAvailable(),
      })
      .pipe(
        map((resp) => this.mapBackendSchoolResults(resp)),
        catchError(() => of([]))
      );
  }

  private mapBackendSchoolResults(payload: any): CanadianHighSchoolLookupItem[] {
    const rows: any[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.results)
          ? payload.results
          : [];

    const mapped = rows
      .map((row) => this.mapBackendSchoolResult(row))
      .filter((item): item is CanadianHighSchoolLookupItem => item !== null);

    const seen = new Set<string>();
    const deduped: CanadianHighSchoolLookupItem[] = [];
    for (const item of mapped) {
      const key = `${item.name.toLowerCase()}|${item.streetAddress.toLowerCase()}|${item.postal.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }

    return deduped;
  }

  private mapBackendSchoolResult(row: any): CanadianHighSchoolLookupItem | null {
    if (!row || typeof row !== 'object') return null;

    const address = row.address && typeof row.address === 'object' ? row.address : {};

    const name = String(row.name || row.schoolName || '').trim();
    if (!name) return null;

    const streetAddress = String(
      row.streetAddress || address.streetAddress || address.street || ''
    ).trim();
    const city = String(row.city || address.city || '').trim();
    const state = String(row.state || row.province || address.state || address.province || '').trim();
    const country = String(row.country || address.country || 'Canada').trim() || 'Canada';
    const postal = String(row.postal || row.postalCode || address.postal || address.postalCode || '').trim();
    const displayAddress = String(
      row.displayAddress ||
        [streetAddress, city, state, postal, country].filter(Boolean).join(', ')
    ).trim();
    const lookupKey = String(row.id || row.lookupKey || row.code || `${name}|${streetAddress}|${postal}`).trim();
    const boardName = String(row.boardName || row.board || '').trim();
    const schoolSpecialConditions = String(
      row.schoolSpecialConditions || row.specialCondition || row.specialConditions || ''
    ).trim();

    return {
      name,
      streetAddress,
      city,
      state,
      country,
      postal,
      displayAddress,
      lookupKey,
      boardName,
      schoolSpecialConditions,
    };
  }

  private resolveTeacherStudentProfileUrl(studentId: number): string {
    const normalizedStudentId = Number.isFinite(Number(studentId))
      ? Math.trunc(Number(studentId))
      : 0;
    return `${this.teacherStudentProfileBaseUrl}/${normalizedStudentId}/profile`;
  }
}

