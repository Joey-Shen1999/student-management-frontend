import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize, timeout } from 'rxjs/operators';

import {
  GraduationApplicationInterviewStudent,
  GraduationApplicationStageService,
} from '../../services/graduation-application-stage.service';
import { TranslatePipe } from '../../shared/i18n/translate.pipe';
import { uiText } from '../../shared/i18n/ui-translations';

interface InterviewStudentGroup {
  studentId: number;
  studentName: string;
  username: string;
  universities: { id: number; name: string }[];
}

@Component({
  selector: 'app-interview-students',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslatePipe],
  templateUrl: './interview-students.component.html',
  styleUrl: './interview-students.component.scss',
})
export class InterviewStudentsComponent implements OnInit {
  readonly year = new Date().getFullYear();
  readonly ui = {
    section: uiText('申请管理', 'Application Management'),
    title: uiText('本年需要视频面试的学生', 'Students Requiring Video Interviews This Year'),
    description: uiText('按预计毕业年份筛选已进入正式申请、且大学申请勾选“视频面试”的学生。',
      'Students graduating this year with a formal university application marked as requiring a video interview.'),
    studentCount: uiText('学生人数', 'Students'),
    universityCount: uiText('视频面试申请', 'Video Interview Applications'),
    search: uiText('搜索学生或大学', 'Search student or university'),
    refresh: uiText('刷新', 'Refresh'),
    back: uiText('返回申请管理', 'Back to Applications'),
    loading: uiText('正在读取视频面试名单...', 'Loading video interview list...'),
    error: uiText('视频面试名单读取失败，请重试。', 'Failed to load video interview list. Please retry.'),
    empty: uiText('本年暂无已标记需要视频面试的申请。', 'No applications are marked as requiring a video interview this year.'),
    noMatches: uiText('没有符合搜索条件的学生。', 'No students match your search.'),
    universities: uiText('需要视频面试的大学', 'Universities Requiring Video Interviews'),
    view: uiText('查看申请', 'View Applications'),
  };

  rows: GraduationApplicationInterviewStudent[] = [];
  search = '';
  loading = false;
  failed = false;

  constructor(
    private applications: GraduationApplicationStageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  get groups(): InterviewStudentGroup[] {
    const byStudent = new Map<number, InterviewStudentGroup>();
    for (const row of this.rows) {
      let group = byStudent.get(row.studentId);
      if (!group) {
        group = {
          studentId: row.studentId,
          studentName: row.studentName,
          username: row.username || '',
          universities: [],
        };
        byStudent.set(row.studentId, group);
      }
      if (!group.universities.some((university) => university.id === row.universityId)) {
        group.universities.push({ id: row.universityId, name: row.universityName });
      }
    }
    return [...byStudent.values()];
  }

  get filteredGroups(): InterviewStudentGroup[] {
    const query = this.search.trim().toLocaleLowerCase();
    if (!query) return this.groups;
    return this.groups.filter((group) =>
      [group.studentName, group.username, ...group.universities.map((item) => item.name)]
        .some((value) => value.toLocaleLowerCase().includes(query))
    );
  }

  load(): void {
    if (this.loading) return;
    this.loading = true;
    this.failed = false;
    this.applications.listInterviewStudents(this.year)
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

  trackStudent(_index: number, group: InterviewStudentGroup): number {
    return group.studentId;
  }

  trackUniversity(_index: number, university: { id: number }): number {
    return university.id;
  }
}
