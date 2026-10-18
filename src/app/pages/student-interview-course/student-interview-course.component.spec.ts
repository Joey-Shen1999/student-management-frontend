import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { GraduationApplicationStageService, type InterviewCoursePlan } from '../../services/graduation-application-stage.service';
import { StudentInterviewCourseComponent } from './student-interview-course.component';

describe('StudentInterviewCourseComponent', () => {
  const plan: InterviewCoursePlan = {
    studentId: 5, studentName: 'Test Student', username: 'test-student', graduationYear: 2026,
    enabled: true,
    lessons: [
      { id: 2, lessonNumber: 2, lessonDate: null, lessonTime: null },
      { id: 1, lessonNumber: 1, lessonDate: '2099-10-23', lessonTime: '16:00:00' },
    ],
    requirements: [{ id: 11, universityName: 'McMaster University', programName: 'Engineering I' }],
  };

  it('shows only the current student plan in lesson order', () => {
    const service = { getMyInterviewCourse: vi.fn().mockReturnValue(of(plan)) };
    const component = new StudentInterviewCourseComponent(service as unknown as GraduationApplicationStageService);

    component.ngOnInit();

    expect(service.getMyInterviewCourse).toHaveBeenCalledOnce();
    expect(component.plan?.studentId).toBe(5);
    expect(component.lessons.map((lesson) => lesson.lessonNumber)).toEqual([1, 2]);
    expect(component.scheduledCount).toBe(1);
    expect(component.nextLesson?.lessonNumber).toBe(1);
  });

  it('keeps an unavailable plan distinct from an unopened course', () => {
    const service = { getMyInterviewCourse: vi.fn().mockReturnValue(throwError(() => new Error('offline'))) };
    const component = new StudentInterviewCourseComponent(service as unknown as GraduationApplicationStageService);

    component.ngOnInit();

    expect(component.loading).toBe(false);
    expect(component.plan).toBeNull();
    expect(component.error).toContain('重试');
  });
});
