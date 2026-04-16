import '@angular/compiler';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Login } from './login';
import { AuthService } from '../../services/auth.service';

const cookieStore = new Map<string, string>();
const originalDocument = globalThis.document;

const documentMock = {};
Object.defineProperty(documentMock, 'cookie', {
  configurable: true,
  get() {
    return Array.from(cookieStore.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  },
  set(value: string) {
    const segments = String(value || '')
      .split(';')
      .map((segment) => segment.trim())
      .filter(Boolean);
    const pair = segments[0] || '';
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex <= 0) {
      return;
    }

    const name = pair.slice(0, separatorIndex);
    const cookieValue = pair.slice(separatorIndex + 1);
    const expires = segments.find((segment) => segment.toLowerCase().startsWith('expires='));
    const expired = expires?.toLowerCase().includes('1970') || cookieValue === '';

    if (expired) {
      cookieStore.delete(name);
      return;
    }

    cookieStore.set(name, cookieValue);
  },
});

function getCookie(name: string): string {
  const target = `${name}=`;
  const cookies = String(document.cookie || '').split(';');

  for (const rawCookie of cookies) {
    const cookie = rawCookie.trim();
    if (!cookie.startsWith(target)) {
      continue;
    }

    return decodeURIComponent(cookie.slice(target.length));
  }

  return '';
}

