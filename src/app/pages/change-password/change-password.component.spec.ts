import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../services/auth.service';
import { ChangePasswordComponent } from './change-password.component';

describe('ChangePasswordComponent', () => {
  let component: ChangePasswordComponent;
  let auth: Pick<
    AuthService,
    'getSession' | 'setPassword' | 'clearMustChangePasswordFlag' | 'getAuthorizationHeaderValue'
  >;
  let router: Pick<Router, 'navigate'>;

  beforeEach(() => {
    vi.useFakeTimers();

    auth = {
      getSession: vi.fn().mockReturnValue(null),
      setPassword: vi.fn(),
      clearMustChangePasswordFlag: vi.fn(),
      getAuthorizationHeaderValue: vi.fn().mockReturnValue('Bearer token-1'),
    };

    router = {
      navigate: vi.fn(),
    };

    component = new ChangePasswordComponent(auth as AuthService, router as Router);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ngOnInit should show error when token is missing', () => {
    (auth.getAuthorizationHeaderValue as any).mockReturnValue(null);
    component.ngOnInit();

    expect(component.error).toBe('Missing login session. Please login again.');
  });

  it('submit should block weak password before API call', () => {
    component.newPassword = 'weak';
    component.confirmPassword = 'weak';
    (auth.getSession as any).mockReturnValue({ userId: 1, username: 'alice' });

    component.submit();

    expect(component.error).toContain('Password does not meet requirements');
    expect(auth.setPassword).not.toHaveBeenCalled();
  });

  it('submit should call setPassword and redirect on success', () => {
    component.newPassword = 'Aa1!goodPass';
    component.confirmPassword = 'Aa1!goodPass';
    (auth.getSession as any).mockReturnValue({ userId: 1, username: 'alice', role: 'TEACHER' });
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

  it('submit should redirect student user to student dashboard on success', () => {
    component.newPassword = 'Aa1!goodPass';
    component.confirmPassword = 'Aa1!goodPass';
    (auth.getSession as any).mockReturnValue({ userId: 2, username: 'bob', role: 'STUDENT' });
    (auth.setPassword as any).mockReturnValue(of({ success: true, message: 'ok' }));

    component.submit();

    vi.advanceTimersByTime(500);
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });
});
