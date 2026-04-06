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
import { InfoManagementComponent } from './info-management.component';

describe('InfoManagementComponent', () => {
  let component: InfoManagementComponent;
  let router: Pick<Router, 'navigate'>;
  let taskCenter: Pick<
    TaskCenterService,
    'listAssignableStudents' | 'listTeacherInfos' | 'createInfo'
  >;
  let studentManagement: Pick<StudentManagementService, 'listStudents'>;

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
      // @ts-expect-error runtime payload may carry extra fields
      status: 'ARCHIVED',
    },
  ];

  const accounts: StudentAccount[] = [
    {
      studentId: 20001,
      username: 'zhangsan',
      status: 'ACTIVE',
    },
    {
      studentId: 20002,
      username: 'lisi',
      status: 'ARCHIVED',
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

    component = new InfoManagementComponent(
      taskCenter as TaskCenterService,
      studentManagement as StudentManagementService,
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
});
