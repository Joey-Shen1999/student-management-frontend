import { Router } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../../services/auth.service';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let auth: Pick<AuthService, 'getSession' | 'logout'>;
  let router: Pick<Router, 'navigate'>;

  beforeEach(() => {
    auth = {
      getSession: vi.fn().mockReturnValue({ userId: 1, role: 'STUDENT' }),
      logout: vi.fn(),
    };

    router = {
      navigate: vi.fn(),
    };

    component = new DashboardComponent(auth as AuthService, router as Router);
  });

  it('should create and read session from auth service', () => {
    expect(component).toBeTruthy();
    expect(component.session).toEqual({ userId: 1, role: 'STUDENT' });
  });

  it('goProfile should navigate to student profile page', () => {
    component.goProfile();
    expect(router.navigate).toHaveBeenCalledWith(['/student/profile']);
  });

  it('logout should clear session and navigate to login', () => {
    component.logout();
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
