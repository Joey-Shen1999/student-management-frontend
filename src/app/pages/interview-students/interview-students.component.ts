import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize, timeout } from 'rxjs/operators';
import { Observable } from 'rxjs';

import {
  GraduationApplicationStageService,
  InterviewCourseLesson,
  InterviewCoursePlan,
  InterviewCourseRequirement,
} from '../../services/graduation-application-stage.service';
import { TranslatePipe } from '../../shared/i18n/translate.pipe';
import { uiText } from '../../shared/i18n/ui-translations';

@Component({
  selector: 'app-interview-students',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslatePipe],
  templateUrl: './interview-students.component.html',
  styleUrl: './interview-students.component.scss',
})
export class InterviewStudentsComponent implements OnInit {
  private readonly today = new Date();
  readonly year = this.today.getFullYear() + (this.today.getMonth() >= 8 ? 1 : 0);
  readonly ui = {
    section: uiText('申请管理', 'Application Management'),
    title: uiText('本年面试课学生', 'Interview Course Students This Academic Year'),
    cohort: uiText(`${this.year} 届`, `Class of ${this.year}`),
    description: uiText('按学生管理面试课，标注需要面试的大学与专业。每位学生默认四节空课，可继续添加。',
      'Manage interview courses by student, including universities and programs that require interviews. Each student starts with four empty lessons.'),
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
    add: uiText('添加一节课', 'Add a Lesson'),
    saving: uiText('保存中...', 'Saving...'),
    saveError: uiText('课程保存失败，请重试。', 'Could not save the lesson. Please retry.'),
    requirements: uiText('面试需求', 'Interview Requirements'),
    requirementsEmpty: uiText('尚未标注需要面试的大学和专业。', 'No interview requirements added yet.'),
    university: uiText('大学', 'University'),
    program: uiText('专业／学科', 'Program / Subject'),
    addRequirement: uiText('添加面试需求', 'Add Requirement'),
    editRequirement: uiText('修改', 'Edit'),
    deleteRequirement: uiText('删除', 'Delete'),
    saveRequirement: uiText('保存', 'Save'),
    cancel: uiText('取消', 'Cancel'),
    requiredFields: uiText('请填写大学和专业／学科。', 'Enter both university and program / subject.'),
  };

  rows: InterviewCoursePlan[] = [];
  search = '';
  loading = false;
  failed = false;
  private busyStudentIds = new Set<number>();
  studentErrors = new Map<number, string>();
  requirementDrafts = new Map<number, { id: number | null; universityName: string; programName: string }>();

  constructor(private applications: GraduationApplicationStageService,
              private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.load(); }

  get filteredRows(): InterviewCoursePlan[] {
    const query = this.search.trim().toLocaleLowerCase();
    if (!query) return this.rows;
    return this.rows.filter((row) => [row.studentName, row.username,
      ...(row.requirements || []).flatMap((item) => [item.universityName, item.programName])]
      .some((value) => (value || '').toLocaleLowerCase().includes(query)));
  }

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
    lesson.lessonDate = value || null;
    this.saveLesson(row, lesson);
  }

  changeLessonTime(row: InterviewCoursePlan, lesson: InterviewCourseLesson, value: string): void {
    lesson.lessonTime = value || null;
    this.saveLesson(row, lesson);
  }

  addLesson(row: InterviewCoursePlan): void {
    if (this.isBusy(row.studentId)) return;
    this.runMutation(row.studentId, this.applications.addInterviewCourseLesson(row.studentId));
  }

  startRequirement(row: InterviewCoursePlan, requirement?: InterviewCourseRequirement): void {
    this.studentErrors.delete(row.studentId);
    this.requirementDrafts.set(row.studentId, {
      id: requirement?.id ?? null,
      universityName: requirement?.universityName ?? '',
      programName: requirement?.programName ?? '',
    });
  }

  cancelRequirement(studentId: number): void { this.requirementDrafts.delete(studentId); }

  saveRequirement(row: InterviewCoursePlan): void {
    const draft = this.requirementDrafts.get(row.studentId);
    if (!draft || this.isBusy(row.studentId)) return;
    const university = draft.universityName.trim();
    const program = draft.programName.trim();
    if (!university || !program || university.length > 200 || program.length > 200) {
      this.studentErrors.set(row.studentId, this.ui.requiredFields.zh);
      return;
    }
    const request = draft.id === null
      ? this.applications.addInterviewCourseRequirement(row.studentId, university, program)
      : this.applications.updateInterviewCourseRequirement(row.studentId, draft.id, university, program);
    this.runMutation(row.studentId, request, () => this.requirementDrafts.delete(row.studentId));
  }

  deleteRequirement(row: InterviewCoursePlan, requirement: InterviewCourseRequirement): void {
    if (this.isBusy(row.studentId)) return;
    this.runMutation(row.studentId,
      this.applications.deleteInterviewCourseRequirement(row.studentId, requirement.id),
      () => this.requirementDrafts.delete(row.studentId));
  }

  trackStudent(_index: number, row: InterviewCoursePlan): number { return row.studentId; }
  trackLesson(_index: number, lesson: InterviewCourseLesson): number { return lesson.id; }
  lessonLabel(number: number) { return uiText(`第 ${number} 节`, `Lesson ${number}`); }

  private saveLesson(row: InterviewCoursePlan, lesson: InterviewCourseLesson): void {
    if (this.isBusy(row.studentId)) return;
    this.runMutation(row.studentId, this.applications.updateInterviewCourseLesson(
      row.studentId, lesson.id, lesson.lessonDate, lesson.lessonTime
    ));
  }

  private runMutation(studentId: number, request: Observable<InterviewCoursePlan>, onSuccess?: () => void): void {
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
      error: () => this.studentErrors.set(studentId, this.ui.saveError.zh),
    });
  }
}