function clearCookie(name: string): void {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

describe('Login', () => {
  let component: Login;
  let auth: Pick<AuthService, 'login'>;
  let router: Pick<Router, 'navigate'>;
  let cdr: Pick<ChangeDetectorRef, 'detectChanges'>;

  beforeAll(() => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: documentMock,
    });
  });

  beforeEach(() => {
    cookieStore.clear();
    clearCookie('sm_remember_username');
    clearCookie('sm_remember_password');

    auth = {
      login: vi.fn(),
    };

    router = {
      navigate: vi.fn(),
    };

    cdr = {
      detectChanges: vi.fn(),
    };

    component = new Login(auth as AuthService, router as Router, cdr as ChangeDetectorRef);
  });

  afterEach(() => {
    cookieStore.clear();
    clearCookie('sm_remember_username');
    clearCookie('sm_remember_password');
  });

  afterAll(() => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: originalDocument,
    });
  });

  it('should enable remember options by default', () => {
    expect(component.rememberUsername).toBe(true);
    expect(component.rememberPassword).toBe(true);
  });

  it('should load remembered username from cookie', () => {
    document.cookie = 'sm_remember_username=teacher01; path=/';

    component.ngOnInit();

    expect(component.username).toBe('teacher01');
    expect(component.rememberUsername).toBe(true);
  });

  it('should load remembered password from cookie', () => {
    document.cookie = 'sm_remember_password=Aa1!goodPass; path=/';

    component.ngOnInit();

    expect(component.password).toBe('Aa1!goodPass');
    expect(component.rememberPassword).toBe(true);
  });

  it('should reject when username or password is empty', () => {
    component.username = ' ';
    component.password = '';

    component.onSubmit();

    expect(component.error).toEqual(component.ui.emptyCredentials);
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('should navigate to change password when mustChangePassword is true', () => {
    (auth.login as any).mockReturnValue(
      of({
        userId: 7,
        role: 'TEACHER',
        studentId: null,
        teacherId: 2,
        mustChangePassword: true,
      })
    );

    component.username = 'teacher1';
    component.password = 'Aa1!goodPass';
    component.onSubmit();

    expect(router.navigate).toHaveBeenCalledWith(['/change-password'], {
      queryParams: { userId: 7 },
    });
  });

  it('should prioritize mustChangePassword over requiresProfileCompletion for student', () => {
    (auth.login as any).mockReturnValue(
      of({
        userId: 71,
        role: 'STUDENT',
        studentId: 201,
        teacherId: null,
        mustChangePassword: true,
        requiresProfileCompletion: true,
      })
    );

    component.username = 'student201';
    component.password = 'Aa1!goodPass';
    component.onSubmit();

    expect(router.navigate).toHaveBeenCalledWith(['/change-password'], {
      queryParams: { userId: 71 },
    });
  });

  it('should remember username cookie after successful login when rememberUsername is true', () => {
    (auth.login as any).mockReturnValue(
      of({
        userId: 7,
        role: 'STUDENT',
        studentId: 100,
        teacherId: null,
        mustChangePassword: false,
      })
    );

    component.username = 'student001';
    component.password = 'Aa1!goodPass';
    component.rememberUsername = true;

    component.onSubmit();

    expect(getCookie('sm_remember_username')).toBe('student001');
  });

  it('should clear remembered username cookie when rememberUsername is false', () => {
    document.cookie = 'sm_remember_username=student001; path=/';

    (auth.login as any).mockReturnValue(
      of({
        userId: 7,
        role: 'STUDENT',
        studentId: 100,
        teacherId: null,
        mustChangePassword: false,
      })
    );

    component.username = 'student001';
    component.password = 'Aa1!goodPass';
    component.rememberUsername = false;

    component.onSubmit();

    expect(getCookie('sm_remember_username')).toBe('');
  });

  it('should remember password cookie after successful login when rememberPassword is true', () => {
    (auth.login as any).mockReturnValue(
      of({
        userId: 7,
        role: 'STUDENT',
        studentId: 100,
        teacherId: null,
        mustChangePassword: false,
      })
    );

    component.username = 'student001';
    component.password = 'Aa1!goodPass';
    component.rememberPassword = true;

    component.onSubmit();

    expect(getCookie('sm_remember_password')).toBe('Aa1!goodPass');
  });

  it('should clear remembered password cookie when rememberPassword is false', () => {
    document.cookie = 'sm_remember_password=Aa1!goodPass; path=/';

    (auth.login as any).mockReturnValue(
      of({
        userId: 7,
        role: 'STUDENT',
        studentId: 100,
        teacherId: null,
        mustChangePassword: false,
      })
    );

    component.username = 'student001';
    component.password = 'Aa1!goodPass';
    component.rememberPassword = false;

    component.onSubmit();

    expect(getCookie('sm_remember_password')).toBe('');
  });

  it('should navigate teacher user to teacher dashboard', () => {
    (auth.login as any).mockReturnValue(
      of({
        userId: 8,
        role: 'TEACHER',
        studentId: null,
        teacherId: 2,
        mustChangePassword: false,
      })
    );

    component.username = 'teacher1';
    component.password = 'Aa1!goodPass';
    component.onSubmit();

    expect(router.navigate).toHaveBeenCalledWith(['/teacher/dashboard']);
  });

  it('should navigate admin user to teacher dashboard', () => {
    (auth.login as any).mockReturnValue(
      of({
        userId: 9,
        role: 'ADMIN',
        studentId: null,
        teacherId: null,
        mustChangePassword: false,
      })
    );

    component.username = 'admin1';
    component.password = 'Aa1!goodPass';
    component.onSubmit();

    expect(router.navigate).toHaveBeenCalledWith(['/teacher/dashboard']);
  });

  it('should navigate first-login student to profile onboarding', () => {
    (auth.login as any).mockReturnValue(
      of({
        userId: 10,
        role: 'STUDENT',
        studentId: 101,
        teacherId: null,
        mustChangePassword: false,
        firstLogin: true,
      })
    );

    component.username = 'student101';
    component.password = 'Aa1!goodPass';
    component.onSubmit();

    expect(router.navigate).toHaveBeenCalledWith(['/student/profile'], {
      queryParams: { onboarding: '1' },
    });
  });

  it('should navigate student to profile onboarding when requiresProfileCompletion is true', () => {
    (auth.login as any).mockReturnValue(
      of({
        userId: 111,
        role: 'STUDENT',
        studentId: 202,
        teacherId: null,
        mustChangePassword: false,
        requiresProfileCompletion: true,
      })
    );

    component.username = 'student202';
    component.password = 'Aa1!goodPass';
    component.onSubmit();

    expect(router.navigate).toHaveBeenCalledWith(['/student/profile'], {
      queryParams: { onboarding: '1' },
    });
  });

  it('should navigate student to profile onboarding when profileCompleted is false', () => {
    (auth.login as any).mockReturnValue(
      of({
        userId: 11,
        role: 'STUDENT',
        studentId: 102,
        teacherId: null,
        mustChangePassword: false,
        profileCompleted: false,
      })
    );

    component.username = 'student102';
    component.password = 'Aa1!goodPass';
    component.onSubmit();

    expect(router.navigate).toHaveBeenCalledWith(['/student/profile'], {
      queryParams: { onboarding: '1' },
    });
  });

  it('should navigate normal student to dashboard', () => {
    (auth.login as any).mockReturnValue(
      of({
        userId: 12,
        role: 'STUDENT',
        studentId: 103,
        teacherId: null,
        mustChangePassword: false,
      })
    );

    component.username = 'student103';
    component.password = 'Aa1!goodPass';
    component.onSubmit();

    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should use requiresProfileCompletion as source of truth when explicitly false', () => {
    (auth.login as any).mockReturnValue(
      of({
        userId: 13,
        role: 'STUDENT',
        studentId: 104,
        teacherId: null,
        mustChangePassword: false,
        requiresProfileCompletion: false,
        profileCompleted: false,
      })
    );

    component.username = 'student104';
    component.password = 'Aa1!goodPass';
    component.onSubmit();

    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should show backend error message when login fails', () => {
    (auth.login as any).mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            error: { message: 'Invalid username or password' },
          })
      )
    );

    component.username = 'user1';
    component.password = 'wrong';
    component.onSubmit();

    expect(component.error).toBe('Invalid username or password');
  });

  it('should show archived-account message when backend returns ACCOUNT_ARCHIVED', () => {
    (auth.login as any).mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 403,
            error: { code: 'ACCOUNT_ARCHIVED', message: 'Teacher account archived' },
          })
      )
    );

    component.username = 'teacher1';
    component.password = 'Aa1!goodPass';
    component.onSubmit();

    expect(component.error).toEqual(component.ui.archivedAccount);
  });
});
