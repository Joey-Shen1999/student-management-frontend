import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { type InfoTaskVm, TaskCenterService } from '../../services/task-center.service';
import { type VolunteerTrackingService } from '../../services/volunteer-tracking.service';
import { StudentVolunteerComponent } from './student-volunteer.component';

describe('StudentVolunteerComponent', () => {
  let component: StudentVolunteerComponent;
  let router: Pick<Router, 'navigate'>;
  let volunteerTracking: Pick<VolunteerTrackingService, 'getMyVolunteerTracking'>;
  let taskCenter: Pick<TaskCenterService, 'listMyInfos'>;

  const volunteerInfos: InfoTaskVm[] = [
    {
      id: 7001,
      type: 'INFO',
      title: '四月义工任务',
      content:
        '请本周完成提交。\n\n义工总时长：3.50 小时\n义工任务明细：\n1. 任务名称：图书馆整理\n   任务描述：整理图书并帮助借还登记\n   任务时长：3.50 小时\n   开始日期：2026-04-01\n   结束日期：2026-04-01\n   证明人联系方式：library@example.com',
      category: 'VOLUNTEER',
      tags: ['Volunteer'],
      targetStudentCount: 1,
      publishedByTeacherId: 9001,
      publishedByTeacherName: 'Ms. Chen',
      createdAt: '2026-04-02T10:00:00Z',
      updatedAt: '2026-04-02T10:00:00Z',
      read: false,
      readAt: null,
    },
  ];

  beforeEach(() => {
    router = {
      navigate: vi.fn(),
    };

    volunteerTracking = {
      getMyVolunteerTracking: vi.fn().mockReturnValue(
        of({
          studentId: 20001,
          records: [
            {
              id: 7001,
              title: '四月义工任务',
              note: '请本周完成提交。',
              totalHours: 3.5,
              tasks: [
                {
                  taskName: '图书馆整理',
                  description: '整理图书并帮助借还登记',
                  durationHours: 3.5,
                  startDate: '2026-04-01',
                  endDate: '2026-04-01',
                  verifierContact: 'library@example.com',
                },
              ],
              createdAt: '2026-04-02T10:00:00Z',
              updatedAt: '2026-04-02T10:00:00Z',
              updatedByTeacherId: 9001,
              updatedByTeacherName: 'Ms. Chen',
            },
          ],
        })
      ),
    };

    taskCenter = {
      listMyInfos: vi.fn().mockReturnValue(
        of({
          items: volunteerInfos,
          total: 1,
          page: 1,
          size: 100,
        })
      ),
    };

    component = new StudentVolunteerComponent(
      router as Router,
      volunteerTracking as VolunteerTrackingService,
      taskCenter as TaskCenterService
    );
    component.ngOnInit();
  });

  it('should load volunteer records from volunteer-tracking endpoint', () => {
    expect(volunteerTracking.getMyVolunteerTracking).toHaveBeenCalled();
    expect(taskCenter.listMyInfos).not.toHaveBeenCalled();
    expect(component.records.length).toBe(1);
    expect(component.records[0].tasks.length).toBe(1);
    expect(component.totalVolunteerHoursLabel).toBe('3.50');
  });

  it('goBack should navigate to dashboard', () => {
    component.goBack();
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });
});
