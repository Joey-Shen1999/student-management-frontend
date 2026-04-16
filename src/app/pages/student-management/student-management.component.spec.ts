import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { StudentManagementComponent } from './student-management.component';
import { StudentManagementService } from '../../services/student-management.service';
import { StudentInviteService } from '../../services/student-invite.service';
import { StudentProfileService } from '../../services/student-profile.service';
import { AuthService } from '../../services/auth.service';
import { IeltsTrackingService } from '../../services/ielts-tracking.service';
import { OssltTrackingService } from '../../services/osslt-tracking.service';
import { VolunteerTrackingService } from '../../services/volunteer-tracking.service';
import { TeacherPreferenceService } from '../../services/teacher-preference.service';

describe('StudentManagementComponent', () => {
  let component: StudentManagementComponent;
  let api: Pick<
    StudentManagementService,
    'listStudents' | 'resetStudentPassword' | 'updateStudentStatus'
  >;
  let inviteApi: Pick<StudentInviteService, 'createInvite'>;
  let profileApi: Pick<StudentProfileService, 'getStudentProfileForTeacher' | 'saveStudentProfileForTeacher'>;
  let auth: Pick<AuthService, 'getSession' | 'getCurrentUserId' | 'getAuthorizationHeaderValue'>;
  let router: { url: string };
  let ieltsApi: Pick<IeltsTrackingService, 'getTeacherStudentIeltsModuleState' | 'updateTeacherStudentIeltsData'>;
  let ossltApi: Pick<
    OssltTrackingService,
    'getTeacherStudentOssltModuleState' | 'updateTeacherStudentOssltData'
  >;
  let volunteerApi: Pick<
    VolunteerTrackingService,
    'getTeacherStudentVolunteerTracking' | 'getTeacherStudentsVolunteerBatchSummary'
  >;
  let preferenceApi: Pick<TeacherPreferenceService, 'getPagePreference' | 'upsertPagePreference'>;

  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage?.clear();
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
      saveStudentProfileForTeacher: vi.fn().mockReturnValue(of({})),
    };
    auth = {
      getSession: vi.fn().mockReturnValue({ userId: 1, teacherId: 1 }),
      getCurrentUserId: vi.fn().mockReturnValue(1),
      getAuthorizationHeaderValue: vi.fn().mockReturnValue('Bearer token-1'),
    };
    router = {
      url: '/teacher/students',
    };
    ieltsApi = {
      getTeacherStudentIeltsModuleState: vi.fn().mockReturnValue(
        of({
          studentId: 1,
          graduationYear: 2027,
          hasTakenIeltsAcademic: null,
          preparationIntent: 'UNSET',
          languageTrackingManualStatus: null,
          records: [],
          languageRisk: {
            shouldShowIeltsModule: true,
          },
          updatedAt: null,
        })
      ),
      updateTeacherStudentIeltsData: vi.fn().mockImplementation((studentId: number, payload: any) =>
        of({
          studentId,
          graduationYear: 2027,
          hasTakenIeltsAcademic: true,
          preparationIntent: 'UNSET',
          languageTrackingManualStatus: payload?.languageTrackingManualStatus ?? 'NEEDS_TRACKING',
          records: [],
          languageRisk: {
            shouldShowIeltsModule: true,
          },
          updatedAt: null,
        })
      ),
    };
    ossltApi = {
      getTeacherStudentOssltModuleState: vi.fn().mockReturnValue(
        of({
          studentId: 1,
          graduationYear: 2027,
          latestOssltResult: 'UNKNOWN',
          latestOssltDate: null,
          hasOsslc: null,
          ossltTrackingManualStatus: null,
          updatedAt: null,
        })
      ),
      updateTeacherStudentOssltData: vi.fn().mockImplementation((studentId: number, payload: any) =>
        of({
          studentId,
          graduationYear: 2027,
          latestOssltResult: payload?.latestOssltResult ?? 'UNKNOWN',
          latestOssltDate: payload?.latestOssltDate ?? null,
          hasOsslc: payload?.hasOsslc ?? null,
          ossltTrackingManualStatus: payload?.ossltTrackingManualStatus ?? 'NEEDS_TRACKING',
          updatedAt: null,
        })
      ),
    };
    volunteerApi = {
      getTeacherStudentVolunteerTracking: vi.fn().mockReturnValue(
        of({
          studentId: 1,
          records: [],
        })
      ),
      getTeacherStudentsVolunteerBatchSummary: vi.fn().mockReturnValue(of([])),
    };
    preferenceApi = {
      getPagePreference: vi.fn().mockReturnValue(of({})),
      upsertPagePreference: vi.fn().mockReturnValue(of({})),
    };

    component = new StudentManagementComponent(
      api as StudentManagementService,
      profileApi as StudentProfileService,
      inviteApi as StudentInviteService,
      auth as AuthService,
      router as Router,
      ieltsApi as IeltsTrackingService,
      ossltApi as OssltTrackingService,
      volunteerApi as VolunteerTrackingService,
      preferenceApi as TeacherPreferenceService
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

  it('loadStudents should hydrate email, phone and graduation from profile API when list payload misses both', () => {
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
          schools: [{ schoolType: 'MAIN', endTime: '2026-06-30' }],
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
        currentSchoolExpectedGraduation: '2026-06-30',
      }),
    ]);
    expect(component.resolveStudentGraduation(component.students[0])).toBe('2026年6月');
  });

  it('resolveStudentGraduation should format chinese month text', () => {
    const student = {
      studentId: 77,
      username: 'student77',
      currentSchoolExpectedGraduation: '2027年六月',
    } as any;

    expect(component.resolveStudentGraduation(student)).toBe('2027年6月');
  });

  it('openTeacherNote should load teacher-only note from teacher profile', () => {
    (profileApi.getStudentProfileForTeacher as any).mockReturnValue(
      of({
        profile: {
          teacherNote: '内部备注 A',
        },
      })
    );

    component.openTeacherNote({ studentId: 52, username: 'student52' });

    expect(profileApi.getStudentProfileForTeacher).toHaveBeenCalledWith(52);
    expect(component.selectedNoteStudentId).toBe(52);
    expect(component.teacherNoteDraft).toBe('内部备注 A');
  });

  it('applyListView should prefetch visible teacher notes without requiring focus', () => {
    (profileApi.getStudentProfileForTeacher as any).mockImplementation((studentId: number) =>
      of({
        profile: {
          teacherNote: `note-${studentId}`,
        },
      })
    );
    component.students = [
      { studentId: 201, username: 'student201', status: 'ACTIVE' } as any,
      { studentId: 202, username: 'student202', status: 'ACTIVE' } as any,
    ];

    component.applyListView();

    expect(profileApi.getStudentProfileForTeacher).toHaveBeenCalledWith(201);
    expect(profileApi.getStudentProfileForTeacher).toHaveBeenCalledWith(202);
    expect(component.resolveTeacherNoteCellValue(component.students[0] as any)).toBe('note-201');
    expect(component.resolveTeacherNoteCellValue(component.students[1] as any)).toBe('note-202');
  });

  it('saveTeacherNote should persist note via teacher profile API', () => {
    (profileApi.getStudentProfileForTeacher as any).mockReturnValue(
      of({
        profile: {
          legalFirstName: 'Demo',
        },
      })
    );
    (profileApi.saveStudentProfileForTeacher as any).mockReturnValue(
      of({
        profile: {
          teacherNote: 'Follow up in April',
        },
      })
    );

    component.openTeacherNote({ studentId: 53, username: 'student53' });
    component.teacherNoteDraft = 'Follow up in April';
    component.saveTeacherNote();

    expect(profileApi.saveStudentProfileForTeacher).toHaveBeenCalledWith(
      53,
      expect.objectContaining({
        teacherNote: 'Follow up in April',
      })
    );
    expect(component.teacherNoteSuccess).toBe('备注已保存。');
  });

  it('onServiceItemSelectionChange should persist service items via teacher profile API', () => {
    (profileApi.getStudentProfileForTeacher as any).mockReturnValue(
      of({
        profile: {
          legalFirstName: 'Demo',
          serviceItems: ['A: 面试辅导'],
        },
      })
    );
    (profileApi.saveStudentProfileForTeacher as any).mockReturnValue(
      of({
        profile: {
          serviceItems: ['面试辅导', '一对一辅导'],
        },
      })
    );

    const student = { studentId: 54, username: 'student54', status: 'ACTIVE' } as any;
    component.onServiceItemSelectionChange(student, '一对一辅导', true);

    expect(profileApi.saveStudentProfileForTeacher).toHaveBeenCalledWith(
      54,
      expect.objectContaining({
        serviceItems: ['面试辅导', '一对一辅导'],
        serviceProjects: ['面试辅导', '一对一辅导'],
      })
    );
    expect(component.resolveStudentServiceItems(student)).toBe('面试辅导、一对一辅导');
    expect(component.resolveServiceItemsCountLabel(student)).toBe('2项');
  });

  it('onServiceItemSelectionChange should omit school collections from quick service item save', () => {
    (profileApi.getStudentProfileForTeacher as any).mockReturnValue(
      of({
        profile: {
          legalFirstName: 'Demo',
          legalLastName: 'Student',
          ap: false,
          serviceItems: ['Tutoring'],
          schools: [
            {
              schoolRecordId: 101,
              schoolType: 'MAIN',
              schoolName: 'A High School',
              startTime: '2023-09-01',
            },
            {
              schoolRecordId: 102,
              schoolType: 'MAIN',
              schoolName: 'A High School',
              startTime: '2023-09-01',
            },
          ],
          schoolRecords: [
            {
              schoolRecordId: 101,
              schoolType: 'MAIN',
              schoolName: 'A High School',
              startTime: '2023-09-01',
            },
          ],
          highSchools: [
            {
              schoolRecordId: 103,
              schoolType: 'OTHER',
              schoolName: 'Legacy High School',
            },
          ],
          identityFiles: [{ id: 7, identityFileName: 'passport.pdf' }],
          otherCourses: [{ schoolName: 'Online Provider', courseCode: 'ENG4U' }],
        },
      })
    );

    const student = { studentId: 55, username: 'student55', status: 'ACTIVE' } as any;
    component.onServiceItemSelectionChange(student, 'Planning', true);

    const payload = (profileApi.saveStudentProfileForTeacher as any).mock.calls[0][1];
    expect(payload.serviceItems).toEqual(['Tutoring', 'Planning']);
    expect(payload.serviceProjects).toEqual(['Tutoring', 'Planning']);
    expect(payload.schools).toBeUndefined();
    expect(payload.schoolRecords).toBeUndefined();
    expect(payload.highSchools).toBeUndefined();
    expect(payload.identityFiles).toBeUndefined();
    expect(payload.otherCourses).toEqual([{ schoolName: 'Online Provider', courseCode: 'ENG4U' }]);
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
    component.schoolBoardFilterInput = 'Toronto District School Board';
    component.schoolBoardFilter = 'Toronto District School Board';
    component.graduationSeasonFilterInput = '2026 Fall';
    component.graduationSeasonFilter = '2026 Fall';
    component.languageScoreFilter = 'GREEN_STRICT_PASS';
    component.languageScoreTrackingFilter = 'AUTO_PASS_ALL_SCHOOLS';
    component.ossltResultFilter = 'PASS';
    component.ossltTrackingFilter = 'PASSED';
    component.volunteerCompletedFilter = true;

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
    expect(component.schoolBoardFilterInput).toBe('');
    expect(component.schoolBoardFilter).toBe('');
    expect(component.graduationSeasonFilterInput).toBe('');
    expect(component.graduationSeasonFilter).toBe('');
    expect(component.languageScoreFilter).toBe('');
    expect(component.languageScoreTrackingFilter).toBe('');
    expect(component.ossltResultFilter).toBe('');
    expect(component.ossltTrackingFilter).toBe('');
    expect(component.volunteerCompletedFilter).toBe(false);
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

  it('filter panel should be collapsed by default and support toggle', () => {
    expect(component.isFilterPanelExpanded).toBe(false);

    component.toggleFilterPanel();
    expect(component.isFilterPanelExpanded).toBe(true);

    component.toggleFilterPanel();
    expect(component.isFilterPanelExpanded).toBe(false);
  });

  it('province options should be available without selecting country first', () => {
    expect(component.provinceFilterCountry).toBe('');
    expect(component.provinceFilterOptions).toContain('Ontario');
    expect(component.provinceFilterOptions).toContain('Guangdong');
    expect(component.provinceFilterOptions).toContain('California');

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
    expect(component.provinceFilterOptions).toContain('Ontario');
    expect(component.provinceFilterOptions).toContain('California');
  });

  it('city options should be available without selecting province and can narrow by country', () => {
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

    expect(component.cityFilterCountry).toBe('');
    expect(component.cityFilterOptions).toContain('Toronto');
    expect(component.cityFilterOptions).toContain('Guangzhou');
    expect(component.cityFilterOptions).toContain('Los Angeles');

    component.onCountryFilterInputChange('Canada');
    expect(component.cityFilterCountry).toBe('Canada');
    expect(component.cityFilterOptions).toContain('Toronto');
    expect(component.cityFilterOptions).toContain('Vancouver');
    expect(component.cityFilterOptions).not.toContain('Guangzhou');

    component.onCountryFilterInputChange('China');
    expect(component.cityFilterCountry).toBe('China (mainland)');
    expect(component.cityFilterOptions).toContain('Guangzhou');
    expect(component.cityFilterOptions).not.toContain('Los Angeles');

    component.onCountryFilterInputChange('United States');
    expect(component.cityFilterCountry).toBe('United States');
    expect(component.cityFilterOptions).toContain('Los Angeles');
    expect(component.cityFilterOptions).not.toContain('Guangzhou');

    component.onCountryFilterInputChange('Japan');
    expect(component.cityFilterCountry).toBe('');
    expect(component.cityFilterOptions).toContain('Toronto');
    expect(component.cityFilterOptions).toContain('Guangzhou');
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

  it('province change should keep city filter selection', () => {
    component.onCountryFilterInputChange('Canada');
    component.onProvinceFilterInputChange('Ontario');
    component.onCityFilterInputChange('Toronto');
    expect(component.cityFilterInput).toBe('Toronto');
    expect(component.cityFilter).toBe('Toronto');

    component.onProvinceFilterInputChange('Quebec');
    expect(component.cityFilterInput).toBe('Toronto');
    expect(component.cityFilter).toBe('Toronto');
  });

  it('city filter should work even when province is not selected', () => {
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

    expect(component.cityFilter).toBe('Toronto');
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([41]);
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

  it('applyListView should filter by province without requiring country selection', () => {
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

    component.onProvinceFilterInputChange('Ontario');
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([1]);

    component.onCountryFilterInputChange('Canada');
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([1]);

    component.onCountryFilterInputChange('United States');
    expect(component.provinceFilterInput).toBe('Ontario');
    expect(component.provinceFilter).toBe('Ontario');
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
    expect(component.cityFilterInput).toBe('Toronto');
    expect(component.cityFilter).toBe('Toronto');
    component.onProvinceFilterInputChange('');
    component.onCityFilterInputChange('New York');
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([13]);
  });

  it('applyListView should filter by graduation season', () => {
    component.students = [
      {
        studentId: 31,
        username: 'fall_student',
        displayName: 'Fall Student',
        status: 'ACTIVE',
        currentSchoolExpectedGraduation: '2026-09-15',
      },
      {
        studentId: 32,
        username: 'winter_student',
        displayName: 'Winter Student',
        status: 'ACTIVE',
        currentSchoolExpectedGraduation: '2026-02-10',
      },
    ];

    component.onGraduationSeasonFilterInputChange('2026 Fall');
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([31]);

    component.onGraduationSeasonFilterInputChange('2026 Winter');
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([32]);
  });

  it('graduation season filter should support chinese aliases and provide range options', () => {
    component.students = [
      {
        studentId: 41,
        username: 'alias_student',
        displayName: 'Alias Student',
        status: 'ACTIVE',
        currentSchoolExpectedGraduation: '2026-10-01',
      },
    ];

    component.onGraduationSeasonFilterInputChange('2026 秋季');
    expect(component.graduationSeasonFilter).toBe('2026 Fall');
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([41]);

    expect(component.graduationSeasonFilterOptions).toContain('2030 Winter');
    expect(component.graduationSeasonFilterOptions).toContain('2025 Fall');
    expect(component.graduationSeasonFilterOptions).not.toContain('2024 Fall');
  });

  it('school board filter options should include all currently filterable students boards', () => {
    component.students = [
      {
        studentId: 51,
        username: 'ca_tdsb',
        displayName: 'CA TDSB',
        status: 'ACTIVE',
        currentSchoolCountry: 'Canada',
        currentSchoolProvince: 'Ontario',
        currentSchoolCity: 'Toronto',
        currentSchoolBoard: 'Toronto District School Board',
      },
      {
        studentId: 52,
        username: 'ca_yrdsb',
        displayName: 'CA YRDSB',
        status: 'ACTIVE',
        currentSchoolCountry: 'Canada',
        currentSchoolProvince: 'Ontario',
        currentSchoolCity: 'Toronto',
        currentSchoolBoard: 'York Region District School Board',
      },
      {
        studentId: 53,
        username: 'us_lausd',
        displayName: 'US LAUSD',
        status: 'ACTIVE',
        currentSchoolCountry: 'United States',
        currentSchoolProvince: 'California',
        currentSchoolCity: 'Los Angeles',
        currentSchoolBoard: 'Los Angeles Unified School District',
      },
    ];

    expect(component.schoolBoardFilterOptions).toContain('Toronto District School Board');
    expect(component.schoolBoardFilterOptions).toContain('York Region District School Board');
    expect(component.schoolBoardFilterOptions).toContain('Los Angeles Unified School District');

    component.onCountryFilterInputChange('Canada');
    component.onProvinceFilterInputChange('Ontario');
    component.onCityFilterInputChange('Toronto');
    expect(component.schoolBoardFilterOptions).toContain('Toronto District School Board');
    expect(component.schoolBoardFilterOptions).toContain('York Region District School Board');
  });

  it('applyListView should filter by school board', () => {
    component.students = [
      {
        studentId: 61,
        username: 'ca_tdsb',
        displayName: 'CA TDSB',
        status: 'ACTIVE',
        currentSchoolCountry: 'Canada',
        currentSchoolProvince: 'Ontario',
        currentSchoolCity: 'Toronto',
        currentSchoolBoard: 'Toronto District School Board',
      },
      {
        studentId: 62,
        username: 'ca_yrdsb',
        displayName: 'CA YRDSB',
        status: 'ACTIVE',
        currentSchoolCountry: 'Canada',
        currentSchoolProvince: 'Ontario',
        currentSchoolCity: 'Toronto',
        currentSchoolBoard: 'York Region District School Board',
      },
    ];

    component.onSchoolBoardFilterInputChange('Toronto District School Board');
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([61]);
  });

  it('province change should clear school board filter when selected board is out of scope', () => {
    component.students = [
      {
        studentId: 71,
        username: 'ca_tdsb',
        displayName: 'CA TDSB',
        status: 'ACTIVE',
        currentSchoolCountry: 'Canada',
        currentSchoolProvince: 'Ontario',
        currentSchoolCity: 'Toronto',
        currentSchoolBoard: 'Toronto District School Board',
      },
      {
        studentId: 72,
        username: 'ca_vsb',
        displayName: 'CA VSB',
        status: 'ACTIVE',
        currentSchoolCountry: 'Canada',
        currentSchoolProvince: 'British Columbia',
        currentSchoolCity: 'Vancouver',
        currentSchoolBoard: 'Vancouver School Board',
      },
    ];

    component.onCountryFilterInputChange('Canada');
    component.onProvinceFilterInputChange('Ontario');
    component.onCityFilterInputChange('Toronto');
    component.onSchoolBoardFilterInputChange('Toronto District School Board');
    expect(component.schoolBoardFilterInput).toBe('Toronto District School Board');
    expect(component.schoolBoardFilter).toBe('Toronto District School Board');

    component.onProvinceFilterInputChange('British Columbia');
    expect(component.schoolBoardFilterInput).toBe('');
    expect(component.schoolBoardFilter).toBe('');
    expect(component.schoolBoardFilterOptions).not.toContain('Vancouver School Board');
    component.onCityFilterInputChange('Vancouver');
    expect(component.schoolBoardFilterOptions).toContain('Vancouver School Board');
  });

  it('country change should keep school board filter when board is still in current scope', () => {
    component.students = [
      {
        studentId: 81,
        username: 'ca_global',
        displayName: 'CA Global',
        status: 'ACTIVE',
        currentSchoolCountry: 'Canada',
        currentSchoolProvince: 'Ontario',
        currentSchoolCity: 'Toronto',
        currentSchoolBoard: 'Global School Board',
      },
      {
        studentId: 82,
        username: 'us_global',
        displayName: 'US Global',
        status: 'ACTIVE',
        currentSchoolCountry: 'United States',
        currentSchoolProvince: 'California',
        currentSchoolCity: 'Los Angeles',
        currentSchoolBoard: 'Global School Board',
      },
    ];

    component.onSchoolBoardFilterInputChange('Global School Board');
    expect(component.schoolBoardFilter).toBe('Global School Board');

    component.onCountryFilterInputChange('United States');
    expect(component.schoolBoardFilterInput).toBe('Global School Board');
    expect(component.schoolBoardFilter).toBe('Global School Board');
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([82]);
  });

  it('school board options should resolve from nested school object in school records', () => {
    component.students = [
      {
        studentId: 91,
        username: 'nested_board_student',
        displayName: 'Nested Board Student',
        status: 'ACTIVE',
        schoolRecords: [
          {
            schoolType: 'MAIN',
            school: {
              boardName: 'Toronto District School Board',
              address: {
                country: 'Canada',
                province: 'Ontario',
                city: 'Toronto',
              },
            },
          },
        ],
      } as any,
    ];

    expect(component.schoolBoardFilterOptions).toContain('Toronto District School Board');

    component.onSchoolBoardFilterInputChange('Toronto District School Board');
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([91]);
  });

  it('school board filter options should include preset options even when student list is empty', () => {
    component.students = [];
    expect(component.schoolBoardFilterOptions.length).toBeGreaterThan(0);
    expect(component.schoolBoardFilterOptions).toContain('私校');
  });

  it('applyListView should support language and OSSLT status filters', () => {
    component.students = [
      {
        studentId: 501,
        username: 'student501',
        status: 'ACTIVE',
        trackingStatus: 'GREEN_STRICT_PASS',
        languageScoreTrackingStatus: 'AUTO_PASS_ALL_SCHOOLS',
        latestOssltResult: 'PASS',
        ossltTrackingStatus: 'PASSED',
      },
      {
        studentId: 502,
        username: 'student502',
        status: 'ACTIVE',
        trackingStatus: 'YELLOW_NEEDS_PREPARATION',
        languageTrackingStatus: 'NEEDS_TRACKING',
        latestOssltResult: 'FAIL',
        ossltTrackingStatus: 'NEEDS_TRACKING',
      },
      {
        studentId: 503,
        username: 'student503',
        status: 'ACTIVE',
        ieltsModule: {
          summary: {
            trackingStatus: 'GREEN_COMMON_PASS_WITH_WARNING',
            languageTrackingStatus: 'AUTO_PASS_PARTIAL_SCHOOLS',
          },
        },
        ossltModule: {
          latestOssltResult: 'UNKNOWN',
          ossltTrackingStatus: 'WAITING_UPDATE',
        },
      },
    ] as any;

    component.languageScoreFilter = 'GREEN_STRICT_PASS';
    component.applyListView();
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([501]);

    component.languageScoreFilter = '';
    component.languageScoreTrackingFilter = 'AUTO_PASS_PARTIAL_SCHOOLS';
    component.applyListView();
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([503]);

    component.languageScoreTrackingFilter = '';
    component.ossltResultFilter = 'FAIL';
    component.applyListView();
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([502]);

    component.ossltResultFilter = '';
    component.ossltTrackingFilter = 'WAITING_UPDATE';
    component.applyListView();
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([503]);
  });

  it('applyListView should support volunteer completed checkbox filter by >= 40 hours', () => {
    component.students = [
      {
        studentId: 511,
        username: 'student511',
        status: 'ACTIVE',
        totalVolunteerHours: 39.9,
      },
      {
        studentId: 512,
        username: 'student512',
        status: 'ACTIVE',
        totalVolunteerHours: 40,
      },
      {
        studentId: 513,
        username: 'student513',
        status: 'ACTIVE',
        totalVolunteerHours: 45.5,
      },
    ] as any;

    component.volunteerCompletedFilter = true;
    component.applyListView();
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([512, 513]);

    component.volunteerCompletedFilter = false;
    component.applyListView();
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([511, 512, 513]);
  });

  it('volunteer completed filter should use volunteerCompleted flag directly without per-row request', () => {
    component.students = [
      {
        studentId: 514,
        username: 'student514',
        status: 'ACTIVE',
        volunteerCompleted: false,
      },
      {
        studentId: 515,
        username: 'student515',
        status: 'ACTIVE',
        volunteerCompleted: true,
      },
    ] as any;

    component.volunteerCompletedFilter = true;
    component.applyListView();

    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([515]);
    expect(volunteerApi.getTeacherStudentVolunteerTracking).not.toHaveBeenCalled();
    expect(volunteerApi.getTeacherStudentsVolunteerBatchSummary).not.toHaveBeenCalled();
  });

  it('volunteer completed filter should use batch-summary API when row does not include volunteer summary fields', () => {
    (volunteerApi.getTeacherStudentsVolunteerBatchSummary as any).mockImplementation(
      (studentIds: number[]) =>
        of([
          {
            studentId: studentIds[0],
            totalVolunteerHours: 41,
            volunteerCompleted: true,
            updatedAt: '2026-04-08T00:00:00Z',
          },
          {
            studentId: studentIds[1],
            totalVolunteerHours: 10,
            volunteerCompleted: false,
            updatedAt: '2026-04-08T00:00:00Z',
          },
        ])
    );

    component.students = [
      { studentId: 521, username: 'student521', status: 'ACTIVE' } as any,
      { studentId: 522, username: 'student522', status: 'ACTIVE' } as any,
    ];
    component.volunteerCompletedFilter = true;

    component.applyListView();

    expect(volunteerApi.getTeacherStudentsVolunteerBatchSummary).toHaveBeenCalledWith([521, 522]);
    expect(component.visibleStudents.map((student) => student.studentId)).toEqual([521]);
  });

  it('volunteer completed filter should degrade when batch-summary request is forbidden', () => {
    (volunteerApi.getTeacherStudentsVolunteerBatchSummary as any).mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403, statusText: 'Forbidden' }))
    );

    component.students = [{ studentId: 531, username: 'student531', status: 'ACTIVE' } as any];
    component.volunteerCompletedFilter = true;

    component.applyListView();

    expect(component.volunteerCompletedFilterAvailable).toBe(false);
    expect(component.volunteerCompletedFilter).toBe(false);
    expect(component.volunteerCompletedFilterError).toContain('无权限');
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

  it('column preference localStorage key should be scoped by teacher id', () => {
    const storageKey = (component as any).resolveVisibleColumnsStorageKey();
    expect(storageKey).toContain('teacher-1');
    expect(storageKey).toContain('student-management.student-list.visible-columns');
  });

  it('column preference localStorage key should be isolated by page context', () => {
    router.url = '/teacher/students';
    const studentsKey = (component as any).resolveVisibleColumnsStorageKey();
    router.url = '/teacher/osslt';
    const ossltKey = (component as any).resolveVisibleColumnsStorageKey();

    expect(studentsKey).toContain('page-students');
    expect(ossltKey).toContain('page-osslt');
    expect(studentsKey).not.toBe(ossltKey);
  });

  it('list controls localStorage key should be isolated by page context', () => {
    router.url = '/teacher/students';
    const studentsKey = (component as any).resolveListControlsStorageKey();
    router.url = '/teacher/volunteer';
    const volunteerKey = (component as any).resolveListControlsStorageKey();

    expect(studentsKey).toContain('page-students');
    expect(volunteerKey).toContain('page-volunteer');
    expect(studentsKey).not.toBe(volunteerKey);
  });

  it('should restore list controls from persisted local preference', () => {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    const isolatedAuth = {
      getSession: vi.fn().mockReturnValue({ userId: 91001, teacherId: 91001 }),
      getCurrentUserId: vi.fn().mockReturnValue(91001),
      getAuthorizationHeaderValue: vi.fn().mockReturnValue('Bearer token-91001'),
    };
    router.url = '/teacher/volunteer';
    const local = new StudentManagementComponent(
      api as StudentManagementService,
      profileApi as StudentProfileService,
      inviteApi as StudentInviteService,
      isolatedAuth as unknown as AuthService,
      router as Router,
      ieltsApi as IeltsTrackingService,
      ossltApi as OssltTrackingService,
      volunteerApi as VolunteerTrackingService,
      preferenceApi as TeacherPreferenceService
    );
    const storageKey = (local as any).resolveListControlsStorageKey();
    storage?.setItem(
      storageKey,
      JSON.stringify({
        listLimit: 50,
        showInactive: true,
        searchKeyword: 'alex',
        countryFilter: 'Canada',
        provinceFilter: 'Ontario',
        cityFilter: 'Toronto',
        schoolBoardFilter: 'Toronto District School Board',
        graduationSeasonFilter: '2026 Fall',
        languageScoreFilter: 'GREEN_STRICT_PASS',
        languageScoreTrackingFilter: 'AUTO_PASS_ALL_SCHOOLS',
        ossltResultFilter: 'PASS',
        ossltTrackingFilter: 'PASSED',
        volunteerCompletedFilter: true,
      })
    );

    local.ngOnInit();

    expect(local.listLimit).toBe(50);
    expect(local.showInactive).toBe(true);
    expect(local.searchKeyword).toBe('alex');
    expect(local.countryFilter).toBe('Canada');
    expect(local.provinceFilter).toBe('Ontario');
    expect(local.cityFilter).toBe('Toronto');
    expect(local.schoolBoardFilter).toBe('Toronto District School Board');
    expect(local.graduationSeasonFilter).toBe('2026 Fall');
    expect(local.languageScoreFilter).toBe('GREEN_STRICT_PASS');
    expect(local.languageScoreTrackingFilter).toBe('AUTO_PASS_ALL_SCHOOLS');
    expect(local.ossltResultFilter).toBe('PASS');
    expect(local.ossltTrackingFilter).toBe('PASSED');
    expect(local.volunteerCompletedFilter).toBe(true);
    storage?.removeItem(storageKey);
  });

  it('should tolerate remote preference without orderedColumnKeys and still save orderedColumnKeys', () => {
    (preferenceApi.getPagePreference as any).mockReturnValue(
      of({
        version: 'v10',
        visibleColumnKeys: [
          'name',
          'email',
          'phone',
          'graduation',
          'teacherNote',
          'profile',
          'resetPassword',
          'archive',
        ],
      })
    );

    const local = new StudentManagementComponent(
      api as StudentManagementService,
      profileApi as StudentProfileService,
      inviteApi as StudentInviteService,
      auth as AuthService,
      router as Router,
      ieltsApi as IeltsTrackingService,
      ossltApi as OssltTrackingService,
      volunteerApi as VolunteerTrackingService,
      preferenceApi as TeacherPreferenceService
    );

    local.ngOnInit();
    expect(local.visibleColumns.length).toBeGreaterThan(0);
    expect(local.visibleColumns[0]?.key).toBe('name');

    (preferenceApi.upsertPagePreference as any).mockClear();
    local.onColumnVisibilityChange('city', {
      target: { checked: true },
    } as unknown as Event);

    expect(preferenceApi.upsertPagePreference).toHaveBeenCalledWith(
      'student-management.list-columns',
      expect.objectContaining({
        version: 'v10',
        visibleColumnKeys: expect.any(Array),
        orderedColumnKeys: expect.any(Array),
      })
    );
  });

  it('column order should remain after re-init from persisted preference', () => {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    const isolatedAuth = {
      getSession: vi.fn().mockReturnValue({ userId: 90001, teacherId: 90001 }),
      getCurrentUserId: vi.fn().mockReturnValue(90001),
      getAuthorizationHeaderValue: vi.fn().mockReturnValue('Bearer token-90001'),
    };
    const first = new StudentManagementComponent(
      api as StudentManagementService,
      profileApi as StudentProfileService,
      inviteApi as StudentInviteService,
      isolatedAuth as unknown as AuthService,
      router as Router,
      ieltsApi as IeltsTrackingService,
      ossltApi as OssltTrackingService,
      volunteerApi as VolunteerTrackingService,
      preferenceApi as TeacherPreferenceService
    );

    const storageKey = (first as any).resolveVisibleColumnsStorageKey();
    storage?.removeItem(storageKey);

    first.ngOnInit();
    (preferenceApi.upsertPagePreference as any).mockClear();
    first.onColumnOrderChange([
      'email',
      'name',
      'phone',
      'graduation',
      'teacherNote',
      'profile',
      'resetPassword',
      'archive',
    ]);
    expect(first.visibleColumns[0]?.key).toBe('email');
    expect(first.visibleColumns[1]?.key).toBe('name');

    const second = new StudentManagementComponent(
      api as StudentManagementService,
      profileApi as StudentProfileService,
      inviteApi as StudentInviteService,
      isolatedAuth as unknown as AuthService,
      router as Router,
      ieltsApi as IeltsTrackingService,
      ossltApi as OssltTrackingService,
      volunteerApi as VolunteerTrackingService,
      preferenceApi as TeacherPreferenceService
    );
    second.ngOnInit();

    expect(second.visibleColumns[0]?.key).toBe('email');
    expect(second.visibleColumns[1]?.key).toBe('name');
    storage?.removeItem(storageKey);
  });

  it('column visibility change should sync preference to backend endpoint', () => {
    component.onColumnVisibilityChange('city', {
      target: { checked: true },
    } as unknown as Event);

    expect(preferenceApi.upsertPagePreference).toHaveBeenCalledWith(
      'student-management.list-columns',
      expect.objectContaining({
        version: 'v10',
      })
    );
  });

  it('column visibility on /teacher/ielts should sync to ielts-tracking preference key', () => {
    router.url = '/teacher/ielts';

    component.onColumnVisibilityChange('city', {
      target: { checked: true },
    } as unknown as Event);

    expect(preferenceApi.upsertPagePreference).toHaveBeenCalledWith(
      'ielts-tracking.list-columns',
      expect.objectContaining({
        version: 'v10',
      })
    );
  });

  it('page title should be 语言成绩跟踪 on /teacher/ielts', () => {
    router.url = '/teacher/ielts';
    expect(component.pageTitle).toBe('语言成绩跟踪');
  });

  it('default columns on /teacher/ielts should match IELTS tracking defaults', () => {
    router.url = '/teacher/ielts';

    const defaultKeys = Array.from(
      ((component as any).buildDefaultVisibleColumnKeys() as Set<string>).values()
    ).sort();

    expect(defaultKeys).toEqual(
      [
        'name',
        'graduation',
        'motherLanguage',
        'teacherNote',
        'ielts',
        'languageTracking',
        'languageCourseStatus',
      ].sort()
    );
  });

  it('default columns on /teacher/students should match student account management defaults', () => {
    router.url = '/teacher/students';

    const defaultKeys = Array.from(
      ((component as any).buildDefaultVisibleColumnKeys() as Set<string>).values()
    ).sort();

    expect(defaultKeys).toEqual(
      [
        'name',
        'email',
        'phone',
        'graduation',
        'serviceItems',
        'teacherNote',
        'profile',
        'resetPassword',
        'archive',
      ].sort()
    );
  });

  it('languageTracking column label on /teacher/students should be 语言成绩跟踪', () => {
    router.url = '/teacher/students';
    const column = component.columnToggleOptions.find((item) => item.key === 'languageTracking');
    expect(column).toBeTruthy();
    expect(component.resolveUnifiedStudentListColumnLabel(column as any)).toBe('语言成绩跟踪');
  });

  it('column toggle options on /teacher/students should include languageCourseStatus', () => {
    router.url = '/teacher/students';
    const keys = component.columnToggleOptions.map((column) => column.key);
    expect(keys).toContain('languageCourseStatus');
  });

  it('default columns on /teacher/osslt should match OSSLT tracking defaults', () => {
    router.url = '/teacher/osslt';

    const defaultKeys = Array.from(
      ((component as any).buildDefaultVisibleColumnKeys() as Set<string>).values()
    ).sort();

    expect(defaultKeys).toEqual(
      [
        'name',
        'graduation',
        'schoolName',
        'schoolBoard',
        'city',
        'teacherNote',
        'ossltResult',
        'ossltTracking',
      ].sort()
    );
  });

  it('column toggle options on /teacher/osslt should include teacherNote in full field mode', () => {
    router.url = '/teacher/osslt';

    const keys = component.columnToggleOptions.map((column) => column.key);
    expect(keys).toContain('teacherNote');
  });

  it('language tracking column should allow teacher to save selected status', () => {
    const student = { studentId: 301, username: 'student301', status: 'ACTIVE' } as any;
    component.students = [student];
    (component as any).languageTrackingStatusCache.set(301, 'NEEDS_TRACKING');

    component.onLanguageTrackingStatusSelectionChange(student, 'AUTO_PASS_ALL_SCHOOLS');

    expect(ieltsApi.updateTeacherStudentIeltsData).toHaveBeenCalledWith(
      301,
      expect.objectContaining({
        languageTrackingManualStatus: 'AUTO_PASS_ALL_SCHOOLS',
      })
    );
    expect(component.resolveLanguageTrackingStatusSelection(student)).toBe('AUTO_PASS_ALL_SCHOOLS');
  });

  it('language course status column should allow teacher to save selected status', () => {
    const student = { studentId: 302, username: 'student302', status: 'ACTIVE' } as any;
    component.students = [student];
    (component as any).languageCourseStatusCache.set(302, 'ENROLLED_GLOBAL_IELTS');

    component.onLanguageCourseStatusSelectionChange(student, 'EXAM_REGISTERED');

    expect(ieltsApi.updateTeacherStudentIeltsData).toHaveBeenCalledWith(
      302,
      expect.objectContaining({
        languageCourseStatus: 'EXAM_REGISTERED',
      })
    );
    expect(component.resolveLanguageCourseStatusSelection(student)).toBe('EXAM_REGISTERED');
  });

  it('language course status save should retry with expanded payload after validation failure', () => {
    const student = { studentId: 303, username: 'student303', status: 'ACTIVE' } as any;
    component.students = [student];
    (component as any).languageCourseStatusCache.set(303, 'ENROLLED_GLOBAL_IELTS');

    const validationError = new HttpErrorResponse({
      status: 400,
      error: { message: 'Validation failed.' },
    });

    (ieltsApi.getTeacherStudentIeltsModuleState as any).mockReturnValue(
      of({
        studentId: 303,
        graduationYear: 2027,
        languageScoreType: 'IELTS',
        hasTakenIeltsAcademic: false,
        preparationIntent: 'PREPARING',
        languageTrackingManualStatus: 'NEEDS_TRACKING',
        records: [],
        languageRisk: { shouldShowIeltsModule: true },
        updatedAt: null,
      })
    );

    (ieltsApi.updateTeacherStudentIeltsData as any)
      .mockImplementationOnce(() => throwError(() => validationError))
      .mockImplementationOnce((studentId: number, payload: any) =>
        of({
          studentId,
          graduationYear: 2027,
          languageScoreType: payload?.languageScoreType ?? 'IELTS',
          hasTakenIeltsAcademic: payload?.hasTakenIeltsAcademic ?? false,
          preparationIntent: payload?.preparationIntent ?? 'PREPARING',
          languageTrackingManualStatus: payload?.languageTrackingManualStatus ?? 'NEEDS_TRACKING',
          languageCourseStatus: payload?.languageCourseStatus ?? 'EXAM_REGISTERED',
          records: payload?.records ?? [],
          languageRisk: { shouldShowIeltsModule: true },
          updatedAt: null,
        })
      );

    component.onLanguageCourseStatusSelectionChange(student, 'EXAM_REGISTERED');

    expect(ieltsApi.getTeacherStudentIeltsModuleState).toHaveBeenCalledWith(303);
    expect((ieltsApi.updateTeacherStudentIeltsData as any).mock.calls[0]).toEqual([
      303,
      expect.objectContaining({
        languageCourseStatus: 'EXAM_REGISTERED',
      }),
    ]);
    expect((ieltsApi.updateTeacherStudentIeltsData as any).mock.calls[1]).toEqual([
      303,
      expect.objectContaining({
        languageScoreType: 'IELTS',
        hasTakenIeltsAcademic: false,
        preparationIntent: 'PREPARING',
        languageTrackingManualStatus: 'NEEDS_TRACKING',
        languageCourseStatus: 'EXAM_REGISTERED',
      }),
    ]);
    expect(component.resolveLanguageCourseStatusSelection(student)).toBe('EXAM_REGISTERED');
  });

  it('column visibility should keep IELTS independent when profile toggles', () => {
    component.onColumnVisibilityChange('profile', {
      target: { checked: false },
    } as unknown as Event);

    expect(component.isColumnVisible('profile')).toBe(false);
    expect(component.isColumnVisible('ielts')).toBe(false);

    component.onColumnVisibilityChange('profile', {
      target: { checked: true },
    } as unknown as Event);

    expect(component.isColumnVisible('profile')).toBe(true);
    expect(component.isColumnVisible('ielts')).toBe(false);
  });

  it('column visibility should keep profile independent when IELTS toggles', () => {
    component.onColumnVisibilityChange('ielts', {
      target: { checked: false },
    } as unknown as Event);

    expect(component.isColumnVisible('ielts')).toBe(false);
    expect(component.isColumnVisible('profile')).toBe(true);

    component.onColumnVisibilityChange('ielts', {
      target: { checked: true },
    } as unknown as Event);

    expect(component.isColumnVisible('ielts')).toBe(true);
    expect(component.isColumnVisible('profile')).toBe(true);
  });

  it('volunteer badge should load total hours from batch-summary API when list row has no hours field', () => {
    (volunteerApi.getTeacherStudentsVolunteerBatchSummary as any).mockReturnValue(
      of([
        {
          studentId: 410,
          totalVolunteerHours: 20,
          volunteerCompleted: false,
          updatedAt: '2026-04-08T00:00:00Z',
        },
      ])
    );

    component.visibleColumnKeys.add('volunteerTracking');
    component.students = [
      {
        studentId: 410,
        username: 'student410',
        status: 'ACTIVE',
      } as any,
    ];

    component.applyListView();

    expect(volunteerApi.getTeacherStudentsVolunteerBatchSummary).toHaveBeenCalledWith([410]);
    expect(component.resolveVolunteerHoursLabel(component.students[0] as any)).toBe('20');
    expect(component.resolveVolunteerHoursBadgeLabel(component.students[0] as any)).toBe('20 小时');
  });

  it('volunteer badge should be yellow when total hours is below 40', () => {
    const student = {
      studentId: 401,
      username: 'student401',
      totalVolunteerHours: 35.5,
    } as any;

    expect(component.resolveVolunteerHoursLabel(student)).toBe('35.5');
    expect(component.resolveVolunteerHoursBadgeLabel(student)).toBe('35.5 小时');
    expect(component.resolveVolunteerHoursBackground(student)).toBe('#fff2d8');
    expect(component.resolveVolunteerHoursTextColor(student)).toBe('#8a5a00');
    expect(component.resolveVolunteerHoursBorderColor(student)).toBe('#e3c77a');
  });

  it('volunteer badge should be green when total hours is at least 40', () => {
    const student = {
      studentId: 402,
      username: 'student402',
      volunteerTracking: {
        summary: {
          totalHours: 40,
        },
      },
    } as any;

    expect(component.resolveVolunteerHoursLabel(student)).toBe('40');
    expect(component.resolveVolunteerHoursBadgeLabel(student)).toBe('40 小时');
    expect(component.resolveVolunteerHoursBackground(student)).toBe('#e7f6ec');
    expect(component.resolveVolunteerHoursTextColor(student)).toBe('#2f6b43');
    expect(component.resolveVolunteerHoursBorderColor(student)).toBe('#8fc8a3');
  });

  it('volunteer badge should show unavailable style when hours is missing', () => {
    const student = {
      studentId: 403,
      username: 'student403',
    } as any;

    expect(component.resolveVolunteerHoursLabel(student)).toBe('--');
    expect(component.resolveVolunteerHoursBadgeLabel(student)).toBe('--');
    expect(component.resolveVolunteerHoursBackground(student)).toBe('#f1f3f5');
    expect(component.resolveVolunteerHoursTextColor(student)).toBe('#6a7385');
    expect(component.resolveVolunteerHoursBorderColor(student)).toBe('#c8cfda');
  });
});
