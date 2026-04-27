import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../services/auth.service';
import { StudentProfileService } from '../../services/student-profile.service';
import {
  type GoalTaskVm,
  type InfoTaskVm,
  TaskCenterService,
} from '../../services/task-center.service';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let auth: Pick<AuthService, 'getSession' | 'logout' | 'clearAuthState'>;
  let router: Pick<Router, 'navigate'>;
  let profileApi: Pick<StudentProfileService, 'getMyProfile'>;
  let taskCenter: Pick<
    TaskCenterService,
    'listMyGoals' | 'updateMyGoalStatus' | 'listMyInfos' | 'markMyInfoAsRead'
  >;

  const goalRows: GoalTaskVm[] = [
    {
      id: 1001,
      type: 'GOAL',
      title: '完成 OUAC 账户注册',
      description: '本周内完成 OUAC 注册并截图上传。',
      status: 'NOT_STARTED',
      dueAt: '2026-03-15',
      assignedStudentId: 20001,
      assignedStudentName: '张三',
      assignedByTeacherId: 9001,
      assignedByTeacherName: 'Ms. Chen',
      createdAt: '2026-03-08T10:00:00Z',
      updatedAt: '2026-03-08T10:00:00Z',
      completedAt: null,
      progressNote: '',
    },
  ];

  const infoRows: InfoTaskVm[] = [
    {
      id: 5001,
      type: 'INFO',
      title: '开放日通知',
      content: '请尽快报名。',
      category: 'ACTIVITY',
      tags: ['OpenDay'],
      targetStudentCount: 30,
      publishedByTeacherId: 9001,
      publishedByTeacherName: 'Ms. Chen',
      createdAt: '2026-03-08T10:00:00Z',
      updatedAt: '2026-03-08T10:00:00Z',
      read: false,
      readAt: null,
    },
  ];

  beforeEach(() => {
    auth = {
      getSession: vi.fn().mockReturnValue({ userId: 1, role: 'STUDENT' }),
      logout: vi.fn().mockReturnValue(of({ success: true })),
      clearAuthState: vi.fn(),
    };

    router = {
      navigate: vi.fn(),
    };

    profileApi = {
      getMyProfile: vi.fn().mockReturnValue(of({ profile: {} })),
    };

    taskCenter = {
      listMyGoals: vi.fn().mockReturnValue(of({ items: goalRows, total: 1, page: 1, size: 8 })),
      updateMyGoalStatus: vi.fn().mockReturnValue(
        of({
          ...goalRows[0],
          status: 'COMPLETED',
          completedAt: '2026-03-09T00:00:00Z',
          updatedAt: '2026-03-09T00:00:00Z',
        })
      ),
      listMyInfos: vi.fn().mockReturnValue(of({ items: infoRows, total: 1, page: 1, size: 10 })),
      markMyInfoAsRead: vi.fn().mockReturnValue(
        of({
          ...infoRows[0],
          read: true,
          readAt: '2026-03-09T00:00:00Z',
          updatedAt: '2026-03-09T00:00:00Z',
        })
      ),
    };

    component = new DashboardComponent(
      auth as AuthService,
      router as Router,
      taskCenter as TaskCenterService,
      profileApi as StudentProfileService
    );
    component.ngOnInit();
  });

  it('should create and read session from auth service', () => {
    expect(component).toBeTruthy();
    expect(component.session).toEqual({ userId: 1, role: 'STUDENT' });
  });

  it('welcomeDisplayName should prefer preferredName from session', () => {
    (auth.getSession as any).mockReturnValue({
      userId: 1,
      role: 'STUDENT',
      legalFirstName: 'Alice',
      legalLastName: 'Wang',
      preferredName: 'Ali',
    });
    const nextComponent = new DashboardComponent(
      auth as AuthService,
      router as Router,
      taskCenter as TaskCenterService,
      profileApi as StudentProfileService
    );

    expect(nextComponent.welcomeDisplayName).toBe('Ali');
  });

  it('welcomeDisplayName should ignore placeholder Student and use legal name', () => {
    (auth.getSession as any).mockReturnValue({
      userId: 1,
      role: 'STUDENT',
      legalFirstName: 'Xiaoming',
      legalLastName: 'Wang',
      preferredName: 'Student',
    });
    const nextComponent = new DashboardComponent(
      auth as AuthService,
      router as Router,
      taskCenter as TaskCenterService,
      profileApi as StudentProfileService
    );

    expect(nextComponent.welcomeDisplayName).toBe('Wang Xiaoming');
  });

  it('welcomeDisplayName should use last name + first name order', () => {
    (auth.getSession as any).mockReturnValue({
      userId: 1,
      role: 'STUDENT',
      legalFirstName: 'Xiaoming',
      legalLastName: 'Wang',
    });
    const nextComponent = new DashboardComponent(
      auth as AuthService,
      router as Router,
      taskCenter as TaskCenterService,
      profileApi as StudentProfileService
    );

    expect(nextComponent.welcomeDisplayName).toBe('Wang Xiaoming');
  });

  it('welcomeDisplayName should support snake_case profile payload', () => {
    (auth.getSession as any).mockReturnValue({
      userId: 1,
      role: 'STUDENT',
      profile: {
        last_name: 'Li',
        first_name: 'Lei',
      },
    });
    const nextComponent = new DashboardComponent(
      auth as AuthService,
      router as Router,
      taskCenter as TaskCenterService,
      profileApi as StudentProfileService
    );

    expect(nextComponent.welcomeDisplayName).toBe('Li Lei');
  });

  it('welcomeDisplayName should fallback to 学生 when name is missing', () => {
    expect(component.welcomeDisplayName).toBe('学生');
  });

  it('welcomeDisplayName should use profile name when session has no name', () => {
    (profileApi.getMyProfile as any).mockReturnValue(
      of({
        profile: {
          legalLastName: 'Chen',
          legalFirstName: 'Xiao',
        },
      })
    );
    const nextComponent = new DashboardComponent(
      auth as AuthService,
      router as Router,
      taskCenter as TaskCenterService,
      profileApi as StudentProfileService
    );

    nextComponent.ngOnInit();

    expect(nextComponent.welcomeDisplayName).toBe('Chen Xiao');
  });

  it('goProfile should navigate to student profile page', () => {
    component.goProfile();
    expect(router.navigate).toHaveBeenCalledWith(['/student/profile']);
  });

  it('goDocumentUpload should navigate to dedicated student documents page', () => {
    component.goDocumentUpload();
    expect(router.navigate).toHaveBeenCalledWith(['/student/documents']);
  });

  it('goVolunteerRecords should navigate to student volunteer page', () => {
    component.goVolunteerRecords();
    expect(router.navigate).toHaveBeenCalledWith(['/student/volunteer']);
  });

  it('goAccount should navigate to account settings page', () => {
    component.goAccount();
    expect(router.navigate).toHaveBeenCalledWith(['/account']);
  });

  it('goAccountProfile should navigate to account profile settings page', () => {
    component.goAccountProfile();
    expect(router.navigate).toHaveBeenCalledWith(['/account/profile']);
  });

  it('goAccountProfile should pass resolved name via router state', () => {
    (auth.getSession as any).mockReturnValue({
      userId: 1,
      role: 'STUDENT',
      displayName: 'Session Name',
    });
    const nextComponent = new DashboardComponent(
      auth as AuthService,
      router as Router,
      taskCenter as TaskCenterService,
      profileApi as StudentProfileService
    );

    nextComponent.goAccountProfile();

    expect(router.navigate).toHaveBeenCalledWith(['/account/profile'], {
      state: {
        currentDisplayName: 'Session Name',
        currentLastName: 'Session',
        currentFirstName: 'Name',
      },
    });
  });

  it('goAccountProfile should pass first/last name state from session legal fields', () => {
    (auth.getSession as any).mockReturnValue({
      userId: 1,
      role: 'STUDENT',
      profile: {
        legalLastName: 'Wang',
        legalFirstName: 'Xiaoming',
      },
    });
    const nextComponent = new DashboardComponent(
      auth as AuthService,
      router as Router,
      taskCenter as TaskCenterService,
      profileApi as StudentProfileService
    );

    nextComponent.goAccountProfile();

    expect(router.navigate).toHaveBeenCalledWith(['/account/profile'], {
      state: {
        currentLastName: 'Wang',
        currentFirstName: 'Xiaoming',
        currentDisplayName: 'Wang Xiaoming',
      },
    });
  });

  it('should load goal and info list on init', () => {
    expect(taskCenter.listMyGoals).toHaveBeenCalledWith({ status: 'ALL', page: 1, size: 8 });
    expect(taskCenter.listMyInfos).toHaveBeenCalledWith({
      category: 'ALL',
      tag: '',
      unreadOnly: false,
      page: 1,
      size: 10,
    });
    expect(component.goalItems.length).toBe(1);
    expect(component.infoItems.length).toBe(1);
  });

  it('markGoalCompleted should call update service and update local goal state', () => {
    component.markGoalCompleted(goalRows[0]);

    expect(taskCenter.updateMyGoalStatus).toHaveBeenCalledWith(
      1001,
      expect.objectContaining({ status: 'COMPLETED' })
    );
    expect(component.goalItems[0].status).toBe('COMPLETED');
  });

  it('markInfoRead should call update service and update info state', () => {
    component.markInfoRead(infoRows[0]);

    expect(taskCenter.markMyInfoAsRead).toHaveBeenCalledWith(5001);
    expect(component.infoItems[0].read).toBe(true);
  });

  it('logout should clear session and navigate to login', () => {
    component.logout();
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
