import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { StudentProfileService } from './student-profile.service';

describe('StudentProfileService', () => {
  let service: StudentProfileService;
  let httpMock: HttpTestingController;
  const sessionKey = 'sm_session';

  beforeEach(() => {
    localStorage.removeItem(sessionKey);
    TestBed.configureTestingModule({
      providers: [StudentProfileService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(StudentProfileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    localStorage.removeItem(sessionKey);
    httpMock.verify();
  });

  it('getMyProfile should call GET /api/student/profile', () => {
    service.getMyProfile().subscribe();

    const req = httpMock.expectOne('/api/student/profile');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('saveMyProfile should call PUT /api/student/profile', () => {
    service
      .saveMyProfile({
        phone: '(111) 222-3333',
      })
      .subscribe();

    const req = httpMock.expectOne('/api/student/profile');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      phone: '(111) 222-3333',
    });
    req.flush({});
  });

  it('getStudentProfileForTeacher should call GET /api/teacher/students/{id}/profile', () => {
    service.getStudentProfileForTeacher(12).subscribe();

    const req = httpMock.expectOne('/api/teacher/students/12/profile');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('saveStudentProfileForTeacher should call PUT /api/teacher/students/{id}/profile', () => {
    service
      .saveStudentProfileForTeacher(12, {
        phone: '(111) 222-3333',
      })
      .subscribe();

    const req = httpMock.expectOne('/api/teacher/students/12/profile');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      phone: '(111) 222-3333',
    });
    req.flush({});
  });

  it('should attach Authorization header when session exists', () => {
    localStorage.setItem(
      sessionKey,
      JSON.stringify({
        userId: 9,
        role: 'STUDENT',
        studentId: 1001,
        teacherId: null,
        accessToken: 'token-xyz',
        tokenType: 'Bearer',
        tokenExpiresAt: '2026-02-25T12:00:00.000',
        mustChangePassword: false,
      })
    );

    service.getMyProfile().subscribe();

    const req = httpMock.expectOne('/api/student/profile');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-xyz');
    req.flush({});
  });
});
