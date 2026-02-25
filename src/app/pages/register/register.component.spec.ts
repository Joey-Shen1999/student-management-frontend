import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../services/auth.service';
import { RegisterComponent } from './register.component';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let auth: Pick<AuthService, 'register' | 'getStudentInvitePreview'>;
  let router: Pick<Router, 'navigate'>;
  let route: ActivatedRoute;

  beforeEach(() => {
    vi.useFakeTimers();

    auth = {
      register: vi.fn(),
      getStudentInvitePreview: vi.fn().mockReturnValue(of({ valid: true })),
    };

    router = {
      navigate: vi.fn(),
    };

    route = {
      snapshot: {
        queryParamMap: convertToParamMap({}),
      },
    } as unknown as ActivatedRoute;

    component = new RegisterComponent(
      auth as AuthService,
      router as Router,
      route
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should reject weak password before calling register API', () => {
    component.username = 'alice';
    component.password = 'weak';
    component.confirmPassword = 'weak';

    component.submit();

    expect(component.error).toContain('Password does not meet requirements');
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('should reject when password and confirmPassword do not match', () => {
    component.username = 'alice';
    component.password = 'Aa1!goodPass';
    component.confirmPassword = 'Aa1!different';

    component.submit();

    expect(component.error).toBe('Passwords do not match.');
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('should submit and navigate to login on success', () => {
    (auth.register as any).mockReturnValue(
      of({
        userId: 1,
        role: 'STUDENT',
        studentId: 100,
        teacherId: null,
      })
    );

    component.username = ' alice ';
    component.password = 'Aa1!goodPass';
    component.confirmPassword = 'Aa1!goodPass';
    component.firstName = ' Alice ';
    component.lastName = ' Zhang ';
    component.preferredName = ' Ali ';

    component.submit();

    expect(auth.register).toHaveBeenCalledWith({
      username: 'alice',
      password: 'Aa1!goodPass',
      role: 'STUDENT',
      firstName: 'Alice',
      lastName: 'Zhang',
      preferredName: 'Ali',
    });
    expect(component.success).toBe('Account created. Redirecting to login...');

    vi.advanceTimersByTime(600);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should include inviteToken in register payload when invite link is used', () => {
    route = {
      snapshot: {
        queryParamMap: convertToParamMap({ inviteToken: 'invite-abc' }),
      },
    } as unknown as ActivatedRoute;
    component = new RegisterComponent(
      auth as AuthService,
      router as Router,
      route
    );

    (auth.register as any).mockReturnValue(
      of({
        userId: 2,
        role: 'STUDENT',
        studentId: 101,
        teacherId: 3,
      })
    );

    component.ngOnInit();
    component.username = 'bob';
    component.password = 'Aa1!goodPass';
    component.confirmPassword = 'Aa1!goodPass';

    component.submit();

    expect(auth.getStudentInvitePreview).toHaveBeenCalledWith('invite-abc');
    expect(auth.register).toHaveBeenCalledWith(
      expect.objectContaining({
        inviteToken: 'invite-abc',
      })
    );
  });
});
