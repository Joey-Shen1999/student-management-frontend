import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import {
  GraduationApplicationStageService,
  InterviewCoursePlan,
} from '../../services/graduation-application-stage.service';
import { InterviewStudentsComponent } from './interview-students.component';

const plans: InterviewCoursePlan[] = [
  { studentId: 1, studentName: 'Alice Anderson', username: 'alice', graduationYear: 2026,
    enabled: true, requirements: [{ id: 101, universityName: 'McMaster University', programName: 'Engineering I' }], lessons: [
      { id: 11, lessonNumber: 1, lessonDate: null, lessonTime: null },
      { id: 12, lessonNumber: 2, lessonDate: '2026-05-01', lessonTime: '15:30:00' },
    ] },
  { studentId: 2, studentName: 'Bob Brown', username: 'bob', graduationYear: 2026,
    enabled: true, requirements: [], lessons: [{ id: 21, lessonNumber: 1, lessonDate: null, lessonTime: null }] },
];

describe('InterviewStudentsComponent', () => {
  it('shows student-level plans, counts scheduled lessons, and searches students', () => {
    const api = { listInterviewCourseStudents: vi.fn().mockReturnValue(of(plans)) } as unknown as GraduationApplicationStageService;
    const cdr = { markForCheck: vi.fn() };
    const component = new InterviewStudentsComponent(api, cdr as any);
    component.ngOnInit();

    expect(api.listInterviewCourseStudents).toHaveBeenCalledWith(component.year);
    expect(component.rows).toHaveLength(2);
    expect(component.scheduledCount).toBe(1);
    component.search = 'bob';
    expect(component.filteredRows.map((row) => row.studentId)).toEqual([2]);
    component.search = 'engineering';
    expect(component.filteredRows.map((row) => row.studentId)).toEqual([1]);
  });

  it('saves a lesson date and time and adds a blank lesson', () => {
    const updated = { ...plans[0], lessons: [
      { id: 11, lessonNumber: 1, lessonDate: '2026-04-10', lessonTime: '13:00' },
      { ...plans[0].lessons[1] },
    ] };
    const extended = { ...updated, lessons: [...updated.lessons,
      { id: 13, lessonNumber: 3, lessonDate: null, lessonTime: null }] };
    const api = {
      listInterviewCourseStudents: vi.fn().mockReturnValue(of([{ ...plans[0], lessons: plans[0].lessons.map((lesson) => ({ ...lesson })) }])),
      updateInterviewCourseLesson: vi.fn().mockReturnValue(of(updated)),
      addInterviewCourseLesson: vi.fn().mockReturnValue(of(extended)),
    } as unknown as GraduationApplicationStageService;
    const component = new InterviewStudentsComponent(api, { markForCheck: vi.fn() } as any);
    component.ngOnInit();

    component.changeLessonDate(component.rows[0], component.rows[0].lessons[0], '2026-04-10');
    expect(api.updateInterviewCourseLesson).toHaveBeenCalledWith(1, 11, '2026-04-10', null);
    component.changeLessonTime(component.rows[0], component.rows[0].lessons[0], '13:00');
    expect(api.updateInterviewCourseLesson).toHaveBeenCalledWith(1, 11, '2026-04-10', '13:00');
    component.addLesson(component.rows[0]);
    expect(api.addInterviewCourseLesson).toHaveBeenCalledWith(1);
    expect(component.rows[0].lessons).toHaveLength(3);
  });

  it('reports loading failures and refreshes after an async response', () => {
    const response = new Subject<InterviewCoursePlan[]>();
    const api = { listInterviewCourseStudents: vi.fn().mockReturnValue(response) } as unknown as GraduationApplicationStageService;
    const cdr = { markForCheck: vi.fn() };
    const component = new InterviewStudentsComponent(api, cdr as any);
    component.ngOnInit();
    expect(component.loading).toBe(true);
    response.next([]);
    response.complete();
    expect(component.loading).toBe(false);
    expect(cdr.markForCheck).toHaveBeenCalledTimes(1);

    const failing = new InterviewStudentsComponent({
      listInterviewCourseStudents: vi.fn().mockReturnValue(throwError(() => new Error('offline'))),
    } as unknown as GraduationApplicationStageService, { markForCheck: vi.fn() } as any);
    failing.ngOnInit();
    expect(failing.failed).toBe(true);
  });

  it('adds, updates and removes a university and program requirement for one student', () => {
    const empty = { ...plans[1], requirements: [] };
    const added = { ...empty, requirements: [{ id: 22, universityName: 'Hong Kong University', programName: 'Medicine' }] };
    const updated = { ...empty, requirements: [{ id: 22, universityName: 'HKU', programName: 'Medicine' }] };
    const api = {
      listInterviewCourseStudents: vi.fn().mockReturnValue(of([empty])),
      addInterviewCourseRequirement: vi.fn().mockReturnValue(of(added)),
      updateInterviewCourseRequirement: vi.fn().mockReturnValue(of(updated)),
      deleteInterviewCourseRequirement: vi.fn().mockReturnValue(of(empty)),
    } as unknown as GraduationApplicationStageService;
    const component = new InterviewStudentsComponent(api, { markForCheck: vi.fn() } as any);
    component.ngOnInit();
    component.startRequirement(component.rows[0]);
    const draft = component.requirementDrafts.get(2)!;
    draft.universityName = ' Hong Kong University ';
    draft.programName = 'Medicine';
    component.saveRequirement(component.rows[0]);
    expect(api.addInterviewCourseRequirement).toHaveBeenCalledWith(2, 'Hong Kong University', 'Medicine');
    expect(component.rows[0].requirements).toHaveLength(1);
    component.startRequirement(component.rows[0], component.rows[0].requirements[0]);
    component.requirementDrafts.get(2)!.universityName = 'HKU';
    component.saveRequirement(component.rows[0]);
    expect(api.updateInterviewCourseRequirement).toHaveBeenCalledWith(2, 22, 'HKU', 'Medicine');
    component.deleteRequirement(component.rows[0], component.rows[0].requirements[0]);
    expect(api.deleteInterviewCourseRequirement).toHaveBeenCalledWith(2, 22);
    expect(component.rows[0].requirements).toHaveLength(0);
  });
});
