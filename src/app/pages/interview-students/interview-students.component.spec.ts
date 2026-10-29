import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import {
  GraduationApplicationStageService,
  InterviewCoursePlan,
} from '../../services/graduation-application-stage.service';
import { InterviewStudentsComponent } from './interview-students.component';

const plans: InterviewCoursePlan[] = [
  { studentId: 1, studentName: 'Alice Anderson', username: 'alice', graduationYear: 2027,
    engineeringApplications: [{ id: 9, universityName: 'McMaster University', programName: 'Engineering I' }],
    enabled: true, requirements: [{ id: 101, universityName: 'McMaster University', programName: 'Engineering I' }], lessons: [
      { id: 11, lessonNumber: 1, lessonDate: null, lessonTime: null },
      { id: 12, lessonNumber: 2, lessonDate: '2026-05-01', lessonTime: '15:30:00' },
    ] },
  { studentId: 2, studentName: 'Bob Brown', username: 'bob', graduationYear: 2027,
    enabled: true, requirements: [], lessons: [{ id: 21, lessonNumber: 1, lessonDate: null, lessonTime: null }] },
];

describe('InterviewStudentsComponent', () => {
  it('hides every past lesson only for complete plans with at least four lessons', () => {
    const component = new InterviewStudentsComponent({} as any, {} as any);
    const past = (count: number) => Array.from({ length: count }, (_, i) => ({
      id: i + 1, lessonNumber: i + 1, lessonDate: '2000-01-01', lessonTime: '12:00',
    }));
    const four = { ...structuredClone(plans[0]), lessons: past(4) };
    const five = { ...structuredClone(plans[1]), lessons: past(5) };
    component.rows = [four, five];
    expect(component.showHidden).toBe(false);
    expect(component.hiddenCount).toBe(2);
    expect(component.filteredRows).toEqual([]);
    component.showHidden = true;
    expect(component.filteredRows).toHaveLength(2);
    component.search = 'bob';
    expect(component.filteredRows.map(row => row.studentId)).toEqual([2]);
    component.showHidden = false;
    expect(component.filteredRows).toEqual([]);
    expect(component.isHidden({ ...four, lessons: [] })).toBe(false);
    expect(component.isHidden({ ...four, lessons: past(3) })).toBe(false);
    five.lessons[4].lessonTime = '';
    expect(component.isHidden(five)).toBe(false);
    five.lessons[4].lessonTime = '12:00';
    five.lessons[4].lessonDate = '2099-01-01';
    expect(component.isHidden(five)).toBe(false);
    expect(component.rows).toHaveLength(2);
  });

  it('keeps a finished plan visible during a pending or failed save', () => {
    const response = new Subject<InterviewCoursePlan>();
    const component = new InterviewStudentsComponent({ updateInterviewCourseLesson: () => response } as any,
      { markForCheck: vi.fn() } as any);
    const row = structuredClone(plans[0]);
    row.lessons = Array.from({ length: 4 }, (_, i) => ({
      id: i, lessonNumber: i + 1, lessonDate: '2000-01-01', lessonTime: '12:00',
    }));
    row.lessons[3].lessonDate = '2099-01-01';
    component.rows = [row];
    component.changeLessonDate(row, row.lessons[3], '2000-01-01');
    expect(component.filteredRows).toHaveLength(1);
    response.error(new Error('offline'));
    expect(component.filteredRows).toHaveLength(1);
    expect(row.lessons[3].lessonDate).toBe('2099-01-01');
  });

  it('automatically hides a plan when its last scheduled time passes', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 9, 27, 12, 0));
      const component = new InterviewStudentsComponent({} as any, {} as any);
      const row = { ...structuredClone(plans[0]), lessons: Array.from({ length: 4 }, (_, i) => ({
        id: i, lessonNumber: i + 1, lessonDate: '2026-10-27', lessonTime: i === 3 ? '12:15' : '10:00',
      })) };
      component.rows = [row];
      expect(component.filteredRows).toHaveLength(1);
      vi.setSystemTime(new Date(2026, 9, 27, 12, 15));
      expect(component.filteredRows).toHaveLength(0);
      expect(component.hiddenCount).toBe(1);
    } finally { vi.useRealTimers(); }
  });

  it('searches automatically listed engineering applications', () => {
    const component = new InterviewStudentsComponent({} as any, {} as any);
    component.rows = [{ ...structuredClone(plans[0]), engineeringApplications: [
      { id: 1, universityName: 'University of Waterloo', programName: 'Systems Design Engineering' },
    ] }];
    component.search = 'systems design';
    expect(component.filteredRows).toHaveLength(1);
  });

  it('shows school warnings and keeps engineering applications collapsed initially', async () => {
    const row = { ...structuredClone(plans[0]), graduationStageEnabled: false, engineeringApplications: [
      { id: 1, universityName: 'University of Waterloo', programName: 'Mechanical Engineering' },
    ] };
    await TestBed.configureTestingModule({
      imports: [InterviewStudentsComponent],
      providers: [provideRouter([]), { provide: GraduationApplicationStageService,
        useValue: { listInterviewCourseStudents: () => of([row]) } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(InterviewStudentsComponent);
    try {
      fixture.detectChanges();
      await fixture.whenStable();
      const card = fixture.nativeElement.querySelector('.student-card') as HTMLElement;
      expect(card.classList.contains('needs-school')).toBe(true);
      expect(card.querySelector('.school-warning')?.textContent).toContain('未选择具体学校');
      const details = card.querySelector('details') as HTMLDetailsElement;
      expect(details.open).toBe(false);
      details.querySelector('summary')!.click();
      expect(details.open).toBe(true);
      expect(details.textContent).toContain('Mechanical Engineering');
      expect(fixture.nativeElement.textContent).not.toContain('面试需求');
      expect(fixture.nativeElement.textContent).not.toContain('McMaster University');
      expect(fixture.nativeElement.querySelector('.requirement-form')).toBeNull();
    } finally { fixture.destroy(); }
  });

  it('renders saved hours and minutes after dynamic options load', async () => {
    const row = structuredClone(plans[0]);
    row.lessons = [
      { id: 1, lessonNumber: 1, lessonDate: '2099-01-01', lessonTime: '23:45:00', confirmed: false },
      { id: 2, lessonNumber: 2, lessonDate: '2099-01-01', lessonTime: '00:00:00', confirmed: true },
      { id: 3, lessonNumber: 3, lessonDate: null, lessonTime: null },
      { id: 4, lessonNumber: 4, lessonDate: '2099-01-01', lessonTime: '09:17:00' },
    ];
    await TestBed.configureTestingModule({
      imports: [InterviewStudentsComponent],
      providers: [provideRouter([]), { provide: GraduationApplicationStageService,
        useValue: { listInterviewCourseStudents: () => of([row]) } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(InterviewStudentsComponent);
    try {
      fixture.detectChanges();
      await fixture.whenStable();
      const selects = Array.from(fixture.nativeElement.querySelectorAll('select')) as HTMLSelectElement[];
      expect(selects.map(select => select.value)).toEqual(['23', '45', '00', '00', '', '', '09', '17']);
      expect(selects[5].disabled).toBe(true);
      expect(Array.from(selects[1].options).filter(option => !option.disabled).map(option => option.value))
        .toEqual(['00', '15', '30', '45']);
      expect(fixture.nativeElement.querySelectorAll('.confirmation-toggle')).toHaveLength(3);
    } finally { fixture.destroy(); }
  });

  it.each([
    [2026, 7, 31, 2026],
    [2026, 8, 1, 2027],
    [2026, 9, 26, 2027],
    [2027, 0, 1, 2027],
    [2027, 5, 30, 2027],
    [2027, 7, 31, 2027],
    [2027, 8, 1, 2028],
  ])('requests the graduation cohort for %i-%i-%i', (year, month, day, cohort) => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(year, month, day, 12));
      const api = { listInterviewCourseStudents: vi.fn().mockReturnValue(of([])) } as unknown as GraduationApplicationStageService;
      const component = new InterviewStudentsComponent(api, { markForCheck: vi.fn() } as any);
      component.ngOnInit();
      expect(api.listInterviewCourseStudents).toHaveBeenCalledWith(cohort);
      expect(component.ui.cohort.zh).toBe(`${cohort} 届`);
    } finally {
      vi.useRealTimers();
    }
  });

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
    expect(api.updateInterviewCourseLesson).toHaveBeenCalledWith(1, 11, '2026-04-10', null, false);
    component.changeLessonTime(component.rows[0], component.rows[0].lessons[0], '13:00');
    expect(api.updateInterviewCourseLesson).toHaveBeenCalledWith(1, 11, '2026-04-10', '13:00', false);
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

  it('uses 24 hours and quarter-hour minutes, including midnight and 23:45', () => {
    const api = { updateInterviewCourseLesson: vi.fn().mockReturnValue(new Subject()) };
    const component = new InterviewStudentsComponent(api as any, { markForCheck: vi.fn() } as any);
    expect(component.hours).toHaveLength(24);
    expect(component.hours[0]).toBe('00');
    expect(component.hours[23]).toBe('23');
    expect(component.minutes).toEqual(['00', '15', '30', '45']);
    const row = structuredClone(plans[0]);
    component.changeLessonHour(row, row.lessons[0], '00');
    expect(api.updateInterviewCourseLesson).toHaveBeenCalledWith(1, 11, null, '00:00', false);

    const other = new InterviewStudentsComponent(api as any, { markForCheck: vi.fn() } as any);
    row.lessons[0].lessonTime = '23:00';
    other.changeLessonMinute(row, row.lessons[0], '45');
    expect(api.updateInterviewCourseLesson).toHaveBeenLastCalledWith(1, 11, null, '23:45', false);
  });

  it('keeps existing non-quarter minutes visible and rejects invalid new choices', () => {
    const api = { updateInterviewCourseLesson: vi.fn() };
    const component = new InterviewStudentsComponent(api as any, {} as any);
    const row = structuredClone(plans[0]);
    row.lessons[0].lessonTime = '09:17:00';
    expect(component.lessonMinute(row.lessons[0])).toBe('17');
    component.changeLessonMinute(row, row.lessons[0], '17');
    component.changeLessonHour(row, row.lessons[0], '24');
    expect(api.updateInterviewCourseLesson).not.toHaveBeenCalled();
  });

  it('derives blank, yellow, blue and green states using both date and time', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 9, 26, 10, 0));
      const component = new InterviewStudentsComponent({} as any, {} as any);
      const lesson = { id: 1, lessonNumber: 1, lessonDate: '2026-10-26', lessonTime: null as string | null, confirmed: false };
      expect(component.lessonState(lesson)).toBe('unscheduled');
      lesson.lessonTime = '10:15:00';
      expect(component.lessonState(lesson)).toBe('tentative');
      lesson.confirmed = true;
      expect(component.lessonState(lesson)).toBe('confirmed');
      vi.setSystemTime(new Date(2026, 9, 26, 10, 15));
      expect(component.lessonState(lesson)).toBe('past');
      lesson.confirmed = false;
      expect(component.lessonState(lesson)).toBe('past');
      lesson.lessonDate = '2026-10-27';
      expect(component.lessonState(lesson)).toBe('tentative');
    } finally { vi.useRealTimers(); }
  });

  it('persists blue/yellow toggles and clears confirmation when rescheduling', () => {
    const row = structuredClone(plans[0]);
    const lesson = { ...row.lessons[0], lessonDate: '2099-01-01', lessonTime: '23:45', confirmed: false };
    row.lessons = [lesson];
    const api = { updateInterviewCourseLesson: vi.fn().mockImplementation(() => of(structuredClone(row))) };
    const component = new InterviewStudentsComponent(api as any, { markForCheck: vi.fn() } as any);
    component.rows = [row];
    component.toggleConfirmation(row, lesson);
    expect(api.updateInterviewCourseLesson).toHaveBeenLastCalledWith(1, 11, '2099-01-01', '23:45', true);
    component.toggleConfirmation(row, lesson);
    expect(api.updateInterviewCourseLesson).toHaveBeenLastCalledWith(1, 11, '2099-01-01', '23:45', false);
    lesson.confirmed = true;
    component.changeLessonDate(row, lesson, '2099-01-02');
    expect(api.updateInterviewCourseLesson).toHaveBeenLastCalledWith(1, 11, '2099-01-02', '23:45', false);
    lesson.confirmed = true;
    component.changeLessonHour(row, lesson, '');
    expect(api.updateInterviewCourseLesson).toHaveBeenLastCalledWith(1, 11, '2099-01-02', null, false);
  });

  it('does not confirm unscheduled or past lessons or edit while a save is pending', () => {
    const api = { updateInterviewCourseLesson: vi.fn().mockReturnValue(new Subject()) };
    const component = new InterviewStudentsComponent(api as any, {} as any);
    const row = structuredClone(plans[0]);
    const lesson = row.lessons[0];
    component.toggleConfirmation(row, lesson);
    lesson.lessonDate = '2000-01-01';
    lesson.lessonTime = '12:00';
    component.toggleConfirmation(row, lesson);
    expect(api.updateInterviewCourseLesson).not.toHaveBeenCalled();
    component.changeLessonDate(row, lesson, '2099-01-01');
    component.changeLessonDate(row, lesson, '2099-01-02');
    expect(lesson.lessonDate).toBe('2099-01-01');
    expect(api.updateInterviewCourseLesson).toHaveBeenCalledTimes(1);
  });

  it('restores the saved date, time and confirmation when a save fails', () => {
    const api = { updateInterviewCourseLesson: vi.fn().mockReturnValue(throwError(() => new Error('offline'))) };
    const component = new InterviewStudentsComponent(api as any, { markForCheck: vi.fn() } as any);
    const row = structuredClone(plans[0]);
    const lesson = row.lessons[0];
    Object.assign(lesson, { lessonDate: '2099-01-01', lessonTime: '12:30', confirmed: true });
    component.changeLessonTime(row, lesson, '13:45');
    expect(lesson).toMatchObject({ lessonDate: '2099-01-01', lessonTime: '12:30', confirmed: true });
    expect(component.studentErrors.has(1)).toBe(true);
    expect(component.isBusy(1)).toBe(false);
  });

  it('refreshes elapsed-time colors and releases the clock on destroy', () => {
    vi.useFakeTimers();
    try {
      const cdr = { markForCheck: vi.fn() };
      const component = new InterviewStudentsComponent({} as any, cdr as any);
      component.ngAfterViewInit();
      vi.advanceTimersByTime(30000);
      expect(cdr.markForCheck).toHaveBeenCalledTimes(1);
      component.ngOnDestroy();
      vi.advanceTimersByTime(30000);
      expect(cdr.markForCheck).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });


});
