import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../services/auth.service';
import { ChangePasswordComponent } from './change-password.component';

describe('ChangePasswordComponent', () => {
  let component: ChangePasswordComponent;
  let auth: Pick<AuthService, 'getSession' | 'setPassword' | 'clearMustChangePasswordFlag'>;
  let router: Pick<Router, 'navigate'>;
  let route: {
    snapshot: {
      queryParamMap: {
        get: ReturnType<typeof vi.fn>;
      };
    };
  };

  beforeEach(() => {
    vi.useFakeTimers();

    auth = {
      getSession: vi.fn().mockReturnValue(null),
      setPassword: vi.fn(),
      clearMustChangePasswordFlag: vi.fn(),
    };

    router = {
      navigate: vi.fn(),
    };

    route = {
      snapshot: {
        queryParamMap: {
          get: vi.fn().mockReturnValue(null),
        },
      },
    };

    component = new ChangePasswordComponent(
      auth as AuthService,
      router as Router,
      route as unknown as ActivatedRoute
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ngOnInit should use userId from query params first', () => {
    route.snapshot.queryParamMap.get.mockReturnValue('12');

    component.ngOnInit();

    expect(component.userId).toBe(12);
    expect(component.error).toBe('');
  });

  it('ngOnInit should fallback to session userId when query param is missing', () => {
    (auth.getSession as any).mockReturnValue({ userId: 88, role: 'TEACHER' });

    component.ngOnInit();

    expect(component.userId).toBe(88);
  });

  it('submit should block weak password before API call', () => {
    component.userId = 1;
    component.newPassword = 'weak';
    component.confirmPassword = 'weak';
    (auth.getSession as any).mockReturnValue({ userId: 1, username: 'alice' });

    component.submit();

    expect(component.error).toContain('Password does not meet requirements');
    expect(auth.setPassword).not.toHaveBeenCalled();
  });

  it('submit should call setPassword and redirect on success', () => {
    component.userId = 1;
    component.newPassword = 'Aa1!goodPass';
    component.confirmPassword = 'Aa1!goodPass';
    (auth.getSession as any).mockReturnValue({ userId: 1, username: 'alice' });
    (auth.setPassword as any).mockReturnValue(of({ success: true, message: 'ok' }));

    component.submit();

    expect(auth.setPassword).toHaveBeenCalledWith({
      userId: 1,
      newPassword: 'Aa1!goodPass',
    });
    expect(auth.clearMustChangePasswordFlag).toHaveBeenCalledTimes(1);
    expect(component.successMsg).toBe('ok');

    vi.advanceTimersByTime(500);
    expect(router.navigate).toHaveBeenCalledWith(['/teacher/dashboard']);
  });
});
