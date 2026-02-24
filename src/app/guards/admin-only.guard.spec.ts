import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../services/auth.service';
import { adminOnlyGuard } from './admin-only.guard';

describe('adminOnlyGuard', () => {
  const createUrlTree = vi.fn((commands: string[], extras?: unknown) => ({
    commands,
    extras,
  }));
  const getSession = vi.fn();
  const getAuthorizationHeaderValue = vi.fn();

  beforeEach(() => {
    createUrlTree.mockClear();
    getSession.mockReset();
    getAuthorizationHeaderValue.mockReset();
    getAuthorizationHeaderValue.mockReturnValue('Bearer token-1');

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { createUrlTree } },
        { provide: AuthService, useValue: { getSession, getAuthorizationHeaderValue } },
      ],
    });
  });

  function runGuard() {
    const route = {} as any;
    const state = { url: '/teacher/teachers' } as any;
    return TestBed.runInInjectionContext(() => adminOnlyGuard(route, state));
  }

  it('redirects to login when user is unauthenticated', () => {
    getSession.mockReturnValue(null);

    const result = runGuard();

    expect(createUrlTree).toHaveBeenCalledWith(['/login']);
    expect(result).toEqual({ commands: ['/login'], extras: undefined });
  });

  it('redirects to login when token is missing', () => {
    getSession.mockReturnValue({
      userId: 1,
      role: 'ADMIN',
      studentId: null,
      teacherId: null,
    });
    getAuthorizationHeaderValue.mockReturnValue(null);

    const result = runGuard();

    expect(createUrlTree).toHaveBeenCalledWith(['/login']);
    expect(result).toEqual({ commands: ['/login'], extras: undefined });
  });

  it('redirects non-admin user back to teacher dashboard', () => {
    getSession.mockReturnValue({
      userId: 10,
      role: 'TEACHER',
      studentId: null,
      teacherId: 3,
    });

    const result = runGuard();

    expect(createUrlTree).toHaveBeenCalledWith(['/teacher/dashboard']);
    expect(result).toEqual({ commands: ['/teacher/dashboard'], extras: undefined });
  });

  it('allows admin user', () => {
    getSession.mockReturnValue({
      userId: 1,
      role: 'ADMIN',
      studentId: null,
      teacherId: null,
    });

    const result = runGuard();

    expect(result).toBe(true);
  });
});
