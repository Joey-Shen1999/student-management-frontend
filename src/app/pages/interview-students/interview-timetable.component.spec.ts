import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { InterviewTimetableComponent } from './interview-timetable.component';
import { bookingConflict, lessonStart } from './interview-schedule.utils';
import { InterviewCoursePlan } from '../../services/graduation-application-stage.service';

const rows: InterviewCoursePlan[] = [
  {studentId: 1, studentName: 'Alex', username: 'alex', graduationYear: 2027, enabled: true,
    teacherId: 2, teacherName: 'Teacher', requirements: [], lessons: [
      {id: 11, lessonNumber: 1, lessonDate: '2026-11-03', lessonTime: '15:00', confirmed: true},
      {id: 12, lessonNumber: 2, lessonDate: null, lessonTime: null}]},
  {studentId: 2, studentName: 'Taylor', username: 'taylor', graduationYear: 2027, enabled: true,
    teacherId: 2, requirements: [], lessons: [{id: 21, lessonNumber: 1, lessonDate: null, lessonTime: null}]},
];

describe('Interview timetable', () => {
  function component(api: any = {}) {
    const instance = new InterviewTimetableComponent(api, {markForCheck: vi.fn()} as any);
    instance.rows = structuredClone(rows);
    instance.editor = {nativeElement: {showModal: vi.fn(), close: vi.fn(), open: false}} as any;
    instance.refreshEvents();
    return instance;
  }

  it('renders every scheduled lesson with a 90-minute duration and honors filters', () => {
    const c = component();
    c.ngOnChanges();
    const teacherOptions = c.teacherOptions;
    expect(c.teacherOptions).toBe(teacherOptions);
    const event = (c.options.events as any[])[0];
    expect((c.options.events as any[]).length).toBe(1);
    expect(event.end.getTime() - event.start.getTime()).toBe(90 * 60000);
    c.teacherFilter = 'none'; c.refreshEvents();
    expect(c.options.events).toEqual([]);
    c.teacherFilter = 'all'; c.search = 'taylor'; c.refreshEvents();
    expect(c.options.events).toEqual([]);
  });

  it('detects student and shared-teacher conflicts, excluding the edited lesson and adjacent bookings', () => {
    expect(bookingConflict(rows, 2, 21, new Date('2026-11-03T15:30'))).toBe(true);
    expect(bookingConflict(rows, 2, 21, new Date('2026-11-03T16:30'))).toBe(false);
    expect(bookingConflict(rows, 1, 11, new Date('2026-11-03T15:00'))).toBe(false);
    const different = structuredClone(rows); different[1].teacherId = 3;
    expect(bookingConflict(different, 2, 21, new Date('2026-11-03T15:30'))).toBe(false);
    expect(bookingConflict(different, 1, 12, new Date('2026-11-03T15:30'))).toBe(true);
  });

  it('prefills an empty lesson at the clicked time without altering existing lessons', () => {
    const c = component();
    c.openSlot(new Date('2026-11-03T23:45'));
    expect(c.booking?.lessonId).toBe(12);
    expect(c.endTime).toBe('2026-11-04 01:15');
    expect(c.rows).toEqual(rows);
    expect(lessonStart(rows[0].lessons[1])).toBeNull();
  });

  it('saves through the existing endpoint and preserves the editor after a failed save', () => {
    const api = {updateInterviewCourseLesson: vi.fn().mockReturnValue(of(rows[0]))};
    const c = component(api);
    const updated = vi.fn(); c.planUpdated.subscribe(updated);
    c.openSlot(new Date('2026-11-04T15:15')); c.save();
    expect(api.updateInterviewCourseLesson).toHaveBeenCalledWith(1, 12, '2026-11-04', '15:15', false);
    expect(updated).toHaveBeenCalledWith(rows[0]); expect(c.booking).toBeNull();
    api.updateInterviewCourseLesson.mockReturnValue(throwError(() => new Error('offline')));
    c.openSlot(new Date('2026-11-04T15:15')); c.save();
    expect(c.booking).not.toBeNull(); expect(c.error).not.toBe(''); expect(c.saving).toBe(false);
  });

  it('clears dates without deleting the lesson or teacher assignment', () => {
    const api = {updateInterviewCourseLesson: vi.fn().mockReturnValue(of(rows[0]))};
    const c = component(api); c.openLesson(1, 11); c.save(true);
    expect(api.updateInterviewCourseLesson).toHaveBeenCalledWith(1, 11, null, null, false);
  });

  it('warns about a teacher conflict without blocking a save', () => {
    const api = {updateInterviewCourseLesson: vi.fn().mockReturnValue(of(rows[1]))};
    const c = component(api);
    c.openLesson(2, 21);
    Object.assign(c.booking!, {date: '2026-11-03', hour: '15', minute: '30'});
    expect(c.bookingWarnings.join(' ')).toContain('Alex');
    c.save();
    expect(api.updateInterviewCourseLesson).toHaveBeenCalledWith(2, 21, '2026-11-03', '15:30', false);
    expect(c.booking).toBeNull();
  });

  it('shows only the selected teacher and flags conflicts even when the other student is filtered out', () => {
    const c = component();
    c.rows[1].lessons[0] = {id: 21, lessonNumber: 1, lessonDate: '2026-11-03', lessonTime: '15:30'};
    c.rows.push({...structuredClone(rows[1]), studentId: 3, studentName: 'Other', teacherId: 9,
      lessons: [{id: 31, lessonNumber: 1, lessonDate: '2026-11-03', lessonTime: '15:30'}]});
    c.refreshEvents();
    expect((c.options.events as any[]).map(e => e.id)).toEqual(['11', '21']);
    expect((c.options.events as any[]).every(e => e.extendedProps.conflict)).toBe(true);
    c.search = 'alex'; c.refreshEvents();
    expect((c.options.events as any[])).toHaveLength(1);
    expect((c.options.events as any[])[0].extendedProps.conflict).toBe(true);
    c.search = ''; c.selectTeacher('9');
    expect((c.options.events as any[]).map(e => e.id)).toEqual(['31']);
    expect((c.options.events as any[])[0].extendedProps.conflict).toBe(false);
  });
});
