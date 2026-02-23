import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import {
  ResetTeacherPasswordResponse,
  TeacherAccount,
  TeacherManagementService,
} from '../../services/teacher-management.service';

interface PasswordResetResult {
  teacherId: number;
  username: string;
  tempPassword: string;
}

@Component({
  selector: 'app-teacher-management',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div style="max-width:980px;margin:40px auto;font-family:Arial">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <h2 style="margin:0;">Teacher Management</h2>
        <a routerLink="/teacher/dashboard" style="margin-left:auto;">Back</a>
      </div>

      <p style="color:#666;line-height:1.6;margin-top:8px;">
        View all teacher accounts and reset password when a teacher forgets it.
      </p>

      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:14px 0;">
        <button type="button" (click)="loadTeachers()" [disabled]="loadingList">
          {{ loadingList ? 'Loading...' : 'Refresh List' }}
        </button>
        <span style="color:#666;font-size:13px;">Total: {{ teachers.length }}</span>
      </div>

      <div
        *ngIf="listError"
        style="margin-top:12px;padding:10px;border:1px solid #f2b8b5;background:#fff1f0;border-radius:8px;color:#b00020;"
      >
        {{ listError }}
      </div>

      <div style="margin-top:12px;border:1px solid #e5e5e5;border-radius:10px;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead style="background:#f6f7fb;">
            <tr>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">Teacher ID</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">Username</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">Display Name</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">Email</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let teacher of teachers; trackBy: trackTeacher">
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{{ resolveTeacherId(teacher) ?? '-' }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{{ teacher.username || '-' }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{{ displayName(teacher) }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{{ teacher.email || '-' }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">
                <button
                  type="button"
                  (click)="resetPassword(teacher)"
                  [disabled]="!resolveTeacherId(teacher) || resettingTeacherId === resolveTeacherId(teacher)"
                >
                  {{
                    resettingTeacherId === resolveTeacherId(teacher)
                      ? 'Resetting...'
                      : 'Reset to 8-char Temp Password'
                  }}
                </button>
              </td>
            </tr>
            <tr *ngIf="!loadingList && teachers.length === 0">
              <td colspan="5" style="padding:14px;color:#666;text-align:center;">No teachers found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        *ngIf="actionError"
        style="margin-top:14px;padding:10px;border:1px solid #f2b8b5;background:#fff1f0;border-radius:8px;color:#b00020;"
      >
        {{ actionError }}
      </div>

      <div
        *ngIf="resetResult"
        style="margin-top:14px;padding:12px;border:1px solid #cfe8cf;background:#f3fff3;border-radius:8px;"
      >
        <div style="font-weight:bold;">Temporary password reset successfully</div>
        <div style="margin-top:8px;"><b>Teacher:</b> {{ resetResult.username }}</div>
        <div style="margin-top:8px;">
          <b>Temporary Password (show once):</b>
          <pre
            style="margin:8px 0 0;padding:10px;background:#fff;border:1px solid #ddd;border-radius:6px;font-size:16px;"
          >{{ resetResult.tempPassword }}</pre>
        </div>
        <div style="margin-top:8px;color:#666;">
          Please send it to the teacher securely. First login will require password change.
        </div>
      </div>
    </div>
  `,
})
export class TeacherManagementComponent implements OnInit {
  teachers: TeacherAccount[] = [];
  loadingList = false;
  listError = '';

  resettingTeacherId: number | null = null;
  actionError = '';
  resetResult: PasswordResetResult | null = null;

  constructor(private teacherApi: TeacherManagementService) {}

  ngOnInit(): void {
    this.loadTeachers();
  }

  trackTeacher = (_index: number, teacher: TeacherAccount): string | number => {
    return this.resolveTeacherId(teacher) ?? teacher.username;
  };

  displayName(teacher: TeacherAccount): string {
    if (teacher.displayName?.trim()) return teacher.displayName.trim();

    const fullName = `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim();
    return fullName || '-';
  }

  resolveTeacherId(teacher: TeacherAccount): number | null {
    const id = teacher.teacherId ?? teacher.id ?? teacher.userId;
    return typeof id === 'number' && Number.isFinite(id) && id > 0 ? id : null;
  }

  loadTeachers(): void {
    this.loadingList = true;
    this.listError = '';

    this.teacherApi
      .listTeachers()
      .pipe(finalize(() => (this.loadingList = false)))
      .subscribe({
        next: (payload) => {
          this.teachers = this.normalizeTeacherList(payload);
        },
        error: (err: HttpErrorResponse) => {
          this.listError = this.extractErrorMessage(err) || 'Failed to load teacher list.';
          this.teachers = [];
        },
      });
  }

  resetPassword(teacher: TeacherAccount): void {
    const teacherId = this.resolveTeacherId(teacher);
    if (!teacherId) {
      this.actionError = 'Missing teacher id, unable to reset password.';
      return;
    }

    this.actionError = '';
    this.resetResult = null;
    this.resettingTeacherId = teacherId;

    this.teacherApi
      .resetTeacherPassword(teacherId)
      .pipe(finalize(() => (this.resettingTeacherId = null)))
      .subscribe({
        next: (resp: ResetTeacherPasswordResponse) => {
          if (!resp?.tempPassword) {
            this.actionError = 'Reset succeeded but temp password is missing in response.';
            return;
          }

          this.resetResult = {
            teacherId,
            username: resp.username || teacher.username || `#${teacherId}`,
            tempPassword: resp.tempPassword,
          };
        },
        error: (err: HttpErrorResponse) => {
          this.actionError = this.extractErrorMessage(err) || 'Failed to reset password.';
        },
      });
  }

  private normalizeTeacherList(
    payload: TeacherAccount[] | { items?: TeacherAccount[]; data?: TeacherAccount[] } | null | undefined
  ): TeacherAccount[] {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    const payload = err?.error;

    if (payload && typeof payload === 'object') {
      return (payload as any).message || (payload as any).error || '';
    }

    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        return parsed?.message || parsed?.error || payload;
      } catch {
        return payload;
      }
    }

    return err?.message || '';
  }
}
