import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { StudentInviteService } from './student-invite.service';

describe('StudentInviteService', () => {
  let service: StudentInviteService;
  let httpMock: HttpTestingController;
  const sessionKey = 'sm_session';

  beforeEach(() => {
    localStorage.removeItem(sessionKey);
    TestBed.configureTestingModule({
      providers: [StudentInviteService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(StudentInviteService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    localStorage.removeItem(sessionKey);
    httpMock.verify();
  });

  it('createInvite should call POST /api/teacher/student-invites', () => {
    service.createInvite().subscribe();

    const req = httpMock.expectOne('/api/teacher/student-invites');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ inviteToken: 'invite-abc' });
  });

  it('createInvite should include teacherId when provided', () => {
    service.createInvite(88).subscribe();

    const req = httpMock.expectOne('/api/teacher/student-invites');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ teacherId: 88 });
    req.flush({ inviteToken: 'invite-abc' });
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

    service.createInvite().subscribe();

    const req = httpMock.expectOne('/api/teacher/student-invites');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-abc');
    req.flush({ inviteToken: 'invite-abc' });
  });
});
