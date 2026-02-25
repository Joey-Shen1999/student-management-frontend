import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { AuthService } from './auth.service';

export interface StudentProfileCoursePayload {
  schoolType?: string;
  schoolName?: string;
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
  startTime?: string;
  endTime?: string;
  [key: string]: any;
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

  private resolveTeacherStudentProfileUrl(studentId: number): string {
    const normalizedStudentId = Number.isFinite(Number(studentId))
      ? Math.trunc(Number(studentId))
      : 0;
    return `${this.teacherStudentProfileBaseUrl}/${normalizedStudentId}/profile`;
  }
}
