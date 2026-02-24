import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpHandlerFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../services/auth.service';
import { mustChangePasswordInterceptor } from './must-change-password.interceptor';

describe('mustChangePasswordInterceptor', () => {
  const navigate = vi.fn();
  const clearAuthState = vi.fn();
  const markMustChangePasswordRequired = vi.fn();
  const getCurrentUserId = vi.fn();
  const getAuthorizationHeaderValue = vi.fn();

  beforeEach(() => {
    navigate.mockReset();
    navigate.mockResolvedValue(true);

    clearAuthState.mockReset();
    markMustChangePasswordRequired.mockReset();
    getCurrentUserId.mockReset();
    getAuthorizationHeaderValue.mockReset();

    getCurrentUserId.mockReturnValue(15);
    getAuthorizationHeaderValue.mockReturnValue('Bearer token-15');

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate } },
        {
          provide: AuthService,
          useValue: {
            clearAuthState,
            markMustChangePasswordRequired,
            getCurrentUserId,
            getAuthorizationHeaderValue,
          },
        },
      ],
    });
  });

  function run(url: string, next: HttpHandlerFn) {
    const req = new HttpRequest('GET', url);
    return TestBed.runInInjectionContext(() => mustChangePasswordInterceptor(req, next));
  }

  it('injects Authorization header for protected APIs', async () => {
    let captured: any = null;
    const next: HttpHandlerFn = (req) => {
      captured = req;
      return of(new HttpResponse({ status: 200, body: {} }));
    };

    await firstValueFrom(run('/api/teacher/accounts', next));

    expect(captured).toBeTruthy();
    if (!captured) {
      throw new Error('Expected request to be captured.');
    }
    expect(captured.headers.get('Authorization')).toBe('Bearer token-15');
  });

  it('injects Authorization header for absolute protected API URLs', async () => {
    let captured: any = null;
    const next: HttpHandlerFn = (req) => {
      captured = req;
      return of(new HttpResponse({ status: 200, body: {} }));
    };

    await firstValueFrom(run('http://localhost:4200/api/teacher/accounts/2/role', next));

    expect(captured).toBeTruthy();
    if (!captured) {
      throw new Error('Expected request to be captured.');
    }
    expect(captured.headers.get('Authorization')).toBe('Bearer token-15');
  });

  it('does not inject Authorization header for login endpoint', async () => {
    let captured: any = null;
    const next: HttpHandlerFn = (req) => {
      captured = req;
      return of(new HttpResponse({ status: 200, body: {} }));
    };

    await firstValueFrom(run('/api/auth/login', next));

    expect(captured).toBeTruthy();
    if (!captured) {
      throw new Error('Expected request to be captured.');
    }
    expect(captured.headers.has('Authorization')).toBe(false);
  });

  it('does not inject Authorization header for absolute login endpoint', async () => {
    let captured: any = null;
    const next: HttpHandlerFn = (req) => {
      captured = req;
      return of(new HttpResponse({ status: 200, body: {} }));
    };

    await firstValueFrom(run('http://localhost:4200/api/auth/login', next));

    expect(captured).toBeTruthy();
    if (!captured) {
      throw new Error('Expected request to be captured.');
    }
    expect(captured.headers.has('Authorization')).toBe(false);
  });

  it('clears auth state and redirects to login on 401', async () => {
    const error = new HttpErrorResponse({
      status: 401,
      error: { code: 'UNAUTHORIZED', message: 'Unauthenticated.' },
    });
    const next: HttpHandlerFn = () => throwError(() => error);

    await expect(firstValueFrom(run('/api/teacher/accounts', next))).rejects.toBeDefined();

    expect(clearAuthState).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('redirects to change-password on 403 MUST_CHANGE_PASSWORD_REQUIRED', async () => {
    const error = new HttpErrorResponse({
      status: 403,
      error: { code: 'MUST_CHANGE_PASSWORD_REQUIRED', message: 'must change password' },
    });
    const next: HttpHandlerFn = () => throwError(() => error);

    await expect(firstValueFrom(run('/api/auth/change-password', next))).rejects.toBeDefined();

    expect(markMustChangePasswordRequired).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/teacher/change-password'], {
      queryParams: { userId: 15 },
    });
  });
});
