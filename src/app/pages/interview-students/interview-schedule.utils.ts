import type { InterviewCourseLesson, InterviewCoursePlan } from '../../services/graduation-application-stage.service';

export const INTERVIEW_DURATION_MS = 90 * 60000;

export function lessonStart(lesson: InterviewCourseLesson): Date | null {
  if (!lesson.lessonDate || !lesson.lessonTime) return null;
  const result = new Date(`${lesson.lessonDate}T${lesson.lessonTime}`);
  return Number.isNaN(result.getTime()) ? null : result;
}

export function conflictingBookings(rows: InterviewCoursePlan[], studentId: number, lessonId: number,
                                    start: Date): {student: InterviewCoursePlan; lesson: InterviewCourseLesson}[] {
  const student = rows.find(row => row.studentId === studentId);
  if (!student) return [];
  const end = start.getTime() + INTERVIEW_DURATION_MS;
  return rows.filter(row => row.studentId === studentId ||
    (student.teacherId != null && student.teacherId === row.teacherId)).flatMap(row => row.lessons
      .filter(lesson => {
        if (row.studentId === studentId && lesson.id === lessonId) return false;
        const other = lessonStart(lesson)?.getTime();
        return other !== undefined && other < end && other + INTERVIEW_DURATION_MS > start.getTime();
      }).map(lesson => ({student: row, lesson})));
}

export function bookingConflict(rows: InterviewCoursePlan[], studentId: number, lessonId: number, start: Date): boolean {
  return conflictingBookings(rows, studentId, lessonId, start).length > 0;
}
