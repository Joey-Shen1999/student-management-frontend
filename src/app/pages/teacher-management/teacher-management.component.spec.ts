import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { TeacherManagementComponent } from './teacher-management.component';
import { TeacherManagementService } from '../../services/teacher-management.service';

describe('TeacherManagementComponent', () => {
  let component: TeacherManagementComponent;
  let api: Pick<TeacherManagementService, 'listTeachers' | 'resetTeacherPassword' | 'updateTeacherRole'>;

  beforeEach(() => {
    api = {
      listTeachers: vi.fn().mockReturnValue(of([])),
      resetTeacherPassword: vi.fn(),
      updateTeacherRole: vi.fn(),
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

    expect(component.teachers).toEqual([{ teacherId: 11, username: 'teacher11' }]);
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
    expect(component.actionError).toBe('Missing teacher id, unable to reset password.');
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
});
