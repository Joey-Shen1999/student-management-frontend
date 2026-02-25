import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AuthService, LoginResponse } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [AuthService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('login should call API and persist session to localStorage', () => {
    const response: LoginResponse = {
      userId: 10,
      role: 'TEACHER',
      username: 'teacher01',
      studentId: null,
      teacherId: 20,
      mustChangePassword: true,
      accessToken: 'token-123',
      tokenType: 'Bearer',
      tokenExpiresAt: '2026-02-24T23:10:00.123',
    };

    let received: LoginResponse | undefined;

    service.login({ username: 'teacher01', password: 'Aa1!goodPass' }).subscribe((res) => {
      received = res;
    });

    const req = httpMock.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ username: 'teacher01', password: 'Aa1!goodPass' });
    req.flush(response);

    expect(received).toEqual(response);
    expect(service.getSession()).toEqual(response);
  });

  it('setPassword should POST to set-password endpoint', () => {
    service.setPassword({ userId: 99, newPassword: 'Abcdef1!' }).subscribe();

    const req = httpMock.expectOne('/api/auth/set-password');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId: 99, newPassword: 'Abcdef1!' });
    req.flush({ success: true, message: 'ok' });
  });

  it('getStudentInvitePreview should call GET /api/auth/student-invites/{token}', () => {
    service.getStudentInvitePreview('invite-abc').subscribe();

    const req = httpMock.expectOne('/api/auth/student-invites/invite-abc');
    expect(req.request.method).toBe('GET');
    req.flush({ inviteToken: 'invite-abc', valid: true });
  });

  it('changePassword should POST oldPassword/newPassword to change-password endpoint', () => {
    service.changePassword({ oldPassword: 'OldPass!1', newPassword: 'NewPass!2' }).subscribe();

    const req = httpMock.expectOne('/api/auth/change-password');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ oldPassword: 'OldPass!1', newPassword: 'NewPass!2' });
    req.flush({ success: true, message: 'ok' });
  });

  it('logout should call API and clear local session on success', () => {
    localStorage.setItem(
      'sm_session',
      JSON.stringify({
        userId: 1,
        role: 'ADMIN',
        studentId: null,
        teacherId: null,
        accessToken: 'token-logout',
        tokenType: 'Bearer',
        tokenExpiresAt: '2026-02-24T23:10:00.123',
      })
    );

    service.logout().subscribe();

    const req = httpMock.expectOne('/api/auth/logout');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ success: true, message: 'Logged out.' });

    expect(service.getSession()).toBeNull();
  });

  it('logout should treat 401 as local logout success and clear local session', () => {
    localStorage.setItem(
      'sm_session',
      JSON.stringify({
        userId: 1,
        role: 'ADMIN',
        studentId: null,
        teacherId: null,
        accessToken: 'token-logout',
        tokenType: 'Bearer',
        tokenExpiresAt: '2026-02-24T23:10:00.123',
      })
    );

    let received: any;
    let error: any;
    service.logout().subscribe({
      next: (resp) => {
        received = resp;
      },
      error: (err) => {
        error = err;
      },
    });

    const req = httpMock.expectOne('/api/auth/logout');
    expect(req.request.method).toBe('POST');
    req.flush(
      { status: 401, message: 'Unauthenticated', code: 'UNAUTHORIZED', details: [] },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(error).toBeUndefined();
    expect(received).toEqual({ success: true, message: 'Logged out.' });
    expect(service.getSession()).toBeNull();
  });

  it('clearMustChangePasswordFlag should set mustChangePassword to false in session', () => {
    const initial: LoginResponse = {
      userId: 5,
      role: 'TEACHER',
      studentId: null,
      teacherId: 8,
      mustChangePassword: true,
      accessToken: 'token-1',
      tokenType: 'Bearer',
      tokenExpiresAt: '2026-02-24T23:10:00.123',
    };
    localStorage.setItem('sm_session', JSON.stringify(initial));

    service.clearMustChangePasswordFlag();

    const updated = service.getSession();
    expect(updated?.mustChangePassword).toBe(false);
  });

  it('markMustChangePasswordRequired should set mustChangePassword to true in session', () => {
    const initial: LoginResponse = {
      userId: 6,
      role: 'ADMIN',
      studentId: null,
      teacherId: null,
      mustChangePassword: false,
      accessToken: 'token-2',
      tokenType: 'Bearer',
      tokenExpiresAt: '2026-02-24T23:10:00.123',
    };
    localStorage.setItem('sm_session', JSON.stringify(initial));

    service.markMustChangePasswordRequired();

    const updated = service.getSession();
    expect(updated?.mustChangePassword).toBe(true);
  });

  it('mustChangePassword should reflect current session state', () => {
    expect(service.mustChangePassword()).toBe(false);

    localStorage.setItem(
      'sm_session',
      JSON.stringify({
        userId: 1,
        role: 'TEACHER',
        studentId: null,
        teacherId: 2,
        mustChangePassword: true,
        accessToken: 'token-3',
        tokenType: 'Bearer',
        tokenExpiresAt: '2026-02-24T23:10:00.123',
      })
    );

    expect(service.mustChangePassword()).toBe(true);
  });

  it('getCurrentUserId should return valid user id from session', () => {
    expect(service.getCurrentUserId()).toBeNull();

    localStorage.setItem(
      'sm_session',
      JSON.stringify({
        userId: 123,
        role: 'ADMIN',
        studentId: null,
        teacherId: null,
        accessToken: 'token-4',
        tokenType: 'Bearer',
        tokenExpiresAt: '2026-02-24T23:10:00.123',
      })
    );

    expect(service.getCurrentUserId()).toBe(123);
  });

  it('getAuthorizationHeaderValue should return Bearer token from session', () => {
    localStorage.setItem(
      'sm_session',
      JSON.stringify({
        userId: 123,
        role: 'ADMIN',
        studentId: null,
        teacherId: null,
        accessToken: 'token-abc',
        tokenType: 'Bearer',
        tokenExpiresAt: '2026-02-24T23:10:00.123',
      })
    );

    expect(service.getAuthorizationHeaderValue()).toBe('Bearer token-abc');
  });
});
