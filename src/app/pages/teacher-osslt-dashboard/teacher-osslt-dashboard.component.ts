import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { of } from 'rxjs';
import { catchError, finalize, map, switchMap } from 'rxjs/operators';

import { resolveOssltStatusDisplay } from '../../features/osslt/osslt-status-display';
import { OssltTrackingStatus, TeacherStudentOssltSummary } from '../../features/osslt/osslt-types';
import { OssltTrackingService } from '../../services/osslt-tracking.service';
import { StudentAccount, StudentManagementService } from '../../services/student-management.service';

interface TeacherOssltListRow {
  studentId: number;
  username: string;
  displayName: string;
  email: string;
  trackingStatus: OssltTrackingStatus | null;
}

@Component({
  selector: 'app-teacher-osslt-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div style="padding: 20px; display: grid; gap: 12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <h2 style="margin:0;">OSSLT 跟踪</h2>
        <button type="button" [routerLink]="['/teacher/dashboard']">返回教师工作台</button>
      </div>

      <div *ngIf="loading" style="padding:12px;border:1px solid #d8e2f3;border-radius:8px;background:#f7fbff;">
        正在加载学生...
      </div>

      <div
        *ngIf="error"
        style="padding:12px;border:1px solid #f2b8b5;border-radius:8px;background:#fff1f0;color:#b00020;"
      >
        {{ error }}
      </div>

      <div *ngIf="!loading && !error" style="overflow:auto;border:1px solid #e3e8f0;border-radius:8px;">
        <table style="width:100%;border-collapse:collapse;min-width:780px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e3e8f0;">Name</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e3e8f0;">用户名</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e3e8f0;">邮箱</th>
              <th style="text-align:center;padding:10px;border-bottom:1px solid #e3e8f0;width:170px;">状态</th>
              <th style="text-align:center;padding:10px;border-bottom:1px solid #e3e8f0;width:220px;">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of rows; trackBy: trackRow">
              <td style="padding:10px;border-bottom:1px solid #f0f3f8;">{{ row.displayName }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f3f8;">{{ row.username }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f3f8;">{{ row.email || '-' }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f3f8;text-align:center;">
                <span
                  style="display:inline-flex;align-items:center;justify-content:center;min-width:120px;padding:2px 8px;border-radius:999px;border:1px solid;"
                  [ngStyle]="resolveStatusStyle(row.trackingStatus)"
                >
                  {{ resolveStatusLabel(row.trackingStatus) }}
                </span>
              </td>
              <td style="padding:10px;border-bottom:1px solid #f0f3f8;text-align:center;">
                <button type="button" [routerLink]="['/teacher/students', row.studentId, 'osslt']">
                  进入 OSSLT 跟踪
                </button>
              </td>
            </tr>
            <tr *ngIf="rows.length <= 0">
              <td colspan="5" style="padding:14px;text-align:center;color:#6a7385;">暂无学生数据。</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class TeacherOssltDashboardComponent implements OnInit {
  loading = false;
  error = '';
  rows: TeacherOssltListRow[] = [];

  constructor(
    private studentApi: StudentManagementService,
    private ossltApi: OssltTrackingService,
    private cdr: ChangeDetectorRef = { detectChanges: () => {} } as ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  trackRow = (_index: number, row: TeacherOssltListRow): number => row.studentId;

  resolveStatusLabel(status: OssltTrackingStatus | null): string {
    return resolveOssltStatusDisplay({ status }).label;
  }

  resolveStatusStyle(status: OssltTrackingStatus | null): Record<string, string> {
    const display = resolveOssltStatusDisplay({ status });
    return {
      color: display.textColor,
      background: display.background,
      borderColor: display.borderColor,
    };
  }

  private load(): void {
    this.loading = true;
    this.error = '';
    this.rows = [];
    this.cdr.detectChanges();

    this.studentApi
      .listStudents()
      .pipe(
        map((payload) => this.normalizeList(payload)),
        map((list) =>
          list.map((student) => this.toRow(student)).filter((row): row is TeacherOssltListRow => !!row)
        ),
        switchMap((rows) => {
          const studentIds = rows.map((row) => row.studentId);
          if (studentIds.length <= 0) {
            return of({ rows, summaries: [] as TeacherStudentOssltSummary[] });
          }
          return this.ossltApi.getTeacherStudentsOssltSummary(studentIds).pipe(
            map((summaries) => ({ rows, summaries })),
            catchError(() => of({ rows, summaries: [] as TeacherStudentOssltSummary[] }))
          );
        }),
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: ({ rows, summaries }) => {
          this.rows = this.attachSummary(rows, summaries);
          this.cdr.detectChanges();
        },
        error: () => {
          this.error = '加载学生失败。';
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

  private toRow(student: StudentAccount): TeacherOssltListRow | null {
    const studentId = this.resolveStudentId(student);
    if (!studentId) return null;

    return {
      studentId,
      username: String(student?.username || `#${studentId}`).trim(),
      displayName: this.resolveDisplayName(student),
      email: String(student?.email || '').trim(),
      trackingStatus: null,
    };
  }

  private attachSummary(
    rows: TeacherOssltListRow[],
    summaries: TeacherStudentOssltSummary[]
  ): TeacherOssltListRow[] {
    if (rows.length <= 0 || summaries.length <= 0) return rows;

    const trackingByStudentId = new Map<number, OssltTrackingStatus>();
    for (const item of summaries) {
      const studentId = Number(item?.studentId);
      if (!Number.isFinite(studentId) || studentId <= 0) continue;
      const status = item?.summary?.trackingStatus;
      if (!status) continue;
      trackingByStudentId.set(Math.trunc(studentId), status);
    }

    return rows.map((row) => ({
      ...row,
      trackingStatus: trackingByStudentId.get(row.studentId) ?? row.trackingStatus,
    }));
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
