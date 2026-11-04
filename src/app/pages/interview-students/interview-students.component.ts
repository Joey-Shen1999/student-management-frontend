import { TeacherPreferenceService } from '../../services/teacher-preference.service';
import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize, timeout } from 'rxjs/operators';
import { Observable } from 'rxjs';

import {
  GraduationApplicationStageService,
  InterviewCourseLesson,
  InterviewCoursePlan,
  InterviewTeacherOption,
} from '../../services/graduation-application-stage.service';
import { TranslatePipe } from '../../shared/i18n/translate.pipe';
import { uiText } from '../../shared/i18n/ui-translations';
import { InterviewTimetableComponent } from './interview-timetable.component';
import { LucideTriangleAlert } from '@lucide/angular';
import { conflictingBookings, lessonStart } from './interview-schedule.utils';

@Component({
  selector: 'app-interview-students',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslatePipe, InterviewTimetableComponent, LucideTriangleAlert],
  templateUrl: './interview-students.component.html',
  styleUrl: './interview-students.component.scss',
})
export class InterviewStudentsComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
  readonly minutes = ['00', '15', '30', '45'];
  private clockTimer?: ReturnType<typeof setInterval>;
  private destroyed = false;
  private readonly today = new Date();
  readonly year = this.today.getFullYear() + (this.today.getMonth() >= 8 ? 1 : 0);
  readonly ui = {
    section: uiText('申请管理', 'Application Management'),
    title: uiText('本年面试课学生', 'Interview Course Students This Academic Year'),
    cohort: uiText(`${this.year} 届`, `Class of ${this.year}`),
    description: uiText('按学生管理面试课，查看已报名工程申请。每位学生默认四节空课，可继续添加。',
      'Manage interview courses by student and view registered engineering applications. Each student starts with four empty lessons.'),
    studentCount: uiText('学生人数', 'Students'),
    scheduledCount: uiText('已安排课程', 'Scheduled Lessons'),
    search: uiText('搜索学生／大学／专业', 'Search students, universities or programs'),
    refresh: uiText('刷新', 'Refresh'),
    back: uiText('返回申请管理', 'Back to Applications'),
    loading: uiText('正在读取面试课名单...', 'Loading interview course students...'),
    error: uiText('面试课名单读取失败，请重试。', 'Failed to load interview courses. Please retry.'),
    empty: uiText(`${this.year} 届暂无已激活面试课的学生。`, `No students in the class of ${this.year} have interview courses enabled.`),
    noMatches: uiText('没有符合搜索条件的学生。', 'No students match your search.'),
    view: uiText('查看学生申请', 'View Student Applications'),
    date: uiText('日期', 'Date'),
    time: uiText('时间', 'Time'),
    hour: uiText('小时', 'Hour'),
    minute: uiText('分钟', 'Minute'),
    unscheduled: uiText('待安排', 'Unscheduled'),
    tentative: uiText('待确认', 'Unconfirmed'),
    confirmed: uiText('已确认', 'Confirmed'),
    past: uiText('已过时间', 'Past'),
    confirm: uiText('确认时间（蓝色）', 'Confirm time (blue)'),
    unconfirm: uiText('改为待确认（黄色）', 'Mark unconfirmed (yellow)'),
    add: uiText('添加一节课', 'Add a Lesson'),
    saving: uiText('保存中...', 'Saving...'),
    saveError: uiText('课程保存失败，请重试。', 'Could not save the lesson. Please retry.'),
    showHidden: uiText('显示本年已隐藏', 'Show Hidden This Year'),
    hideCompleted: uiText('隐藏已结束', 'Hide Past Lessons'),
    noVisible: uiText('其余学生的课程均已结束，可查看已隐藏学生。', 'All remaining students have past lessons. Show hidden students to view them.'),
    engineeringApplications: uiText('已报名工程申请', 'Engineering Applications'),
    missingSchool: uiText('尚未进入升学阶段，未选择具体学校', 'Not in the application stage: no schools selected'),
    missingYear: uiText('未填写毕业年份', 'Graduation year not set'),
    conflict: uiText('预约时间冲突', 'Overlapping booking'),
  };

  rows: InterviewCoursePlan[] = [];
  view: 'students' | 'timetable' = 'students';
  readonly studentsView = uiText('学生列表', 'Students');
  applyTimetablePlan(plan: InterviewCoursePlan): void {
    this.rows = this.rows.map(row => row.studentId === plan.studentId ? plan : row);
  }
  search = '';
  showHidden = false;
  settingsOpen = false;
  autoHideEnded = true;
  settingsSaving = false;
  managerOpen = false;
  roster: InterviewTeacherOption[] = [];
  rosterLoading = false;
  rosterError = '';
  readonly settingsTitle = uiText('面试课设置', 'Interview Course Settings');
  readonly manageTitle = uiText('管理面试课老师', 'Manage Interview Teachers');
  readonly autoHideLabel = uiText('自动隐藏已结束课程的学生', 'Automatically hide students with completed lessons');
  readonly enableLabel = uiText('添加为面试课老师', 'Enable interview teacher');
  readonly removeLabel = uiText('移出面试课名单', 'Remove from interview roster');
  readonly closeLabel = uiText('关闭', 'Close');

  @HostListener('document:click', ['$event'])
  closePanelsOutside(event: MouseEvent): void {
    const target = event.target;
    if (target instanceof Element && target.closest('.course-settings, .course-panel-toggle')) return;
    this.settingsOpen = false;
    this.managerOpen = false;
  }

  openManager(): void {
    this.managerOpen = true; this.rosterError = ''; this.rosterLoading = true;
    this.applications.listInterviewCourseTeachers(true).pipe(timeout(10000), finalize(() => {
      this.rosterLoading = false; this.cdr.markForCheck();
    })).subscribe({next: rows => this.roster = rows || [], error: () => this.rosterError = '老师名单读取失败，请关闭后重试。'});
  }

  toggleRoster(teacher: InterviewTeacherOption): void {
    if (this.rosterLoading) return;
    this.rosterLoading = true; this.rosterError = '';
    this.applications.setInterviewTeacherEnabled(teacher.teacherId, teacher.enabled === false)
      .pipe(timeout(10000), finalize(() => { this.rosterLoading = false; this.cdr.markForCheck(); }))
      .subscribe({next: rows => { this.roster = rows; this.teachers = rows.filter(t => t.enabled !== false); },
        error: err => this.rosterError = err.status === 409 ? '该老师仍有学生分配，请先改派或取消分配后再移除。' : '保存失败，请重试。'});
  }

  setAutoHide(value: boolean): void {
    if (this.settingsSaving) return;
    const previous = this.autoHideEnded;
    this.autoHideEnded = value;
    if (!this.preferences) return;
    this.settingsSaving = true;
    this.preferences.upsertPagePreference('interview-course.settings', {version:'v1',visibleColumnKeys:value ? ['hide-ended'] : []})
      .pipe(timeout(10000), finalize(() => {this.settingsSaving = false;this.cdr.markForCheck();}))
      .subscribe({error: () => {this.autoHideEnded = previous;this.rosterError = '设置保存失败，请重试。';}});
  }
  loading = false;
  failed = false;
  teachers: InterviewTeacherOption[] = [];
  teachersLoading = false;
  teachersFailed = false;
  readonly teacherUi = {
    label: uiText('面试老师', 'Interview Teacher'),
    loading: uiText('读取老师账号...', 'Loading teachers...'),
    unassigned: uiText('未分配老师', 'Unassigned'),
    retry: uiText('老师读取失败，重试', 'Could not load teachers. Retry'),
  };
  hasTeacherOption(id: number): boolean { return this.teachers.some(teacher => teacher.teacherId === id); }
  private busyStudentIds = new Set<number>();
  studentErrors = new Map<number, string>();

  constructor(private applications: GraduationApplicationStageService,
              private cdr: ChangeDetectorRef, private preferences: TeacherPreferenceService = null!) {}

  ngOnInit(): void {
    this.load();
    this.preferences?.getPagePreference('interview-course.settings').subscribe({
      next: value => { if(value.version === 'v1') this.autoHideEnded = !!value.visibleColumnKeys?.includes('hide-ended'); this.cdr.markForCheck(); },
      error: () => {},
    });
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => { if (!this.destroyed) this.loadTeachers(); });
    this.clockTimer = setInterval(() => this.cdr.markForCheck(), 30000);
  }

  ngOnDestroy(): void { this.destroyed = true; clearInterval(this.clockTimer); }

  loadTeachers(): void {
    if (this.teachersLoading) return;
    this.teachersLoading = true;
    this.teachersFailed = false;
    this.applications.listInterviewCourseTeachers().pipe(timeout(10000), finalize(() => {
      this.teachersLoading = false;
      this.cdr.markForCheck();
    })).subscribe({
      next: teachers => this.teachers = teachers || [],
      error: () => this.teachersFailed = true,
    });
  }

  changeTeacher(row: InterviewCoursePlan, teacherId: number | null): void {
    if (this.isBusy(row.studentId) || this.teachersLoading || this.teachersFailed) return;
    if ((row.teacherId ?? null) === teacherId) return;
    if (teacherId !== null && !this.teachers.some(teacher => teacher.teacherId === teacherId)) return;
    const previous = row.teacherId;
    row.teacherId = teacherId;
    this.runMutation(row.studentId, this.applications.setInterviewCourseTeacher(row.studentId, teacherId),
      undefined, () => row.teacherId = previous);
  }

  get filteredRows(): InterviewCoursePlan[] {
    const query = this.search.trim().toLocaleLowerCase();
    const visible = this.rows.filter(row => !this.autoHideEnded || this.showHidden || !this.isHidden(row));
    if (!query) return visible;
    return visible.filter((row) => [row.studentName, row.username,
      ...(row.engineeringApplications || []).flatMap((item) => [item.universityName, item.programName])]
      .some((value) => (value || '').toLocaleLowerCase().includes(query)));
  }

  isHidden(row: InterviewCoursePlan): boolean {
    return row.lessons.length >= 4 && row.lessons.every(lesson => this.lessonState(lesson) === 'past')
      && !this.isBusy(row.studentId) && !this.studentErrors.has(row.studentId);
  }

  get hiddenCount(): number { return this.rows.filter(row => this.isHidden(row)).length; }

  get scheduledCount(): number {
    return this.rows.reduce((count, row) => count + row.lessons.filter(
      (lesson) => !!lesson.lessonDate && !!lesson.lessonTime
    ).length, 0);
  }

  load(): void {
    if (this.loading) return;
    this.loading = true;
    this.failed = false;
    this.applications.listInterviewCourseStudents(this.year)
      .pipe(timeout(10000), finalize(() => {
        this.loading = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (rows) => this.rows = rows || [],
        error: () => {
          this.rows = [];
          this.failed = true;
        },
      });
  }

  isBusy(studentId: number): boolean { return this.busyStudentIds.has(studentId); }

  changeLessonDate(row: InterviewCoursePlan, lesson: InterviewCourseLesson, value: string): void {
    this.saveLesson(row, lesson, { lessonDate: value || null, confirmed: false });
  }

  changeLessonTime(row: InterviewCoursePlan, lesson: InterviewCourseLesson, value: string): void {
    this.saveLesson(row, lesson, { lessonTime: value || null, confirmed: false });
  }

  changeLessonHour(row: InterviewCoursePlan, lesson: InterviewCourseLesson, value: string): void {
    if (value && !this.hours.includes(value)) return;
    this.changeLessonTime(row, lesson, value ? `${value}:${this.lessonMinute(lesson) || '00'}` : '');
  }

  changeLessonMinute(row: InterviewCoursePlan, lesson: InterviewCourseLesson, value: string): void {
    if (!lesson.lessonTime || !this.minutes.includes(value)) return;
    this.changeLessonTime(row, lesson, `${this.lessonHour(lesson)}:${value}`);
  }

  lessonHour(lesson: InterviewCourseLesson): string { return lesson.lessonTime?.slice(0, 2) || ''; }
  lessonMinute(lesson: InterviewCourseLesson): string { return lesson.lessonTime?.slice(3, 5) || ''; }

  lessonState(lesson: InterviewCourseLesson): 'unscheduled' | 'tentative' | 'confirmed' | 'past' {
    if (!lesson.lessonDate || !lesson.lessonTime) return 'unscheduled';
    if (new Date(`${lesson.lessonDate}T${lesson.lessonTime}`).getTime() <= Date.now()) return 'past';
    return lesson.confirmed ? 'confirmed' : 'tentative';
  }

  toggleConfirmation(row: InterviewCoursePlan, lesson: InterviewCourseLesson): void {
    const state = this.lessonState(lesson);
    if (state === 'unscheduled' || state === 'past') return;
    this.saveLesson(row, lesson, { confirmed: !lesson.confirmed });
  }

  addLesson(row: InterviewCoursePlan): void {
    if (this.isBusy(row.studentId)) return;
    this.runMutation(row.studentId, this.applications.addInterviewCourseLesson(row.studentId));
  }

  trackStudent(_index: number, row: InterviewCoursePlan): number { return row.studentId; }
  lessonConflictDetails(row: InterviewCoursePlan, lesson: InterviewCourseLesson): string {
    const start = lessonStart(lesson);
    if (!start) return '';
    const conflicts = conflictingBookings(this.rows, row.studentId, lesson.id, start);
    return conflicts.length ? `${this.ui.conflict.zh}: ${conflicts.map(item =>
      `${item.student.studentName} · ${item.lesson.lessonNumber} · ${item.lesson.lessonDate} ${item.lesson.lessonTime?.slice(0, 5)}`).join('; ')}` : '';
  }
  trackLesson(_index: number, lesson: InterviewCourseLesson): number { return lesson.id; }
  lessonLabel(number: number) { return uiText(`第 ${number} 节`, `Lesson ${number}`); }

  private saveLesson(row: InterviewCoursePlan, lesson: InterviewCourseLesson,
                     changes: Partial<InterviewCourseLesson>): void {
    if (this.isBusy(row.studentId)) return;
    const previous = { ...lesson };
    Object.assign(lesson, changes);
    this.runMutation(row.studentId, this.applications.updateInterviewCourseLesson(
      row.studentId, lesson.id, lesson.lessonDate, lesson.lessonTime, lesson.confirmed ?? false
    ), undefined, () => Object.assign(lesson, previous));
  }

  private runMutation(studentId: number, request: Observable<InterviewCoursePlan>,
                      onSuccess?: () => void, onError?: () => void): void {
    this.busyStudentIds.add(studentId);
    this.studentErrors.delete(studentId);
    request.pipe(finalize(() => {
      this.busyStudentIds.delete(studentId);
      this.cdr.markForCheck();
    })).subscribe({
      next: (plan) => {
        this.rows = this.rows.map((row) => row.studentId === studentId ? plan : row);
        onSuccess?.();
      },
      error: () => {
        onError?.();
        this.studentErrors.set(studentId, this.ui.saveError.zh);
      },
    });
  }
}
