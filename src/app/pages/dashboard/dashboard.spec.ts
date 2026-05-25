import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../services/auth.service';
import {
  GraduationApplication,
  GraduationApplicationStageService,
} from '../../services/graduation-application-stage.service';
import { StudentProfileService } from '../../services/student-profile.service';
import { type InfoTaskVm, TaskCenterService } from '../../services/task-center.service';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let auth: Pick<AuthService, 'getSession' | 'logout' | 'clearAuthState'>;
  let router: Pick<Router, 'navigate'>;
  let profileApi: Pick<StudentProfileService, 'getMyProfile'>;
  let taskCenter: Pick<
    TaskCenterService,
    'listMyInfos' | 'markMyInfoAsRead'
  >;

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
  const readInfoRow: InfoTaskVm = {
    ...infoRows[0],
    id: 5002,
    title: '已读通知',
    read: true,
    readAt: '2026-03-09T00:00:00Z',
  };

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

  it('goUniversityGoals should navigate to standalone university goals page', () => {
    component.goUniversityGoals();
    expect(router.navigate).toHaveBeenCalledWith(['/student/university-goals']);
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

  it('should load notification info list on init', () => {
    expect(taskCenter.listMyInfos).toHaveBeenCalledWith({
      category: 'ALL',
      tag: '',
      unreadOnly: true,
      page: 1,
      size: 10,
    });
    expect(component.infoItems.length).toBe(1);
    expect(component.unreadInfoItems.length).toBe(1);
    expect(component.readInfoItems.length).toBe(0);
  });

  it('markInfoRead should hide the notification from the default unread list', () => {
    component.markInfoRead(infoRows[0]);

    expect(taskCenter.markMyInfoAsRead).toHaveBeenCalledWith(5001);
    expect(component.infoItems.length).toBe(0);
    expect(component.unreadInfoItems.length).toBe(0);
  });

  it('toggleReadInfos should load and expose read notifications', () => {
    (taskCenter.listMyInfos as any).mockReturnValue(
      of({ items: [infoRows[0], readInfoRow], total: 2, page: 1, size: 10 })
    );

    component.toggleReadInfos();

    expect(component.showReadInfos).toBe(true);
    expect(taskCenter.listMyInfos).toHaveBeenLastCalledWith({
      category: 'ALL',
      tag: '',
      unreadOnly: false,
      page: 1,
      size: 10,
    });
    expect(component.unreadInfoItems.map((info) => info.id)).toEqual([5001]);
    expect(component.readInfoItems.map((info) => info.id)).toEqual([5002]);
  });

  it('loads application progress after resolving studentId from profile for an old session', () => {
    (auth.getSession as any).mockReturnValue({ userId: 9, role: 'STUDENT' });
    (profileApi.getMyProfile as any).mockReturnValue(
      of({
        studentId: 1001,
        legalLastName: 'Chen',
        legalFirstName: 'Xiao',
      })
    );
    const applications: GraduationApplication[] = [
      {
        id: 7001,
        studentId: 1001,
        universityId: 88,
        universityName: 'University A',
        programId: 8801,
        programName: 'Program A',
        status: 'PREPARING',
        sortOrder: 1,
        updatedAt: '2026-05-25T12:00:00Z',
      },
    ];
    const graduationStage = {
      listApplications: vi.fn().mockReturnValue(of(applications)),
      getPortalCredential: vi.fn().mockReturnValue(
        of({
          studentId: 1001,
          universityId: 88,
          universityName: 'University A',
          schoolAccount: '',
          schoolEmail: '',
          schoolPassword: '',
          studentVisible: false,
          interviewRequired: true,
          languageScoreRequired: false,
        })
      ),
      resolvePortalLoginUrl: vi.fn().mockReturnValue(''),
    };
    const nextComponent = new DashboardComponent(
      auth as AuthService,
      router as Router,
      taskCenter as TaskCenterService,
      profileApi as StudentProfileService,
      graduationStage as unknown as GraduationApplicationStageService
    );

    nextComponent.ngOnInit();

    expect(graduationStage.listApplications).toHaveBeenCalledWith(1001);
    expect(nextComponent.applicationStageEnabled).toBe(true);
    expect(nextComponent.applicationProgressGroups.length).toBe(1);
    expect(nextComponent.applicationProgressGroups[0].portalCredential?.interviewRequired).toBe(true);
  });

  it('copies visible school portal fields on the student dashboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const group = {
      universityId: 88,
      universityName: 'University A',
      applications: [],
      portalLoading: false,
      portalError: '',
      portalCredential: {
        studentId: 1001,
        universityId: 88,
        universityName: 'University A',
        schoolAccount: 'portal-user',
        schoolEmail: 'student.portal@outlook.com',
        schoolPassword: 'Changed!234',
        studentVisible: true,
        interviewRequired: false,
        languageScoreRequired: false,
      },
    } as any;

    component.copyStudentPortalField(group, 'schoolEmail');
    await Promise.resolve();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('student.portal@outlook.com');
    expect(component.isStudentPortalFieldCopied(group, 'schoolEmail')).toBe(true);

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
  });

  it('logout should clear session and navigate to login', () => {
    component.logout();
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
