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

    component.onCountryFilterInputChange('N/A');
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([4]);
  });

  it('country filter options should place N/A and All first, then core countries', () => {
    expect(component.countryFilterOptions.slice(0, 5)).toEqual([
      'N/A',
      'All',
      'Canada',
      'China (mainland)',
      'United States',
    ]);
  });

  it('clearListControls should reset country filter to ALL', () => {
    component.listLimit = 100;
    component.showInactive = true;
    component.searchKeyword = 'alice';
    component.countryFilterInput = 'United States';
    component.countryFilter = 'United States';
    component.provinceFilterInput = 'California';
    component.provinceFilter = 'California';
    component.cityFilterInput = 'Los Angeles';
    component.cityFilter = 'Los Angeles';

    component.clearListControls();

    expect(component.listLimit).toBe(20);
    expect(component.showInactive).toBe(false);
    expect(component.searchKeyword).toBe('');
    expect(component.countryFilterInput).toBe('');
    expect(component.countryFilter).toBe('ALL');
    expect(component.provinceFilterInput).toBe('');
    expect(component.provinceFilter).toBe('');
    expect(component.cityFilterInput).toBe('');
    expect(component.cityFilter).toBe('');
  });

  it('country filter input should stay empty when cleared instead of restoring All text', () => {
    component.onCountryFilterInputChange('All');
    component.onCountryFilterInputChange('Al');
    component.onCountryFilterInputChange('A');
    expect(component.countryFilterInput).toBe('A');

    component.onCountryFilterInputChange('');
    expect(component.countryFilterInput).toBe('');
    expect(component.countryFilter).toBe('ALL');
  });

  it('country filter should expose province options for Canada, China and United States only', () => {
    component.onCountryFilterInputChange('Canada');
    expect(component.provinceFilterCountry).toBe('Canada');
    expect(component.provinceFilterOptions.slice(0, 4)).toEqual([
      'Ontario',
      'British Columbia',
      'Alberta',
      'Quebec',
    ]);

    component.onCountryFilterInputChange('China');
    expect(component.provinceFilterCountry).toBe('China (mainland)');
    expect(component.provinceFilterOptions).toContain('Guangdong');

    component.onCountryFilterInputChange('United States');
    expect(component.provinceFilterCountry).toBe('United States');
    expect(component.provinceFilterOptions).toContain('California');

    component.onCountryFilterInputChange('Japan');
    expect(component.provinceFilterCountry).toBe('');
    expect(component.provinceFilterOptions).toEqual([]);
  });

  it('city options should match selected province', () => {
    component.students = [
      {
        studentId: 101,
        username: 'ca_toronto',
        displayName: 'CA Toronto',
        status: 'ACTIVE',
        currentSchoolCountry: 'Canada',
        currentSchoolProvince: 'Ontario',
        currentSchoolCity: 'Toronto',
      },
      {
        studentId: 102,
        username: 'ca_vancouver',
        displayName: 'CA Vancouver',
        status: 'ACTIVE',
        currentSchoolCountry: 'Canada',
        currentSchoolProvince: 'British Columbia',
        currentSchoolCity: 'Vancouver',
      },
      {
        studentId: 103,
        username: 'cn_guangzhou',
        displayName: 'CN Guangzhou',
        status: 'ACTIVE',
        currentSchoolCountry: 'China (mainland)',
        currentSchoolProvince: 'Guangdong',
        currentSchoolCity: 'Guangzhou',
      },
      {
        studentId: 104,
        username: 'us_losangeles',
        displayName: 'US Los Angeles',
        status: 'ACTIVE',
        currentSchoolCountry: 'United States',
        currentSchoolProvince: 'California',
        currentSchoolCity: 'Los Angeles',
      },
    ];

    component.onCountryFilterInputChange('Canada');
    component.onProvinceFilterInputChange('Ontario');
    expect(component.cityFilterCountry).toBe('Canada');
    expect(component.cityFilterOptions).toEqual(['Toronto']);

    component.onProvinceFilterInputChange('British Columbia');
    expect(component.cityFilterOptions).toEqual(['Vancouver']);

    component.onCountryFilterInputChange('China');
    component.onProvinceFilterInputChange('Guangdong');
    expect(component.cityFilterCountry).toBe('China (mainland)');
    expect(component.cityFilterOptions).toEqual(['Guangzhou']);

    component.onCountryFilterInputChange('United States');
    component.onProvinceFilterInputChange('California');
    expect(component.cityFilterCountry).toBe('United States');
    expect(component.cityFilterOptions).toEqual(['Los Angeles']);

    component.onCountryFilterInputChange('Japan');
    expect(component.cityFilterCountry).toBe('');
    expect(component.cityFilterOptions).toEqual([]);
  });

  it('city filter options should include dynamic cities from loaded student data', () => {
    component.students = [
      {
        studentId: 21,
        username: 'us_austin',
        displayName: 'US Austin',
        status: 'ACTIVE',
        currentSchoolCountry: 'United States',
        currentSchoolProvince: 'Texas',
        currentSchoolCity: 'Austin',
      },
    ];

    component.onCountryFilterInputChange('United States');
    component.onProvinceFilterInputChange('Texas');
    expect(component.cityFilterOptions).toContain('Austin');
  });

  it('province change should clear city filter', () => {
    component.onCountryFilterInputChange('Canada');
    component.onProvinceFilterInputChange('Ontario');
    component.onCityFilterInputChange('Toronto');
    expect(component.cityFilterInput).toBe('Toronto');
    expect(component.cityFilter).toBe('Toronto');

    component.onProvinceFilterInputChange('Quebec');
    expect(component.cityFilterInput).toBe('');
    expect(component.cityFilter).toBe('');
  });

  it('city filter should stay empty when province is not selected', () => {
    component.students = [
      {
        studentId: 41,
        username: 'ca_toronto',
        displayName: 'CA Toronto',
        status: 'ACTIVE',
        currentSchoolCountry: 'Canada',
        currentSchoolProvince: 'Ontario',
        currentSchoolCity: 'Toronto',
      },
      {
        studentId: 42,
        username: 'ca_vancouver',
        displayName: 'CA Vancouver',
        status: 'ACTIVE',
        currentSchoolCountry: 'Canada',
        currentSchoolProvince: 'British Columbia',
        currentSchoolCity: 'Vancouver',
      },
    ];

    component.onCountryFilterInputChange('Canada');
    component.onCityFilterInputChange('Toronto');

    expect(component.cityFilter).toBe('');
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([41, 42]);
  });

  it('province filter should support BC and AB aliases for Canada', () => {
    component.students = [
      {
        studentId: 31,
        username: 'ca_bc',
        displayName: 'CA BC',
        status: 'ACTIVE',
        currentSchoolCountry: 'Canada',
        currentSchoolProvince: 'British Columbia',
      },
      {
        studentId: 32,
        username: 'ca_ab',
        displayName: 'CA AB',
        status: 'ACTIVE',
        currentSchoolCountry: 'Canada',
        currentSchoolProvince: 'Alberta',
      },
    ];

    component.onCountryFilterInputChange('Canada');
    component.onProvinceFilterInputChange('BC');
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([31]);

    component.onProvinceFilterInputChange('ab');
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([32]);
  });

  it('applyListView should filter by province when country supports province options', () => {
    component.students = [
      {
        studentId: 1,
        username: 'ca_on_student',
        displayName: 'ON Student',
        status: 'ACTIVE',
        currentSchoolCountry: 'Canada',
        currentSchoolProvince: 'Ontario',
        currentSchoolCity: 'Toronto',
      },
      {
        studentId: 2,
        username: 'ca_bc_student',
        displayName: 'BC Student',
        status: 'ACTIVE',
        currentSchoolCountry: 'Canada',
        currentSchoolProvince: 'British Columbia',
        currentSchoolCity: 'Vancouver',
      },
      {
        studentId: 3,
        username: 'us_ca_student',
        displayName: 'US-CA Student',
        status: 'ACTIVE',
        currentSchoolCountry: 'United States',
        currentSchoolProvince: 'California',
        currentSchoolCity: 'Los Angeles',
      },
    ];

    component.onCountryFilterInputChange('Canada');
    component.onProvinceFilterInputChange('Ontario');
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([1]);

    component.onCountryFilterInputChange('United States');
    expect(component.provinceFilterInput).toBe('');
    expect(component.provinceFilter).toBe('');
    component.onProvinceFilterInputChange('California');
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([3]);
  });

  it('applyListView should filter by city when country supports city options', () => {
    component.students = [
      {
        studentId: 11,
        username: 'ca_toronto',
        displayName: 'CA Toronto',
        status: 'ACTIVE',
        currentSchoolCountry: 'Canada',
        currentSchoolProvince: 'Ontario',
        currentSchoolCity: 'Toronto',
      },
      {
        studentId: 12,
        username: 'ca_vancouver',
        displayName: 'CA Vancouver',
        status: 'ACTIVE',
        currentSchoolCountry: 'Canada',
        currentSchoolProvince: 'British Columbia',
        currentSchoolCity: 'Vancouver',
      },
      {
        studentId: 13,
        username: 'us_newyork',
        displayName: 'US New York',
        status: 'ACTIVE',
        currentSchoolCountry: 'United States',
        currentSchoolProvince: 'New York',
        currentSchoolCity: 'New York',
      },
    ];

    component.onCountryFilterInputChange('Canada');
    component.onProvinceFilterInputChange('Ontario');
    component.onCityFilterInputChange('Toronto');
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([11]);

    component.onCountryFilterInputChange('United States');
    expect(component.cityFilterInput).toBe('');
    expect(component.cityFilter).toBe('');
    component.onProvinceFilterInputChange('New York');
    component.onCityFilterInputChange('New York');
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([13]);
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
