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

  it('clearMustChangePasswordFlag should set mustChangePassword to false in session', () => {
    const initial: LoginResponse = {
      userId: 5,
      role: 'TEACHER',
      studentId: null,
      teacherId: 8,
      mustChangePassword: true,
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
      })
    );

    expect(service.getCurrentUserId()).toBe(123);
  });
});
