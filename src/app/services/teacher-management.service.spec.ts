import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';

import { AuthService } from './auth.service';
import { TeacherManagementService } from './teacher-management.service';

describe('TeacherManagementService', () => {
  let service: TeacherManagementService;
  let httpMock: HttpTestingController;
  const getCurrentUserId = vi.fn();

  beforeEach(() => {
    getCurrentUserId.mockReset();
    getCurrentUserId.mockReturnValue(9001);

    TestBed.configureTestingModule({
      providers: [
        TeacherManagementService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { getCurrentUserId } },
      ],
    });

    service = TestBed.inject(TeacherManagementService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('listTeachers should call GET /api/teacher/accounts', () => {
    service.listTeachers().subscribe();

    const req = httpMock.expectOne('/api/teacher/accounts');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('X-User-Id')).toBe('9001');
    req.flush([]);
  });

  it('resetTeacherPassword should call POST /api/teacher/accounts/{id}/reset-password', () => {
    service.resetTeacherPassword(12).subscribe();

    const req = httpMock.expectOne('/api/teacher/accounts/12/reset-password');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('X-User-Id')).toBe('9001');
    expect(req.request.body).toEqual({});
    req.flush({ username: 'teacher12', tempPassword: 'A1b2C3d4' });
  });
});
