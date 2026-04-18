import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../services/auth.service';
import { TeacherDashboardComponent } from './teacher-dashboard.component';

describe('TeacherDashboardComponent', () => {
  let auth: Pick<AuthService, 'getSession' | 'logout' | 'clearAuthState'>;
  let router: Pick<Router, 'navigate'>;

  beforeEach(() => {
    auth = {
      getSession: vi.fn().mockReturnValue({ userId: 11, role: 'ADMIN' }),
      logout: vi.fn().mockReturnValue(of({ success: true })),
      clearAuthState: vi.fn(),
    };

    router = {
      navigate: vi.fn(),
    };
  });

  it('should create and evaluate admin role from session', () => {
    const component = new TeacherDashboardComponent(auth as AuthService, router as Router);

    expect(component).toBeTruthy();
    expect(component.isAdmin).toBe(true);
  });

  it('goTeachers should navigate to teacher management', () => {
    const component = new TeacherDashboardComponent(auth as AuthService, router as Router);

    component.goTeachers();

    expect(router.navigate).toHaveBeenCalledWith(['/teacher/teachers']);
  });

  it('goStudents should navigate to student management', () => {
    const component = new TeacherDashboardComponent(auth as AuthService, router as Router);

    component.goStudents();

    expect(router.navigate).toHaveBeenCalledWith(['/teacher/students']);
  });

  it('goCourses should navigate to course management', () => {
    const component = new TeacherDashboardComponent(auth as AuthService, router as Router);

    component.goCourses();

    expect(router.navigate).toHaveBeenCalledWith(['/teacher/courses']);
  });

  it('goIeltsTracking should navigate to IELTS dashboard', () => {
    const component = new TeacherDashboardComponent(auth as AuthService, router as Router);

    component.goIeltsTracking();

    expect(router.navigate).toHaveBeenCalledWith(['/teacher/ielts']);
  });

  it('goGoals should navigate to goal management', () => {
    const component = new TeacherDashboardComponent(auth as AuthService, router as Router);

    component.goGoals();

    expect(router.navigate).toHaveBeenCalledWith(['/teacher/goals']);
  });

  it('goTasks should navigate to notification management', () => {
    const component = new TeacherDashboardComponent(auth as AuthService, router as Router);

    component.goTasks();

    expect(router.navigate).toHaveBeenCalledWith(['/teacher/tasks']);
  });

  it('goAccount should navigate to account settings', () => {
    const component = new TeacherDashboardComponent(auth as AuthService, router as Router);

    component.goAccount();

    expect(router.navigate).toHaveBeenCalledWith(['/teacher/account']);
  });

  it('logout should navigate to login on success', () => {
    const component = new TeacherDashboardComponent(auth as AuthService, router as Router);

    component.logout();

    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
