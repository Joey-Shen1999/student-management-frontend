import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, timeout } from 'rxjs';

export type CoursePlanStatus = 'COMPLETED' | 'IN_PROGRESS' | 'PLANNED';
export type CoursePlanYearStructure = 'FULL_YEAR' | 'SEMESTER';
export type CoursePlanSemester = 'S1' | 'S2' | null;

export interface CoursePlanCoursePayload {
  id: string;
  courseCode: string;
  status: CoursePlanStatus;
  mark: number | null;
  semester: CoursePlanSemester;
  sortOrder: number;
}

export interface CoursePlanGradePayload {
  gradeLevel: number;
  yearStructure: CoursePlanYearStructure;
  courses: CoursePlanCoursePayload[];
}

export interface CoursePlanPayload {
  currentGradeLevel: number | null;
  grade13Enabled: boolean;
  grades: CoursePlanGradePayload[];
}

@Injectable({ providedIn: 'root' })
export class CoursePlanService {
  private readonly studentCoursePlanUrl = '/api/student/course-plan';
  private readonly teacherStudentsBaseUrl = '/api/teacher/students';
  private readonly requestTimeoutMs = 12000;

  constructor(private http: HttpClient) {}

  getStudentCoursePlan(): Observable<CoursePlanPayload> {
    return this.http.get<CoursePlanPayload>(this.studentCoursePlanUrl).pipe(
      timeout({ first: this.requestTimeoutMs })
    );
  }

  saveStudentCoursePlan(payload: CoursePlanPayload): Observable<CoursePlanPayload> {
    return this.http.put<CoursePlanPayload>(this.studentCoursePlanUrl, payload).pipe(
      timeout({ first: this.requestTimeoutMs })
    );
  }

  getTeacherStudentCoursePlan(studentId: number): Observable<CoursePlanPayload> {
    const normalizedStudentId = this.normalizeStudentId(studentId);
    return this.http
      .get<CoursePlanPayload>(`${this.teacherStudentsBaseUrl}/${normalizedStudentId}/course-plan`)
      .pipe(timeout({ first: this.requestTimeoutMs }));
  }

  saveTeacherStudentCoursePlan(
    studentId: number,
    payload: CoursePlanPayload
  ): Observable<CoursePlanPayload> {
    const normalizedStudentId = this.normalizeStudentId(studentId);
    return this.http
      .put<CoursePlanPayload>(
        `${this.teacherStudentsBaseUrl}/${normalizedStudentId}/course-plan`,
        payload
      )
      .pipe(timeout({ first: this.requestTimeoutMs }));
  }

  private normalizeStudentId(studentId: number): number {
    const parsed = Number(studentId);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0;
    }
    return Math.trunc(parsed);
  }
}
