import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../services/auth.service';
import { mustChangePasswordInterceptor } from './must-change-password.interceptor';

describe('mustChangePasswordInterceptor', () => {
  const navigate = vi.fn();
  const markMustChangePasswordRequired = vi.fn();
  const getCurrentUserId = vi.fn();

  beforeEach(() => {
    navigate.mockReset();
    navigate.mockResolvedValue(true);

    markMustChangePasswordRequired.mockReset();
    getCurrentUserId.mockReset();
    getCurrentUserId.mockReturnValue(15);

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate } },
        {
          provide: AuthService,
          useValue: { markMustChangePasswordRequired, getCurrentUserId },
        },
      ],
    });
  });

  function run(url: string, error: HttpErrorResponse) {
    const req = new HttpRequest('GET', url);
    const next: HttpHandlerFn = () => throwError(() => error);
    return TestBed.runInInjectionContext(() => mustChangePasswordInterceptor(req, next));
  }

  it('redirects to change-password for teacher-management API 403 MUST_CHANGE_PASSWORD_REQUIRED', async () => {
    const error = new HttpErrorResponse({
      status: 403,
      error: { code: 'MUST_CHANGE_PASSWORD_REQUIRED', message: 'must change password' },
    });

    await expect(firstValueFrom(run('/api/teacher/accounts', error))).rejects.toBeDefined();

    expect(markMustChangePasswordRequired).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/teacher/change-password'], {
      queryParams: { userId: 15 },
    });
  });

  it('does not redirect for non-teacher API even with MUST_CHANGE_PASSWORD_REQUIRED', async () => {
    const error = new HttpErrorResponse({
      status: 403,
      error: { code: 'MUST_CHANGE_PASSWORD_REQUIRED', message: 'must change password' },
    });

    await expect(firstValueFrom(run('/api/auth/login', error))).rejects.toBeDefined();

    expect(markMustChangePasswordRequired).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not redirect for other 403 errors', async () => {
    const error = new HttpErrorResponse({
      status: 403,
      error: { code: 'FORBIDDEN', message: 'forbidden' },
    });

    await expect(firstValueFrom(run('/api/teacher/accounts', error))).rejects.toBeDefined();

    expect(markMustChangePasswordRequired).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
