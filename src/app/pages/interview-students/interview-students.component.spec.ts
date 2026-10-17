import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import {
  GraduationApplicationInterviewStudent,
  GraduationApplicationStageService,
} from '../../services/graduation-application-stage.service';
import { InterviewStudentsComponent } from './interview-students.component';

describe('InterviewStudentsComponent', () => {
  it('groups multiple marked universities under each student and searches by university', () => {
    const api = {
      listInterviewStudents: vi.fn().mockReturnValue(of([
        { studentId: 1, studentName: 'Alice Anderson', username: 'alice', universityId: 10,
          universityName: 'University A', graduationYear: 2026 },
        { studentId: 1, studentName: 'Alice Anderson', username: 'alice', universityId: 11,
          universityName: 'University B', graduationYear: 2026 },
        { studentId: 2, studentName: 'Bob Brown', username: 'bob', universityId: 12,
          universityName: 'University C', graduationYear: 2026 },
      ])),
    } as unknown as GraduationApplicationStageService;
    const cdr = { markForCheck: vi.fn() };
    const component = new InterviewStudentsComponent(api, cdr as any);

    component.ngOnInit();

    expect(api.listInterviewStudents).toHaveBeenCalledWith(component.year);
    expect(cdr.markForCheck).toHaveBeenCalled();
    expect(component.groups).toHaveLength(2);
    expect(component.groups[0].universities.map((university) => university.name))
      .toEqual(['University A', 'University B']);
    component.search = 'university b';
    expect(component.filteredGroups.map((group) => group.studentName)).toEqual(['Alice Anderson']);
  });

  it('reports API failures instead of presenting an empty interview list', () => {
    const api = {
      listInterviewStudents: vi.fn().mockReturnValue(throwError(() => new Error('offline'))),
    } as unknown as GraduationApplicationStageService;
    const component = new InterviewStudentsComponent(api, { markForCheck: vi.fn() } as any);

    component.ngOnInit();

    expect(component.failed).toBe(true);
    expect(component.loading).toBe(false);
  });

  it('requests a view refresh when the interview request completes asynchronously', () => {
    const response = new Subject<GraduationApplicationInterviewStudent[]>();
    const api = { listInterviewStudents: vi.fn().mockReturnValue(response) } as unknown as GraduationApplicationStageService;
    const cdr = { markForCheck: vi.fn() };
    const component = new InterviewStudentsComponent(api, cdr as any);
    component.ngOnInit();

    expect(component.loading).toBe(true);
    response.next([]);
    response.complete();

    expect(component.loading).toBe(false);
    expect(cdr.markForCheck).toHaveBeenCalledTimes(1);
  });
});
