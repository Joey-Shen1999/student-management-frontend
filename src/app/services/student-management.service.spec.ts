import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { StudentManagementService } from './student-management.service';

describe('StudentManagementService', () => {
  let service: StudentManagementService;
  let httpMock: HttpTestingController;
  const sessionKey = 'sm_session';

  beforeEach(() => {
    localStorage.removeItem(sessionKey);
    TestBed.configureTestingModule({
      providers: [StudentManagementService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(StudentManagementService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    localStorage.removeItem(sessionKey);
    httpMock.verify();
  });

  it('listStudents should call GET /api/teacher/student-accounts', () => {
    service.listStudents().subscribe();

    const req = httpMock.expectOne('/api/teacher/student-accounts');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('resetStudentPassword should call POST /api/teacher/student-accounts/{id}/reset-password', () => {
    service.resetStudentPassword(12).subscribe();

    const req = httpMock.expectOne('/api/teacher/student-accounts/12/reset-password');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ username: 'student12', tempPassword: 'A1b2C3d4' });
  });

  it('updateStudentStatus should call PATCH /api/teacher/student-accounts/{id}/status', () => {
    service.updateStudentStatus(12, 'ARCHIVED').subscribe();

    const req = httpMock.expectOne('/api/teacher/student-accounts/12/status');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'ARCHIVED' });
    req.flush({ studentId: 12, username: 'student12', status: 'ARCHIVED' });
  });

  it('should attach Authorization header when session exists', () => {
    localStorage.setItem(
      sessionKey,
      JSON.stringify({
        userId: 1,
        role: 'TEACHER',
        studentId: null,
        teacherId: 2,
        accessToken: 'token-abc',
        tokenType: 'Bearer',
        tokenExpiresAt: '2026-02-24T12:17:26.239',
        mustChangePassword: false,
      })
    );

    service.updateStudentStatus(12, 'ACTIVE').subscribe();

    const req = httpMock.expectOne('/api/teacher/student-accounts/12/status');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-abc');
    req.flush({ studentId: 12, username: 'student12', status: 'ACTIVE' });
  });
});
