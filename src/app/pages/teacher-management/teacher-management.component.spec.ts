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

  it('setRole should show backend-unavailable error on 404 without code', () => {
    (api.updateTeacherRole as any).mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 404,
            error: { status: 404, message: 'Not Found' },
          })
      )
    );

    component.setRole({ teacherId: 77, username: 'teacher77' }, 'ADMIN');

    expect(component.actionError).toContain('Backend role switch API is not available yet');
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
