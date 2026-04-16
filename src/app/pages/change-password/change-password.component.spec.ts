import '@angular/compiler';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../services/auth.service';
import { ChangePasswordComponent } from './change-password.component';

describe('ChangePasswordComponent', () => {
  let auth: Pick<
    AuthService,
    | 'getSession'
    | 'setPassword'
    | 'changePassword'
    | 'clearMustChangePasswordFlag'
    | 'getAuthorizationHeaderValue'
    | 'mustChangePassword'
  >;
  let router: Pick<Router, 'navigate'>;

  function createComponent(mode: 'set' | 'change'): ChangePasswordComponent {
    const route = {
      snapshot: {
        data: {
          passwordMode: mode,
        },
      },
    } as unknown as ActivatedRoute;

    return new ChangePasswordComponent(auth as AuthService, router as Router, route);
  }

  beforeEach(() => {
    vi.useFakeTimers();

    auth = {
      getSession: vi.fn().mockReturnValue({ userId: 1, username: 'alice', role: 'TEACHER' }),
      setPassword: vi.fn(),
      changePassword: vi.fn(),
      clearMustChangePasswordFlag: vi.fn(),
      getAuthorizationHeaderValue: vi.fn().mockReturnValue('Bearer token-1'),
      mustChangePassword: vi.fn().mockReturnValue(false),
    };

    router = {
      navigate: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ngOnInit should show error when token is missing', () => {
    const component = createComponent('set');
    (auth.getAuthorizationHeaderValue as any).mockReturnValue(null);

    component.ngOnInit();

    expect(component.error).toEqual(component.ui.sessionExpired);
  });

  it('submit should block weak password before API call in set mode', () => {
    const component = createComponent('set');
    component.ngOnInit();
    component.newPassword = 'weak';
    component.confirmPassword = 'weak';

    component.submit();

    expect(component.error).toMatchObject({
      zh: expect.stringContaining('密码不符合要求'),
      en: expect.stringContaining('Password does not meet the requirements'),
    });
    expect(auth.setPassword).not.toHaveBeenCalled();
  });

  it('submit should call setPassword and redirect on success in set mode', () => {
    const component = createComponent('set');
    component.ngOnInit();
    component.newPassword = 'Aa1!goodPass';
    component.confirmPassword = 'Aa1!goodPass';
    (auth.setPassword as any).mockReturnValue(of({ success: true, message: 'ok' }));

    component.submit();

    expect(auth.setPassword).toHaveBeenCalledWith({
      newPassword: 'Aa1!goodPass',
    });
    expect(auth.clearMustChangePasswordFlag).toHaveBeenCalledTimes(1);
    expect(component.successMsg).toBe('ok');

    vi.advanceTimersByTime(500);
    expect(router.navigate).toHaveBeenCalledWith(['/teacher/dashboard']);
  });

  it('submit should require old password in change mode', () => {
    const component = createComponent('change');
    component.ngOnInit();
    component.newPassword = 'Aa1!goodPass';
    component.confirmPassword = 'Aa1!goodPass';

    component.submit();

    expect(component.error).toEqual(component.ui.currentPasswordRequired);
    expect(auth.changePassword).not.toHaveBeenCalled();
  });

  it('submit should call changePassword and clear inputs on success in change mode', () => {
    const component = createComponent('change');
    component.ngOnInit();
    component.oldPassword = 'old#Pass1';
    component.newPassword = 'Aa1!goodPass';
    component.confirmPassword = 'Aa1!goodPass';
    (auth.changePassword as any).mockReturnValue(of({ success: true, message: 'updated' }));

    component.submit();

    expect(auth.changePassword).toHaveBeenCalledWith({
      oldPassword: 'old#Pass1',
      newPassword: 'Aa1!goodPass',
    });
    expect(component.successMsg).toBe('updated');
    expect(component.oldPassword).toBe('');
    expect(component.newPassword).toBe('');
    expect(component.confirmPassword).toBe('');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(auth.clearMustChangePasswordFlag).not.toHaveBeenCalled();
  });

  it('should force set mode when mustChangePassword flag is true', () => {
    (auth.mustChangePassword as any).mockReturnValue(true);
    const component = createComponent('change');
    component.ngOnInit();
    component.newPassword = 'Aa1!goodPass';
    component.confirmPassword = 'Aa1!goodPass';
    (auth.setPassword as any).mockReturnValue(of({ success: true, message: 'ok' }));

    component.submit();

    expect(auth.setPassword).toHaveBeenCalledTimes(1);
    expect(auth.changePassword).not.toHaveBeenCalled();
  });
});
