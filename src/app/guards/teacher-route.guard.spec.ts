import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../services/auth.service';
import { teacherRouteGuard } from './teacher-route.guard';

describe('teacherRouteGuard', () => {
  const createUrlTree = vi.fn((commands: string[], extras?: unknown) => ({
    commands,
    extras,
  }));
  const getSession = vi.fn();

  beforeEach(() => {
    createUrlTree.mockClear();
    getSession.mockReset();

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { createUrlTree } },
        { provide: AuthService, useValue: { getSession } },
      ],
    });
  });

  function runGuard(path: string, url: string) {
    const childRoute = { routeConfig: { path } } as any;
    const state = { url } as any;

    return TestBed.runInInjectionContext(() => teacherRouteGuard(childRoute, state));
  }

  it('redirects to login when there is no session', () => {
    getSession.mockReturnValue(null);

    const result = runGuard('dashboard', '/teacher/dashboard');

    expect(createUrlTree).toHaveBeenCalledWith(['/login']);
    expect(result).toEqual({ commands: ['/login'], extras: undefined });
  });

  it('redirects to change-password when mustChangePassword is true', () => {
    getSession.mockReturnValue({
      userId: 12,
      role: 'TEACHER',
      mustChangePassword: true,
      studentId: null,
      teacherId: 3,
    });

    const result = runGuard('dashboard', '/teacher/dashboard');

    expect(createUrlTree).toHaveBeenCalledWith(['/teacher/change-password'], {
      queryParams: { userId: 12 },
    });
    expect(result).toEqual({
      commands: ['/teacher/change-password'],
      extras: { queryParams: { userId: 12 } },
    });
  });

  it('allows access to change-password route while mustChangePassword is true', () => {
    getSession.mockReturnValue({
      userId: 12,
      role: 'TEACHER',
      mustChangePassword: true,
      studentId: null,
      teacherId: 3,
    });

    const result = runGuard('change-password', '/teacher/change-password');

    expect(result).toBe(true);
  });

  it('allows dashboard when mustChangePassword is false', () => {
    getSession.mockReturnValue({
      userId: 12,
      role: 'TEACHER',
      mustChangePassword: false,
      studentId: null,
      teacherId: 3,
    });

    const result = runGuard('dashboard', '/teacher/dashboard');

    expect(result).toBe(true);
  });

  it('allows admin user into teacher module', () => {
    getSession.mockReturnValue({
      userId: 99,
      role: 'ADMIN',
      mustChangePassword: false,
      studentId: null,
      teacherId: null,
    });

    const result = runGuard('teachers', '/teacher/teachers');

    expect(result).toBe(true);
  });
});
