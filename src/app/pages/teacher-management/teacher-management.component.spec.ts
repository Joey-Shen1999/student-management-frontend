import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { TeacherManagementComponent } from './teacher-management.component';
import { TeacherManagementService } from '../../services/teacher-management.service';

describe('TeacherManagementComponent', () => {
  let component: TeacherManagementComponent;
  let api: Pick<
    TeacherManagementService,
    'listTeachers' | 'resetTeacherPassword' | 'updateTeacherRole' | 'updateTeacherStatus'
  >;

  beforeEach(() => {
    api = {
      listTeachers: vi.fn().mockReturnValue(of([])),
      resetTeacherPassword: vi.fn(),
      updateTeacherRole: vi.fn(),
      updateTeacherStatus: vi.fn(),
    };

    component = new TeacherManagementComponent(api as TeacherManagementService);
  });

  it('ngOnInit should load teacher list', () => {
    (api.listTeachers as any).mockReturnValue(
      of([
        { teacherId: 1, username: 'teacher01' },
        { teacherId: 2, username: 'teacher02' },
      ])
    );

    component.ngOnInit();

    expect(api.listTeachers).toHaveBeenCalledTimes(1);
    expect(component.teachers.length).toBe(2);
  });

  it('loadTeachers should support payload with items', () => {
    (api.listTeachers as any).mockReturnValue(
      of({
        items: [{ teacherId: 11, username: 'teacher11' }],
      })
    );

    component.loadTeachers();

    expect(component.teachers).toEqual([
      expect.objectContaining({ teacherId: 11, username: 'teacher11', status: 'ACTIVE' }),
    ]);
    expect(component.listError).toBe('');
  });

  it('loadTeachers should show backend error message on failure', () => {
    (api.listTeachers as any).mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            error: { message: 'Server error' },
          })
      )
    );

    component.loadTeachers();

    expect(component.listError).toBe('Server error');
    expect(component.teachers).toEqual([]);
  });

  it('loadTeachers should default to showing 20 records', () => {
    const teachers = Array.from({ length: 30 }, (_v, index) => ({
      teacherId: index + 1,
      username: `teacher${index + 1}`,
      role: index % 2 === 0 ? 'TEACHER' : 'ADMIN',
    }));
    (api.listTeachers as any).mockReturnValue(of(teachers));

    component.loadTeachers();

    expect(component.teachers.length).toBe(30);
    expect(component.filteredCount).toBe(30);
    expect(component.visibleTeachers.length).toBe(20);
  });

  it('applyListView should respect selected limit', () => {
    component.teachers = Array.from({ length: 60 }, (_v, index) => ({
      teacherId: index + 1,
      username: `teacher${index + 1}`,
      role: 'TEACHER',
    }));
    component.listLimit = 50;

    component.applyListView();

    expect(component.visibleTeachers.length).toBe(50);
    expect(component.filteredCount).toBe(60);
  });

  it('applyListView should support role filter and keyword search', () => {
    component.teachers = [
      { teacherId: 1, username: 'alice', displayName: 'Alice Admin', email: 'alice@example.com', role: 'ADMIN' },
      { teacherId: 2, username: 'alex', displayName: 'Alex Teacher', email: 'alex@example.com', role: 'TEACHER' },
      { teacherId: 3, username: 'bob', displayName: 'Bob Admin', email: 'bob@example.com', role: 'ADMIN' },
    ];
    component.roleFilter = 'ADMIN';
    component.searchKeyword = 'alice';

    component.applyListView();

    expect(component.filteredCount).toBe(1);
    expect(component.visibleTeachers).toEqual([
      { teacherId: 1, username: 'alice', displayName: 'Alice Admin', email: 'alice@example.com', role: 'ADMIN' },
    ]);
  });

  it('applyListView should hide inactive teachers by default', () => {
    component.teachers = [
      { teacherId: 1, username: 'active_teacher', status: 'ACTIVE' },
      { teacherId: 2, username: 'archived_teacher', status: 'ARCHIVED' },
    ];

    component.applyListView();

    expect(component.filteredCount).toBe(1);
    expect(component.visibleTeachers).toEqual([{ teacherId: 1, username: 'active_teacher', status: 'ACTIVE' }]);
  });

  it('applyListView should show inactive teachers when enabled', () => {
    component.teachers = [
      { teacherId: 1, username: 'active_teacher', status: 'ACTIVE' },
      { teacherId: 2, username: 'archived_teacher', status: 'ARCHIVED' },
    ];
    component.showInactive = true;

    component.applyListView();

    expect(component.filteredCount).toBe(2);
    expect(component.visibleTeachers).toEqual([
      { teacherId: 1, username: 'active_teacher', status: 'ACTIVE' },
      { teacherId: 2, username: 'archived_teacher', status: 'ARCHIVED' },
    ]);
  });

  it('resetPassword should call API and expose temp password', () => {
    (api.resetTeacherPassword as any).mockReturnValue(
      of({
        username: 'teacher20',
        tempPassword: 'Ab12Cd34',
      })
    );

    component.resetPassword({ teacherId: 20, username: 'teacher20' });

    expect(api.resetTeacherPassword).toHaveBeenCalledWith(20);
    expect(component.resetResult).toEqual({
      teacherId: 20,
      username: 'teacher20',
      tempPassword: 'Ab12Cd34',
    });
  });

  it('resetPassword should block when teacher id is missing', () => {
    component.resetPassword({ username: 'teacherX' } as any);

    expect(api.resetTeacherPassword).not.toHaveBeenCalled();
    expect(component.actionError).toBe('缺少教师 ID，无法重置密码。');
  });

  it('setRole should call API and update role result', () => {
    (api.updateTeacherRole as any).mockReturnValue(
      of({
        username: 'teacher31',
        role: 'ADMIN',
      })
    );

    component.setRole({ teacherId: 31, username: 'teacher31', role: 'TEACHER' }, 'ADMIN');

    expect(api.updateTeacherRole).toHaveBeenCalledWith(31, 'ADMIN');
    expect(component.roleResult).toEqual({
      teacherId: 31,
      username: 'teacher31',
      role: 'ADMIN',
    });
  });

  it('setRole should show account-not-found message on 404 NOT_FOUND', () => {
    (api.updateTeacherRole as any).mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 404,
            error: { status: 404, code: 'NOT_FOUND', message: 'Teacher account not found.' },
          })
      )
    );

    component.setRole({ teacherId: 77, username: 'teacher77' }, 'ADMIN');

    expect(component.actionError).toContain('Teacher account not found');
  });

  it('setRole should show no-permission message on 403 FORBIDDEN', () => {
    (api.updateTeacherRole as any).mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 403,
            error: { status: 403, code: 'FORBIDDEN', message: 'Forbidden: admin role required.' },
          })
      )
    );

    component.setRole({ teacherId: 88, username: 'teacher88' }, 'ADMIN');

    expect(component.actionError).toContain('Forbidden');
  });

  it('setRole should show bad-request message on 400 BAD_REQUEST', () => {
    (api.updateTeacherRole as any).mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { status: 400, code: 'BAD_REQUEST', message: 'role must be ADMIN or TEACHER' },
          })
      )
    );

    component.setRole({ teacherId: 89, username: 'teacher89' }, 'ADMIN');

    expect(component.actionError).toContain('role must be ADMIN or TEACHER');
  });

  it('toggleAdminRole should switch ADMIN to TEACHER', () => {
    (api.updateTeacherRole as any).mockReturnValue(
      of({
        username: 'teacher50',
        role: 'TEACHER',
      })
    );

    component.toggleAdminRole({ teacherId: 50, username: 'teacher50', role: 'ADMIN' });

    expect(api.updateTeacherRole).toHaveBeenCalledWith(50, 'TEACHER');
    expect(component.roleResult?.role).toBe('TEACHER');
  });

  it('setTeacherStatus should call API and update status result', () => {
    (api.updateTeacherStatus as any).mockReturnValue(
      of({
        username: 'teacher61',
        status: 'ARCHIVED',
      })
    );

    component.setTeacherStatus({ teacherId: 61, username: 'teacher61', status: 'ACTIVE' }, 'ARCHIVED');

    expect(api.updateTeacherStatus).toHaveBeenCalledWith(61, 'ARCHIVED');
    expect(component.statusResult).toEqual({
      teacherId: 61,
      username: 'teacher61',
      status: 'ARCHIVED',
    });
  });

  it('toggleArchiveStatus should switch ARCHIVED to ACTIVE', () => {
    (api.updateTeacherStatus as any).mockReturnValue(
      of({
        username: 'teacher62',
        status: 'ACTIVE',
      })
    );

    component.toggleArchiveStatus({ teacherId: 62, username: 'teacher62', status: 'ARCHIVED' });

    expect(api.updateTeacherStatus).toHaveBeenCalledWith(62, 'ACTIVE');
    expect(component.statusResult?.status).toBe('ACTIVE');
  });
});
