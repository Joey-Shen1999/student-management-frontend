import { ChangeDetectorRef } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../services/auth.service';
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let auth: Pick<AuthService, 'login'>;
  let router: Pick<Router, 'navigate'>;
  let cdr: Pick<ChangeDetectorRef, 'detectChanges'>;

  beforeEach(() => {
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

  it('should reject when username or password is empty', () => {
    component.username = ' ';
    component.password = '';

    component.onSubmit();

    expect(component.error).toBe('Username and password are required.');
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

    expect(component.error).toBe('This account has been archived. Please contact an admin to enable it.');
  });
});
