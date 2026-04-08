import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { type InfoTaskVm, TaskCenterService } from '../../services/task-center.service';
import { type StudentAccount, StudentManagementService } from '../../services/student-management.service';
import { type VolunteerTrackingService } from '../../services/volunteer-tracking.service';
import { TeacherStudentVolunteerTrackingComponent } from './teacher-student-volunteer-tracking.component';

describe('TeacherStudentVolunteerTrackingComponent', () => {
  let component: TeacherStudentVolunteerTrackingComponent;
  let router: Pick<Router, 'navigate'>;
  let route: Pick<ActivatedRoute, 'paramMap'>;
  let volunteerTracking: Pick<
    VolunteerTrackingService,
    'getTeacherStudentVolunteerTracking' | 'updateTeacherStudentVolunteerTracking'
  >;
  let taskCenter: Pick<TaskCenterService, 'listTeacherInfos' | 'createInfo'>;
  let studentApi: Pick<StudentManagementService, 'listStudents'>;

  const volunteerInfoRows: InfoTaskVm[] = [
    {
      id: 9001,
      type: 'INFO',
      title: '义工跟踪 - 张三',
      content:
        '义工总时长：2.50 小时\n义工任务明细：\n1. 任务名称：图书馆整理\n   任务描述：整理图书\n   任务时长：2.50 小时\n   开始日期：2026-04-01\n   结束日期：2026-04-01\n   证明人联系方式：library@example.com',
      category: 'VOLUNTEER',
      tags: ['VolunteerTracking'],
      taskGroupId: 'VOLUNTEER-STUDENT-20001',
      targetStudentCount: 1,
      publishedByTeacherId: 8001,
      publishedByTeacherName: 'Teacher A',
      createdAt: '2026-04-01T10:00:00Z',
      updatedAt: '2026-04-01T10:00:00Z',
      read: false,
      readAt: null,
    },
  ];

  const studentRows: StudentAccount[] = [
    {
      studentId: 20001,
      username: 'zhangsan',
      firstName: 'San',
      lastName: 'Zhang',
      status: 'ACTIVE',
    },
  ];

  beforeEach(() => {
    router = {
      navigate: vi.fn(),
    };

    route = {
      paramMap: of(convertToParamMap({ studentId: '20001' })),
    };

    volunteerTracking = {
      getTeacherStudentVolunteerTracking: vi.fn().mockReturnValue(
        of({
          studentId: 20001,
          records: [
            {
              id: 9001,
              title: '义工跟踪 - 张三',
              note: '',
              totalHours: 2.5,
              tasks: [
                {
                  taskName: '图书馆整理',
                  description: '整理图书',
                  durationHours: 2.5,
                  startDate: '2026-04-01',
                  endDate: '2026-04-01',
                  verifierContact: 'library@example.com',
                },
              ],
              createdAt: '2026-04-01T10:00:00Z',
              updatedAt: '2026-04-01T10:00:00Z',
              updatedByTeacherId: 8001,
              updatedByTeacherName: 'Teacher A',
            },
          ],
        })
      ),
      updateTeacherStudentVolunteerTracking: vi.fn().mockReturnValue(
        of({
          studentId: 20001,
          records: [],
        })
      ),
    };

    taskCenter = {
      listTeacherInfos: vi.fn().mockReturnValue(
        of({
          items: volunteerInfoRows,
          total: 1,
          page: 1,
          size: 100,
        })
      ),
      createInfo: vi.fn().mockReturnValue(of(volunteerInfoRows[0])),
    };

    studentApi = {
      listStudents: vi.fn().mockReturnValue(of(studentRows)),
    };

    component = new TeacherStudentVolunteerTrackingComponent(
      route as ActivatedRoute,
      router as Router,
      volunteerTracking as VolunteerTrackingService,
      taskCenter as TaskCenterService,
      studentApi as StudentManagementService
    );
    component.ngOnInit();
  });

  it('should load student volunteer records from volunteer-tracking endpoint', () => {
    expect(component.studentId).toBe(20001);
    expect(volunteerTracking.getTeacherStudentVolunteerTracking).toHaveBeenCalledWith(20001);
    expect(taskCenter.listTeacherInfos).not.toHaveBeenCalled();
    expect(component.records.length).toBe(1);
    expect(component.editorTasks.length).toBe(1);
    expect(component.totalHoursLabel).toBe('2.50');
  });

  it('saveTracking should call updateTeacherStudentVolunteerTracking with normalized payload', () => {
    component.editorTasks = [
      {
        taskName: '社区清洁',
        description: '清理社区垃圾',
        durationHours: '1.5',
        startDate: '2026-04-02',
        endDate: '2026-04-02',
        verifierContact: 'contact@example.com',
      },
    ];

    component.saveTracking();

    expect(volunteerTracking.updateTeacherStudentVolunteerTracking).toHaveBeenCalledWith(
      20001,
      expect.objectContaining({
        note: '',
        totalHours: 1.5,
        tasks: expect.any(Array),
      })
    );
    expect(taskCenter.createInfo).not.toHaveBeenCalled();
  });
});
