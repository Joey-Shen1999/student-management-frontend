import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { type StudentAccount, StudentManagementService } from '../../services/student-management.service';

interface TeacherIeltsListRow {
  studentId: number;
  username: string;
  displayName: string;
  email: string;
}

@Component({
  selector: 'app-teacher-ielts-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div style="padding: 20px; display: grid; gap: 12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <h2 style="margin:0;">语言成绩跟踪</h2>
        <button type="button" [routerLink]="['/teacher/students']">返回学生管理</button>
      </div>

      <p style="margin:0;color:#5a6578;">
        该页面用于快速进入学生的语言成绩详情，避免和“学生管理”入口混淆。
      </p>

      <div *ngIf="loading" style="padding:12px;border:1px solid #d8e2f3;border-radius:8px;background:#f7fbff;">
        加载中...
      </div>

      <div
        *ngIf="error"
        style="padding:12px;border:1px solid #f2b8b5;border-radius:8px;background:#fff1f0;color:#b00020;"
      >
        {{ error }}
      </div>

      <div *ngIf="!loading && !error" style="overflow:auto;border:1px solid #e3e8f0;border-radius:8px;">
        <table style="width:100%;border-collapse:collapse;min-width:560px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e3e8f0;">姓名</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e3e8f0;">用户名</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e3e8f0;">邮箱</th>
              <th style="text-align:center;padding:10px;border-bottom:1px solid #e3e8f0;width:180px;">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of rows; trackBy: trackRow">
              <td style="padding:10px;border-bottom:1px solid #f0f3f8;">{{ row.displayName }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f3f8;">{{ row.username }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f3f8;">{{ row.email || '-' }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f3f8;text-align:center;">
                <button type="button" [routerLink]="['/teacher/students', row.studentId, 'ielts']">
                  进入语言成绩
                </button>
              </td>
            </tr>
            <tr *ngIf="rows.length <= 0">
              <td colspan="4" style="padding:14px;text-align:center;color:#6a7385;">暂无学生数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class TeacherIeltsDashboardComponent implements OnInit {
  loading = false;
  error = '';
  rows: TeacherIeltsListRow[] = [];

  constructor(
    private studentApi: StudentManagementService,
    private cdr: ChangeDetectorRef = { detectChanges: () => {} } as ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  trackRow = (_index: number, row: TeacherIeltsListRow): number => row.studentId;

  private load(): void {
    this.loading = true;
    this.error = '';
    this.rows = [];
    this.cdr.detectChanges();

    this.studentApi
      .listStudents()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (payload) => {
          const list = this.normalizeList(payload);
          this.rows = list
            .map((student) => this.toRow(student))
            .filter((row): row is TeacherIeltsListRow => !!row);
          this.cdr.detectChanges();
        },
        error: () => {
          this.error = '加载学生列表失败。';
          this.cdr.detectChanges();
        },
      });
  }

  private normalizeList(
    payload: StudentAccount[] | { items?: StudentAccount[]; data?: StudentAccount[] } | null | undefined
  ): StudentAccount[] {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  private toRow(student: StudentAccount): TeacherIeltsListRow | null {
    const studentId = this.resolveStudentId(student);
    if (!studentId) return null;

    return {
      studentId,
      username: String(student?.username || `#${studentId}`).trim(),
      displayName: this.resolveDisplayName(student),
      email: String(student?.email || '').trim(),
    };
  }

  private resolveDisplayName(student: StudentAccount): string {
    const firstName = String(student?.firstName || '').trim();
    const lastName = String(student?.lastName || '').trim();
    const fullName = `${firstName} ${lastName}`.trim();
    if (fullName) return fullName;

    const displayName = String(student?.displayName || '').trim();
    if (displayName) return displayName;

    return String(student?.username || '-').trim() || '-';
  }

  private resolveStudentId(student: StudentAccount): number | null {
    const candidates: unknown[] = [
      student?.studentId,
      (student as Record<string, unknown>)?.['student_id'],
      student?.id,
      student?.userId,
      student?.username,
    ];

    for (const candidate of candidates) {
      const text = String(candidate ?? '').trim();
      if (!text || !/^\d+$/.test(text)) continue;
      const parsed = Number(text);
      if (Number.isFinite(parsed) && parsed > 0) return Math.trunc(parsed);
    }
    return null;
  }
}
