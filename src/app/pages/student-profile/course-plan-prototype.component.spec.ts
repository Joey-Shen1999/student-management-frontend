import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, convertToParamMap } from '@angular/router';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../services/auth.service';
import { CoursePlanPayload, CoursePlanService } from '../../services/course-plan.service';
import { CoursePlanPrototypeComponent } from './course-plan-prototype.component';

describe('CoursePlanPrototypeComponent', () => {
  let component: CoursePlanPrototypeComponent;
  let fixture: ComponentFixture<CoursePlanPrototypeComponent>;
  let routeParams$: BehaviorSubject<ParamMap>;
  let coursePlanApi: Pick<
    CoursePlanService,
    | 'getStudentCoursePlan'
    | 'saveStudentCoursePlan'
    | 'getTeacherStudentCoursePlan'
    | 'saveTeacherStudentCoursePlan'
  >;

  beforeEach(async () => {
    routeParams$ = new BehaviorSubject(convertToParamMap({}));
    coursePlanApi = {
      getStudentCoursePlan: vi.fn(() => of(emptyPayload())),
      saveStudentCoursePlan: vi.fn((payload: CoursePlanPayload) => of(payload)),
      getTeacherStudentCoursePlan: vi.fn(() => of(emptyPayload())),
      saveTeacherStudentCoursePlan: vi.fn((_studentId: number, payload: CoursePlanPayload) =>
        of(payload)
      ),
    };

    await TestBed.configureTestingModule({
      imports: [CoursePlanPrototypeComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: routeParams$.asObservable() } },
        { provide: AuthService, useValue: { getSession: () => ({ studentId: 7 }) } },
        { provide: CoursePlanService, useValue: coursePlanApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CoursePlanPrototypeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  it('auto-saves course edits without requiring a save click', () => {
    vi.useFakeTimers();

    component.addCourse(9);
    const course = findCourse(9, 0);
    course.courseCode = 'MTH1W';
    component.onCourseCodeInput(course);

    expect(coursePlanApi.saveStudentCoursePlan).not.toHaveBeenCalled();
    expect(component.autoSaveLabel).toBe('Unsaved changes...');

    vi.advanceTimersByTime(699);
    expect(coursePlanApi.saveStudentCoursePlan).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(coursePlanApi.saveStudentCoursePlan).toHaveBeenCalledTimes(1);
    const payload = (coursePlanApi.saveStudentCoursePlan as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as CoursePlanPayload;
    const savedGrade = payload.grades.find((grade) => grade.gradeLevel === 9);
    expect(savedGrade?.courses[0]).toEqual(expect.objectContaining({ courseCode: 'MTH1W' }));
    expect(component.savedMessage).toBe('Saved automatically.');
    expect(fixture.nativeElement.textContent).not.toContain('Save Course Plan');
  });

  it('skips duplicate auto-save requests when the payload is unchanged', () => {
    vi.useFakeTimers();

    component.addCourse(9);
    const course = findCourse(9, 0);
    course.courseCode = 'ENG1D';
    component.onCourseCodeInput(course);
    vi.advanceTimersByTime(700);

    const savedCourse = findCourse(9, 0);
    component.onCourseCodeInput(savedCourse);
    vi.advanceTimersByTime(700);

    expect(coursePlanApi.saveStudentCoursePlan).toHaveBeenCalledTimes(1);
  });

  it('saves the latest edit when a previous auto-save is still in flight', () => {
    vi.useFakeTimers();
    const firstSave$ = new Subject<CoursePlanPayload>();
    (coursePlanApi.saveStudentCoursePlan as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      firstSave$.asObservable()
    );

    component.addCourse(9);
    const course = findCourse(9, 0);
    course.courseCode = 'MTH1W';
    component.onCourseCodeInput(course);
    vi.advanceTimersByTime(700);

    expect(component.saving).toBe(true);
    expect(coursePlanApi.saveStudentCoursePlan).toHaveBeenCalledTimes(1);

    course.courseCode = 'ENG1D';
    component.onCourseCodeInput(course);

    const firstPayload = (coursePlanApi.saveStudentCoursePlan as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as CoursePlanPayload;
    firstSave$.next(firstPayload);
    firstSave$.complete();

    expect(findCourse(9, 0).courseCode).toBe('ENG1D');

    vi.advanceTimersByTime(0);

    expect(coursePlanApi.saveStudentCoursePlan).toHaveBeenCalledTimes(2);
    const latestPayload = (coursePlanApi.saveStudentCoursePlan as ReturnType<typeof vi.fn>).mock
      .calls[1][0] as CoursePlanPayload;
    expect(latestPayload.grades.find((grade) => grade.gradeLevel === 9)?.courses[0]).toEqual(
      expect.objectContaining({ courseCode: 'ENG1D' })
    );
  });

  function findCourse(gradeLevel: number, courseIndex: number) {
    const grade = component.grades.find((item) => item.level === gradeLevel);
    if (!grade) {
      throw new Error(`Grade ${gradeLevel} not found`);
    }
    const course = grade.courses[courseIndex];
    if (!course) {
      throw new Error(`Course ${courseIndex} not found in grade ${gradeLevel}`);
    }
    return course;
  }

  function emptyPayload(): CoursePlanPayload {
    return {
      currentGradeLevel: null,
      grade13Enabled: false,
      grades: [],
    };
  }
});
