import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';

import { AuthService } from './auth.service';
import { TeacherInviteService } from './teacher-invite.service';

describe('TeacherInviteService', () => {
  let service: TeacherInviteService;
  let httpMock: HttpTestingController;
  const getCurrentUserId = vi.fn();

  beforeEach(() => {
    getCurrentUserId.mockReset();
    getCurrentUserId.mockReturnValue(9001);

    TestBed.configureTestingModule({
      providers: [
        TeacherInviteService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { getCurrentUserId } },
      ],
    });

    service = TestBed.inject(TeacherInviteService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('createInvite should post to /api/teacher/invites with X-User-Id header', () => {
    service.createInvite('teacher_new').subscribe();

    const req = httpMock.expectOne('/api/teacher/invites');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ username: 'teacher_new' });
    expect(req.request.headers.get('X-User-Id')).toBe('9001');
    req.flush({ username: 'teacher_new', tempPassword: 'A1b2C3d!' });
  });
});
