import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { StudentManagementComponent } from './student-management.component';
import { StudentManagementService } from '../../services/student-management.service';
import { StudentInviteService } from '../../services/student-invite.service';
import { StudentProfileService } from '../../services/student-profile.service';

describe('StudentManagementComponent', () => {
  let component: StudentManagementComponent;
  let api: Pick<
    StudentManagementService,
    'listStudents' | 'resetStudentPassword' | 'updateStudentStatus'
  >;
  let inviteApi: Pick<StudentInviteService, 'createInvite'>;
  let profileApi: Pick<StudentProfileService, 'getStudentProfileForTeacher'>;

  beforeEach(() => {
    api = {
      listStudents: vi.fn().mockReturnValue(of([])),
      resetStudentPassword: vi.fn(),
      updateStudentStatus: vi.fn(),
    };
    inviteApi = {
      createInvite: vi.fn(),
    };
    profileApi = {
      getStudentProfileForTeacher: vi.fn().mockReturnValue(of({})),
    };

    component = new StudentManagementComponent(
      api as StudentManagementService,
      profileApi as StudentProfileService,
      inviteApi as StudentInviteService
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

  it('loadStudents should normalize email and phone from alternative field names', () => {
    (api.listStudents as any).mockReturnValue(
      of([
        {
          studentId: 22,
          username: 'student22',
          emailAddress: 'student22@example.com',
          phoneNumber: '1234567890',
        },
      ])
    );

    component.loadStudents();

    expect(component.students).toEqual([
      expect.objectContaining({
        studentId: 22,
        username: 'student22',
        email: 'student22@example.com',
        phone: '1234567890',
        status: 'ACTIVE',
      }),
    ]);

    component.searchKeyword = '1234567890';
    component.applyListView();
    expect(component.filteredCount).toBe(1);
  });

  it('loadStudents should hydrate email and phone from profile API when list payload misses both', () => {
    (api.listStudents as any).mockReturnValue(
      of([
        {
          studentId: 31,
          username: 'student31',
        },
      ])
    );
    (profileApi.getStudentProfileForTeacher as any).mockReturnValue(
      of({
        profile: {
          email: 'student31@example.com',
          phone: '6470000000',
        },
      })
    );

    component.loadStudents();

    expect(profileApi.getStudentProfileForTeacher).toHaveBeenCalledWith(31);
    expect(component.students).toEqual([
      expect.objectContaining({
        studentId: 31,
        username: 'student31',
        email: 'student31@example.com',
        phone: '6470000000',
      }),
    ]);
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

  it('applyListView should filter by current school country and include N/A in Canada', () => {
    component.students = [
      {
        studentId: 1,
        username: 'ca_student',
        displayName: 'CA Student',
        status: 'ACTIVE',
        currentSchoolCountry: 'Canada',
      },
      {
        studentId: 2,
        username: 'cn_student',
        displayName: 'CN Student',
        status: 'ACTIVE',
        currentSchoolCountry: '中国',
      },
      {
        studentId: 3,
        username: 'us_student',
        displayName: 'US Student',
        status: 'ACTIVE',
        schools: [{ schoolType: 'MAIN', country: 'United States' }],
      },
      { studentId: 4, username: 'na_student', displayName: 'NA Student', status: 'ACTIVE' },
    ];

    component.onCountryFilterInputChange('Canada');
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([1, 4]);

    component.onCountryFilterInputChange('中国');
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([2]);

    component.onCountryFilterInputChange('United States');
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([3]);

    component.onCountryFilterInputChange('N/A 尚未填写');
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([4]);
  });

  it('country filter options should prioritize Canada, China and United States', () => {
    expect(component.countryFilterOptions.slice(0, 3)).toEqual([
      'Canada',
      '中国 / China (Mainland)',
      'United States',
    ]);
  });

  it('clearListControls should reset country filter to ALL', () => {
    component.listLimit = 100;
    component.showInactive = true;
    component.searchKeyword = 'alice';
    component.countryFilterInput = 'United States';
    component.countryFilter = 'United States';

    component.clearListControls();

    expect(component.listLimit).toBe(20);
    expect(component.showInactive).toBe(false);
    expect(component.searchKeyword).toBe('');
    expect(component.countryFilterInput).toBe('全部国家');
    expect(component.countryFilter).toBe('ALL');
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
    expect(inviteApi.createInvite).toHaveBeenCalledWith();
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
