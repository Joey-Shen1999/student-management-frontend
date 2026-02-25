import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { StudentManagementComponent } from './student-management.component';
import { StudentManagementService } from '../../services/student-management.service';
import { StudentInviteService } from '../../services/student-invite.service';
import { AuthService } from '../../services/auth.service';
import { TeacherManagementService } from '../../services/teacher-management.service';

describe('StudentManagementComponent', () => {
  let component: StudentManagementComponent;
  let api: Pick<
    StudentManagementService,
    'listStudents' | 'resetStudentPassword' | 'updateStudentStatus'
  >;
  let inviteApi: Pick<StudentInviteService, 'createInvite'>;
  let auth: Pick<AuthService, 'getSession'>;
  let teacherApi: Pick<TeacherManagementService, 'listTeachers'>;

  beforeEach(() => {
    api = {
      listStudents: vi.fn().mockReturnValue(of([])),
      resetStudentPassword: vi.fn(),
      updateStudentStatus: vi.fn(),
    };
    inviteApi = {
      createInvite: vi.fn(),
    };
    auth = {
      getSession: vi.fn().mockReturnValue({
        userId: 99,
        role: 'TEACHER',
        studentId: null,
        teacherId: 7,
        accessToken: 'token-abc',
        tokenType: 'Bearer',
        tokenExpiresAt: '2026-02-24T12:17:26.239',
      }),
    };
    teacherApi = {
      listTeachers: vi.fn().mockReturnValue(of([])),
    };

    component = new StudentManagementComponent(
      api as StudentManagementService,
      inviteApi as StudentInviteService,
      teacherApi as TeacherManagementService,
      auth as AuthService
    );
  });

  it('ngOnInit should load student list', () => {
    (api.listStudents as any).mockReturnValue(
      of([
        { studentId: 1, username: 'student01' },
        { studentId: 2, username: 'student02' },
      ])
    );

    component.ngOnInit();

    expect(api.listStudents).toHaveBeenCalledTimes(1);
    expect(component.students.length).toBe(2);
  });

  it('ngOnInit should load teacher options for admin and auto-select when only one teacher exists', () => {
    (auth.getSession as any).mockReturnValue({
      userId: 1,
      role: 'ADMIN',
      studentId: null,
      teacherId: null,
      accessToken: 'token-abc',
      tokenType: 'Bearer',
      tokenExpiresAt: '2026-02-24T12:17:26.239',
    });
    (teacherApi.listTeachers as any).mockReturnValue(
      of([
        { teacherId: 12, username: 'teacher12' },
      ])
    );

    component = new StudentManagementComponent(
      api as StudentManagementService,
      inviteApi as StudentInviteService,
      teacherApi as TeacherManagementService,
      auth as AuthService
    );

    component.ngOnInit();

    expect(teacherApi.listTeachers).toHaveBeenCalledTimes(1);
    expect(component.selectedInviteTeacherId).toBe(12);
    expect(component.inviteTeacherOptions).toEqual([{ teacherId: 12, label: '12 - teacher12' }]);
  });

  it('loadStudents should support payload with items', () => {
    (api.listStudents as any).mockReturnValue(
      of({
        items: [{ studentId: 11, username: 'student11' }],
      })
    );

    component.loadStudents();

    expect(component.students).toEqual([
      expect.objectContaining({ studentId: 11, username: 'student11', status: 'ACTIVE' }),
    ]);
    expect(component.listError).toBe('');
  });

  it('loadStudents should show backend error message on failure', () => {
    (api.listStudents as any).mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            error: { message: 'Server error' },
          })
      )
    );

    component.loadStudents();

    expect(component.listError).toBe('Server error');
    expect(component.students).toEqual([]);
  });

  it('loadStudents should hide inactive students by default', () => {
    const students = Array.from({ length: 30 }, (_v, index) => ({
      studentId: index + 1,
      username: `student${index + 1}`,
      status: index % 2 === 0 ? 'ACTIVE' : 'ARCHIVED',
    }));
    (api.listStudents as any).mockReturnValue(of(students));

    component.loadStudents();

    expect(component.students.length).toBe(30);
    expect(component.filteredCount).toBe(15);
    expect(component.visibleStudents.length).toBe(15);
  });

  it('applyListView should hide inactive students by default and keep keyword search', () => {
    component.students = [
      { studentId: 1, username: 'alice', displayName: 'Alice A', email: 'alice@example.com', status: 'ACTIVE' },
      { studentId: 2, username: 'alice_archived', displayName: 'Alice B', email: 'alice2@example.com', status: 'ARCHIVED' },
    ];
    component.searchKeyword = 'alice';

    component.applyListView();

    expect(component.filteredCount).toBe(1);
    expect(component.visibleStudents).toEqual([
      { studentId: 1, username: 'alice', displayName: 'Alice A', email: 'alice@example.com', status: 'ACTIVE' },
    ]);
  });

  it('applyListView should include inactive students when enabled', () => {
    component.students = [
      { studentId: 1, username: 'alice', displayName: 'Alice A', email: 'alice@example.com', status: 'ACTIVE' },
      { studentId: 2, username: 'alice_archived', displayName: 'Alice B', email: 'alice2@example.com', status: 'ARCHIVED' },
    ];
    component.searchKeyword = 'alice';
    component.showInactive = true;

    component.applyListView();

    expect(component.filteredCount).toBe(2);
    expect(component.visibleStudents).toEqual([
      { studentId: 1, username: 'alice', displayName: 'Alice A', email: 'alice@example.com', status: 'ACTIVE' },
      { studentId: 2, username: 'alice_archived', displayName: 'Alice B', email: 'alice2@example.com', status: 'ARCHIVED' },
    ]);
  });

  it('createInviteLink should build register url from invite token', () => {
    (inviteApi.createInvite as any).mockReturnValue(
      of({
        inviteToken: 'token-abc',
        expiresAt: '2026-03-01T00:00:00.000Z',
      })
    );

    component.createInviteLink();

    expect(inviteApi.createInvite).toHaveBeenCalledTimes(1);
    expect(inviteApi.createInvite).toHaveBeenCalledWith(7);
    expect(component.inviteLink).toContain('/register?inviteToken=token-abc');
    expect(component.inviteExpiresAt).toBe('2026-03-01T00:00:00.000Z');
    expect(component.inviteError).toBe('');
  });

  it('createInviteLink should convert relative invite url to absolute url', () => {
    (inviteApi.createInvite as any).mockReturnValue(
      of({
        registrationUrl: '/register?inviteToken=token-xyz',
      })
    );

    component.createInviteLink();

    expect(component.inviteLink).toContain('/register?inviteToken=token-xyz');
    expect(component.inviteLink.startsWith('http://') || component.inviteLink.startsWith('https://')).toBe(true);
  });

  it('createInviteLink should require teacherId for admin user', () => {
    component.isAdminUser = true;
    component.selectedInviteTeacherId = null;

    component.createInviteLink();

    expect(inviteApi.createInvite).not.toHaveBeenCalled();
    expect(component.inviteError).toBe('管理员生成邀请链接时必须选择教师 ID。');
  });

  it('resetPassword should call API and expose temp password', () => {
    (api.resetStudentPassword as any).mockReturnValue(
      of({
        username: 'student20',
        tempPassword: 'Ab12Cd34',
      })
    );

    component.resetPassword({ studentId: 20, username: 'student20' });

    expect(api.resetStudentPassword).toHaveBeenCalledWith(20);
    expect(component.resetResult).toEqual({
      studentId: 20,
      username: 'student20',
      tempPassword: 'Ab12Cd34',
    });
  });

  it('setStudentStatus should call API and update status result', () => {
    (api.updateStudentStatus as any).mockReturnValue(
      of({
        username: 'student31',
        status: 'ARCHIVED',
      })
    );

    component.setStudentStatus({ studentId: 31, username: 'student31', status: 'ACTIVE' }, 'ARCHIVED');

    expect(api.updateStudentStatus).toHaveBeenCalledWith(31, 'ARCHIVED');
    expect(component.statusResult).toEqual({
      studentId: 31,
      username: 'student31',
      status: 'ARCHIVED',
    });
  });

  it('profileRoute should resolve /teacher/students/{id}/profile when student id exists', () => {
    const route = component.profileRoute({ studentId: 88, username: 'student88' });
    expect(route).toEqual(['/teacher/students', '88', 'profile']);
  });

  it('profileRoute should fallback to /teacher/students when student id is missing', () => {
    const route = component.profileRoute({ username: 'no-id-student' } as any);
    expect(route).toEqual(['/teacher/students']);
  });
});
