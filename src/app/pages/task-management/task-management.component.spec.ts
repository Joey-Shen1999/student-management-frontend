import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import {
  type AssignableStudentOptionVm,
  type GoalTaskVm,
  type InfoTaskVm,
  TaskCenterService,
} from '../../services/task-center.service';
import { TaskManagementComponent } from './task-management.component';

describe('TaskManagementComponent', () => {
  let component: TaskManagementComponent;
  let router: Pick<Router, 'navigate'>;
  let taskCenter: Pick<
    TaskCenterService,
    | 'listAssignableStudents'
    | 'listTeacherGoals'
    | 'createGoal'
    | 'updateTeacherGoalStatus'
    | 'listTeacherInfos'
    | 'createInfo'
  >;

  const students: AssignableStudentOptionVm[] = [
    {
      studentId: 20001,
      studentName: '张三',
      username: 'zhangsan',
    },
  ];

  const goals: GoalTaskVm[] = [
    {
      id: 1001,
      type: 'GOAL',
      title: '完成 OUAC 账户注册',
      description: '本周内完成 OUAC 注册并截图上传。',
      status: 'NOT_STARTED',
      dueAt: '2026-03-15',
      assignedStudentId: 20001,
      assignedStudentName: '张三',
      assignedByTeacherId: 9001,
      assignedByTeacherName: 'Ms. Chen',
      createdAt: '2026-03-08T10:00:00Z',
      updatedAt: '2026-03-08T10:00:00Z',
      completedAt: null,
      progressNote: '',
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
      targetStudentCount: 50,
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
      listTeacherGoals: vi.fn().mockReturnValue(of({ items: goals, total: 1, page: 1, size: 100 })),
      createGoal: vi.fn().mockReturnValue(
        of({
          ...goals[0],
          id: 1009,
          title: '新 Goal',
        })
      ),
      updateTeacherGoalStatus: vi.fn().mockReturnValue(
        of({
          ...goals[0],
          status: 'COMPLETED',
          completedAt: '2026-03-09T10:00:00Z',
          updatedAt: '2026-03-09T10:00:00Z',
        })
      ),
      listTeacherInfos: vi.fn().mockReturnValue(of({ items: infos, total: 1, page: 1, size: 100 })),
      createInfo: vi.fn().mockReturnValue(of({ ...infos[0], id: 5010, title: '新 Info' })),
    };

    component = new TaskManagementComponent(taskCenter as TaskCenterService, router as Router);
    component.ngOnInit();
  });

  it('should load assignable students and goals on init', () => {
    expect(taskCenter.listAssignableStudents).toHaveBeenCalledTimes(1);
    expect(taskCenter.listTeacherGoals).toHaveBeenCalledTimes(1);
    expect(component.studentOptions.length).toBe(1);
    expect(component.goals.length).toBe(1);
  });

  it('createGoal should validate required fields', () => {
    component.createStudentId = null;
    component.createTitle = '  ';
    component.createDescription = 'demo';

    component.createGoal();

    expect(component.createError).toContain('请选择目标学生');
    expect(taskCenter.createGoal).not.toHaveBeenCalled();
  });

  it('createGoal should call service when form is valid', () => {
    component.createStudentId = 20001;
    component.createTitle = '完成任务';
    component.createDescription = '详细描述';
    component.createDueAt = '2026-03-20';

    component.createGoal();

    expect(taskCenter.createGoal).toHaveBeenCalledWith({
      studentId: 20001,
      title: '完成任务',
      description: '详细描述',
      dueAt: '2026-03-20',
    });
    expect(component.createSuccess).toContain('Goal 已创建');
  });

  it('setGoalStatus should call service and update list', () => {
    const goal = component.goals[0];

    component.setGoalStatus(goal, 'COMPLETED');

    expect(taskCenter.updateTeacherGoalStatus).toHaveBeenCalledWith(
      goal.id,
      expect.objectContaining({ status: 'COMPLETED' })
    );
    expect(component.goals[0].status).toBe('COMPLETED');
  });

  it('goDashboard should navigate back to teacher dashboard', () => {
    component.goDashboard();
    expect(router.navigate).toHaveBeenCalledWith(['/teacher/dashboard']);
  });
});
