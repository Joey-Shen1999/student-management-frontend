import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { TeacherManagementService } from './teacher-management.service';

describe('TeacherManagementService', () => {
  let service: TeacherManagementService;
  let httpMock: HttpTestingController;
  const sessionKey = 'sm_session';

  beforeEach(() => {
    localStorage.removeItem(sessionKey);
    TestBed.configureTestingModule({
      providers: [TeacherManagementService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(TeacherManagementService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    localStorage.removeItem(sessionKey);
    httpMock.verify();
  });

  it('listTeachers should call GET /api/teacher/accounts', () => {
    service.listTeachers().subscribe();

    const req = httpMock.expectOne('/api/teacher/accounts');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('resetTeacherPassword should call POST /api/teacher/accounts/{id}/reset-password', () => {
    service.resetTeacherPassword(12).subscribe();

    const req = httpMock.expectOne('/api/teacher/accounts/12/reset-password');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ username: 'teacher12', tempPassword: 'A1b2C3d4' });
  });

  it('updateTeacherRole should call PATCH /api/teacher/accounts/{id}/role', () => {
    service.updateTeacherRole(12, 'ADMIN').subscribe();

    const req = httpMock.expectOne('/api/teacher/accounts/12/role');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ role: 'ADMIN' });
    req.flush({ teacherId: 12, username: 'teacher12', role: 'ADMIN' });
  });

  it('should attach Authorization header when session exists', () => {
    localStorage.setItem(
      sessionKey,
      JSON.stringify({
        userId: 1,
        role: 'ADMIN',
        studentId: null,
        teacherId: null,
        accessToken: 'token-abc',
        tokenType: 'Bearer',
        tokenExpiresAt: '2026-02-24T12:17:26.239',
        mustChangePassword: false,
      })
    );

    service.updateTeacherRole(12, 'TEACHER').subscribe();

    const req = httpMock.expectOne('/api/teacher/accounts/12/role');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-abc');
    req.flush({ teacherId: 12, username: 'teacher12', role: 'TEACHER' });
  });
});
