import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import {
  type AssignableStudentOptionVm,
  type InfoTaskVm,
  TaskCenterService,
} from '../../services/task-center.service';
import {
  type StudentAccount,
  StudentManagementService,
} from '../../services/student-management.service';
import { AuthService } from '../../services/auth.service';
import { InfoManagementComponent } from './info-management.component';

describe('InfoManagementComponent', () => {
  let component: InfoManagementComponent;
  let router: Pick<Router, 'navigate'>;
  let taskCenter: Pick<
    TaskCenterService,
    'listAssignableStudents' | 'listTeacherInfos' | 'createInfo'
  >;
  let studentManagement: Pick<StudentManagementService, 'listStudents'>;
  let auth: Pick<AuthService, 'getSession' | 'getCurrentUserId'>;

  const students: AssignableStudentOptionVm[] = [
    {
      studentId: 20001,
      studentName: '张三',
      username: 'zhangsan',
    },
    {
      studentId: 20002,
      studentName: '李四',
      username: 'lisi',
      status: 'ARCHIVED',
    },
  ];

  const accounts: StudentAccount[] = [
    {
      studentId: 20001,
      username: 'zhangsan',
      status: 'ACTIVE',
      languageScoreStatus: 'GREEN_STRICT_PASS',
      languageTrackingStatus: 'TEACHER_REVIEW_APPROVED',
      languageCourseStatus: 'EXAM_REGISTERED',
      latestOssltResult: 'PASS',
      ossltTrackingStatus: 'PASSED',
      totalVolunteerHours: 39.9,
      volunteerCompleted: false,
    },
    {
      studentId: 20002,
      username: 'lisi',
      status: 'ARCHIVED',
      ossltModule: {
        latestOssltResult: 'FAIL',
        ossltTrackingStatus: 'NEEDS_TRACKING',
      },
    },
  ];

  const infos: InfoTaskVm[] = [
    {
      id: 5001,
      type: 'INFO',
      title: '开放日通知',
      content: '请尽快报名',
      category: 'ACTIVITY',
      tags: ['OpenDay'],
      targetStudentCount: 1,
      publishedByTeacherId: 9001,
      publishedByTeacherName: 'Ms. Chen',
      createdAt: '2026-03-08T10:00:00Z',
      updatedAt: '2026-03-08T10:00:00Z',
      read: false,
      readAt: null,
    },
  ];

  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage?.clear();
    router = {
      navigate: vi.fn(),
    };

    taskCenter = {
      listAssignableStudents: vi.fn().mockReturnValue(of(students)),
      listTeacherInfos: vi.fn().mockReturnValue(of({ items: infos, total: 1, page: 1, size: 100 })),
      createInfo: vi.fn().mockReturnValue(of({ ...infos[0], id: 5010, title: '新通知' })),
    };

    studentManagement = {
      listStudents: vi.fn().mockReturnValue(of(accounts)),
    };
    auth = {
      getSession: vi.fn().mockReturnValue({ userId: 1, teacherId: 1 }),
      getCurrentUserId: vi.fn().mockReturnValue(1),
    };

    component = new InfoManagementComponent(
      taskCenter as TaskCenterService,
      studentManagement as StudentManagementService,
      auth as AuthService,
      router as Router
    );
    component.ngOnInit();
  });

  it('should load students and infos on init', () => {
    expect(taskCenter.listAssignableStudents).toHaveBeenCalledTimes(1);
    expect(taskCenter.listTeacherInfos).toHaveBeenCalledTimes(1);
    expect(component.studentOptions.length).toBe(2);
    expect(component.infos.length).toBe(1);
  });

  it('should hide archived students from selectable list by default', () => {
    const visibleIds = component.filteredCreateStudentOptions.map((row) => row.studentId);
    expect(visibleIds).toEqual([20001]);
    expect(component.isCreateStudentSelectableById(20002)).toBe(false);
  });

  it('should apply volunteer completed filter in create selector', () => {
    expect(component.filteredCreateStudentOptions.map((row) => row.studentId)).toEqual([20001]);

    component.onVolunteerCompletedFilterChange('COMPLETED');

    expect(component.filteredCreateStudentOptions).toEqual([]);
  });

  it('should expose language and OSSLT selector columns and resolve status values', () => {
    expect(component.createStudentColumns.some((column) => column.key === 'ielts')).toBe(true);
    expect(component.createStudentColumns.some((column) => column.key === 'languageTracking')).toBe(true);
    expect(component.createStudentColumns.some((column) => column.key === 'languageCourseStatus')).toBe(
      true
    );
    expect(component.createStudentColumns.some((column) => column.key === 'ossltResult')).toBe(true);
    expect(component.createStudentColumns.some((column) => column.key === 'ossltTracking')).toBe(true);
    expect(component.visibleCreateStudentColumnKeys.has('ielts')).toBe(true);
    expect(component.visibleCreateStudentColumnKeys.has('languageTracking')).toBe(true);
    expect(component.visibleCreateStudentColumnKeys.has('languageCourseStatus')).toBe(true);
    expect(component.visibleCreateStudentColumnKeys.has('ossltResult')).toBe(true);
    expect(component.visibleCreateStudentColumnKeys.has('ossltTracking')).toBe(true);

    const row = component.studentOptions.find((student) => student.studentId === 20001);
    expect(row).toBeTruthy();
    if (!row) return;

    expect(component.resolveCreateStudentColumnValue(row, 'ielts')).toBe('\u5df2\u8fbe\u6807');
    expect(component.resolveCreateStudentColumnValue(row, 'languageTracking')).toBe(
      '\u6559\u5e08\u5df2\u786e\u8ba4'
    );
    expect(component.resolveCreateStudentColumnValue(row, 'languageCourseStatus')).toBe(
      '\u5df2\u62a5\u540d\u8003\u8bd5'
    );
    expect(component.resolveCreateStudentColumnValue(row, 'ossltResult')).toBe('\u5df2\u901a\u8fc7');
    expect(component.resolveCreateStudentColumnValue(row, 'ossltTracking')).toBe('\u5df2\u901a\u8fc7');
  });

  it('createInfo should require at least one selected student', () => {
    component.createInfoTitle = '通知标题';
    component.createInfoContent = '通知内容';

    component.createInfo();

    expect(taskCenter.createInfo).not.toHaveBeenCalled();
    expect(component.createInfoError).toContain('请至少选择');
  });

  it('createInfo should send selected studentIds', () => {
    component.onCreateStudentToggle(20001, true);
    component.onCreateStudentToggle(20002, true);
    component.createInfoTitle = '通知标题';
    component.createInfoContent = '通知内容';
    component.createInfoTags = 'A,B';

    component.createInfo();

    expect(taskCenter.createInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'ACTIVITY',
        title: '通知标题',
        content: '通知内容',
        tags: ['A', 'B'],
        studentIds: [20001],
      })
    );
    expect(component.createInfoSuccess).toContain('通知已发布');
  });

  it('createInfo should validate volunteer task collection', () => {
    component.onCreateStudentToggle(20001, true);
    component.onCreateInfoCategoryChange('VOLUNTEER');
    component.createInfoTitle = '义工通知';
    component.createInfo();

    expect(taskCenter.createInfo).not.toHaveBeenCalled();
    expect(component.createInfoError).toContain('义工任务');
  });

  it('createInfo should keep legacy volunteer content editable in edit mode', () => {
    component.onCreateStudentToggle(20001, true);
    component.onCreateInfoCategoryChange('VOLUNTEER');
    component.editingInfoId = 123;
    component.editingInfoTaskGroupId = 'INFO-legacy';
    component.createInfoTitle = '历史义工通知';
    component.createInfoContent = '这是旧版本义工通知内容。';
    component.createInfo();

    expect(taskCenter.createInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'VOLUNTEER',
        title: '历史义工通知',
        content: '这是旧版本义工通知内容。',
        studentIds: [20001],
        taskGroupId: 'INFO-legacy',
      })
    );
  });

  it('createInfo should serialize volunteer task content with total hours', () => {
    component.onCreateStudentToggle(20001, true);
    component.onCreateInfoCategoryChange('VOLUNTEER');
    component.createInfoTitle = '义工通知';
    component.createInfoContent = '请按时提交证明材料。';
    component.volunteerTasks = [
      {
        taskName: '图书馆整理',
        description: '整理图书并帮助借还登记',
        durationHours: '3.5',
        startDate: '2026-04-01',
        endDate: '2026-04-01',
        verifierContact: 'library@example.com',
      },
    ];

    component.createInfo();

    expect(taskCenter.createInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'VOLUNTEER',
        title: '义工通知',
        content: expect.stringContaining('义工总时长：3.50 小时'),
        studentIds: [20001],
      })
    );
  });

  it('should use unified All option and normalize country aliases', () => {
    expect(component.createCountryFilter).toBe('All');
    expect(component.countryFilterOptions.includes('All')).toBe(true);
    expect(component.countryFilterOptions.includes('全部')).toBe(false);

    component.onCountryFilterInputChange('US');

    expect(component.createCountryFilter).toBe('United States');
    expect(component.createCountryFilterInput).toBe('US');
  });

  it('should expose standardized province options after selecting country', () => {
    component.onCountryFilterInputChange('Canada');

    expect(component.provinceFilterOptions.includes('Ontario')).toBe(true);
    expect(component.provinceFilterOptions.includes('British Columbia')).toBe(true);
  });

  it('should restore selector column visibility and order from local preference', () => {
    const isolatedAuth = {
      getSession: vi.fn().mockReturnValue({ userId: 92001, teacherId: 92001 }),
      getCurrentUserId: vi.fn().mockReturnValue(92001),
    };
    const first = new InfoManagementComponent(
      taskCenter as TaskCenterService,
      studentManagement as StudentManagementService,
      isolatedAuth as unknown as AuthService,
      router as Router
    );
    first.ngOnInit();
    const allKeys = first.createStudentColumns.map((column) => column.key);
    first.createStudentColumnOrderKeys = [...allKeys].reverse();
    first.visibleCreateStudentColumnKeys = new Set(allKeys.slice(0, 3));
    (first as any).persistCreateStudentVisibleColumnsPreference();

    const second = new InfoManagementComponent(
      taskCenter as TaskCenterService,
      studentManagement as StudentManagementService,
      isolatedAuth as unknown as AuthService,
      router as Router
    );
    second.ngOnInit();

    expect(second.createStudentColumnOrderKeys[0]).toBe(allKeys[allKeys.length - 1]);
    expect(second.visibleCreateStudentColumnKeys.has(allKeys[0])).toBe(true);
    expect(second.visibleCreateStudentColumnKeys.has(allKeys[1])).toBe(true);
  });

  it('should restore selector filters from local preference', () => {
    const isolatedAuth = {
      getSession: vi.fn().mockReturnValue({ userId: 93001, teacherId: 93001 }),
      getCurrentUserId: vi.fn().mockReturnValue(93001),
    };
    const first = new InfoManagementComponent(
      taskCenter as TaskCenterService,
      studentManagement as StudentManagementService,
      isolatedAuth as unknown as AuthService,
      router as Router
    );
    first.ngOnInit();
    first.onCountryFilterInputChange('Canada');
    first.onProvinceFilterInputChange('Ontario');
    first.onCityFilterInputChange('Toronto');
    first.onSchoolBoardFilterInputChange('Toronto District School Board');
    first.onGraduationSeasonFilterInputChange('2026 Fall');
    first.onVolunteerCompletedFilterChange('COMPLETED');
    first.onStudentKeywordChange('alice');

    const second = new InfoManagementComponent(
      taskCenter as TaskCenterService,
      studentManagement as StudentManagementService,
      isolatedAuth as unknown as AuthService,
      router as Router
    );
    second.ngOnInit();

    expect(second.createCountryFilter).toBe('Canada');
    expect(second.createProvinceFilter).toBe('Ontario');
    expect(second.createCityFilter).toBe('Toronto');
    expect(second.createSchoolBoardFilter).toBe('Toronto District School Board');
    expect(second.createGraduationSeasonFilter).toBe('2026 Fall');
    expect(second.createVolunteerCompletedFilter).toBe('COMPLETED');
    expect(second.createStudentKeyword).toBe('alice');
  });
});
