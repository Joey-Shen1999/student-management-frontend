import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';

import {
  GraduationApplicationStageService,
  type InterviewCourseLesson,
  type InterviewCoursePlan,
} from '../../services/graduation-application-stage.service';

@Component({
  selector: 'app-student-interview-course',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './student-interview-course.component.html',
  styleUrl: './student-interview-course.component.scss',
})
export class StudentInterviewCourseComponent implements OnInit {
  plan: InterviewCoursePlan | null = null;
  loading = true;
  error = '';

  constructor(
    private readonly graduationStage: GraduationApplicationStageService,
    private readonly cdr: ChangeDetectorRef = { detectChanges: () => {} } as ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.graduationStage.getMyInterviewCourse().subscribe({
      next: (plan) => {
        this.plan = plan;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.plan = null;
        this.error = '面试课信息暂时无法加载，请重试。';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  get lessons(): InterviewCourseLesson[] {
    return [...(this.plan?.lessons || [])].sort((a, b) => a.lessonNumber - b.lessonNumber);
  }

  get scheduledCount(): number {
    return this.lessons.filter((lesson) => this.isScheduled(lesson)).length;
  }

  get nextLesson(): InterviewCourseLesson | null {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return this.lessons
      .filter((lesson) => this.isScheduled(lesson))
      .sort((a, b) => `${a.lessonDate} ${a.lessonTime}`.localeCompare(`${b.lessonDate} ${b.lessonTime}`))
      .find((lesson) => lesson.lessonDate! > today ||
        (lesson.lessonDate === today && lesson.lessonTime!.slice(0, 5) >= currentTime)) || null;
  }

  isScheduled(lesson: InterviewCourseLesson): boolean {
    return !!lesson.lessonDate && !!lesson.lessonTime;
  }

  displayDate(date: string | null): string {
    if (!date) return '待安排';
    const [year, month, day] = date.split('-');
    return `${year} 年 ${Number(month)} 月 ${Number(day)} 日`;
  }

  displayTime(time: string | null): string {
    return time ? time.slice(0, 5) : '';
  }

  displayLessonNumber(number: number): string {
    return String(number).padStart(2, '0');
  }

  trackLesson(_index: number, lesson: InterviewCourseLesson): number {
    return lesson.id;
  }
}
