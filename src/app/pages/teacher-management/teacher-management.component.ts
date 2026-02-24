import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import {
  ResetTeacherPasswordResponse,
  TeacherAccount,
  TeacherRole,
  TeacherManagementService,
  UpdateTeacherRoleResponse,
} from '../../services/teacher-management.service';

interface PasswordResetResult {
  teacherId: number;
  username: string;
  tempPassword: string;
}

interface RoleUpdateResult {
  teacherId: number;
  username: string;
  role: TeacherRole;
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
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">Role</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let teacher of teachers; trackBy: trackTeacher">
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{{ resolveTeacherId(teacher) ?? '-' }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{{ teacher.username || '-' }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{{ displayName(teacher) }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{{ teacher.email || '-' }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{{ displayRole(teacher) }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                  <label
                    style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;user-select:none;"
                    [style.opacity]="roleUpdatingTeacherId === resolveTeacherId(teacher) ? '0.7' : '1'"
                  >
                    <input
                      type="checkbox"
                      [checked]="isAdminRole(teacher)"
                      (change)="toggleAdminRole(teacher)"
                      [disabled]="!resolveTeacherId(teacher) || roleUpdatingTeacherId === resolveTeacherId(teacher)"
                      style="display:none;"
                    />

                    <span
                      style="position:relative;width:44px;height:24px;border-radius:999px;transition:all 0.2s ease;display:inline-block;"
                      [style.background]="
                        roleUpdatingTeacherId === resolveTeacherId(teacher)
                          ? '#bdbdbd'
                          : isAdminRole(teacher)
                            ? '#19a34a'
                            : '#c62828'
                      "
                    >
                      <span
                        style="position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:all 0.2s ease;box-shadow:0 1px 3px rgba(0,0,0,0.25);"
                        [style.transform]="isAdminRole(teacher) ? 'translateX(20px)' : 'translateX(0)'"
                      ></span>
                    </span>

                    <span style="font-size:12px;color:#444;">
                      {{
                        roleUpdatingTeacherId === resolveTeacherId(teacher)
                          ? 'Saving...'
                          : isAdminRole(teacher)
                            ? 'ADMIN'
                            : 'TEACHER'
                      }}
                    </span>
                  </label>

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
                </div>
              </td>
            </tr>
            <tr *ngIf="!loadingList && teachers.length === 0">
              <td colspan="6" style="padding:14px;color:#666;text-align:center;">No teachers found.</td>
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
        *ngIf="roleResult"
        style="margin-top:14px;padding:12px;border:1px solid #cfe8cf;background:#f3fff3;border-radius:8px;"
      >
        <div style="font-weight:bold;">Role updated successfully</div>
        <div style="margin-top:8px;"><b>Teacher:</b> {{ roleResult.username }}</div>
        <div style="margin-top:8px;"><b>New Role:</b> {{ roleResult.role }}</div>
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
  roleUpdatingTeacherId: number | null = null;
  roleTarget: TeacherRole | null = null;
  actionError = '';
  resetResult: PasswordResetResult | null = null;
  roleResult: RoleUpdateResult | null = null;

  constructor(
    private teacherApi: TeacherManagementService,
    private cdr: ChangeDetectorRef = { detectChanges: () => {} } as ChangeDetectorRef
  ) {}

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
    this.cdr.detectChanges();

    this.teacherApi
      .listTeachers()
      .pipe(
        finalize(() => {
          this.loadingList = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (payload) => {
          this.teachers = this.normalizeTeacherList(payload);
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.listError = this.extractErrorMessage(err) || 'Failed to load teacher list.';
          this.teachers = [];
          this.cdr.detectChanges();
        },
      });
  }

  resetPassword(teacher: TeacherAccount): void {
    const teacherId = this.resolveTeacherId(teacher);
    if (!teacherId) {
      this.actionError = 'Missing teacher id, unable to reset password.';
      this.cdr.detectChanges();
      return;
    }

    this.actionError = '';
    this.resetResult = null;
    this.roleResult = null;
    this.resettingTeacherId = teacherId;
    this.cdr.detectChanges();

    this.teacherApi
      .resetTeacherPassword(teacherId)
      .pipe(
        finalize(() => {
          this.resettingTeacherId = null;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (resp: ResetTeacherPasswordResponse) => {
          if (!resp?.tempPassword) {
            this.actionError = 'Reset succeeded but temp password is missing in response.';
            this.cdr.detectChanges();
            return;
          }

          this.resetResult = {
            teacherId,
            username: resp.username || teacher.username || `#${teacherId}`,
            tempPassword: resp.tempPassword,
          };
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.actionError = this.extractErrorMessage(err) || 'Failed to reset password.';
          this.cdr.detectChanges();
        },
      });
  }

  setRole(teacher: TeacherAccount, targetRole: TeacherRole): void {
    const teacherId = this.resolveTeacherId(teacher);
    if (!teacherId) {
      this.actionError = 'Missing teacher id, unable to update role.';
      this.cdr.detectChanges();
      return;
    }

    this.actionError = '';
    this.resetResult = null;
    this.roleResult = null;
    this.roleUpdatingTeacherId = teacherId;
    this.roleTarget = targetRole;
    this.cdr.detectChanges();

    this.teacherApi
      .updateTeacherRole(teacherId, targetRole)
      .pipe(
        finalize(() => {
          this.roleUpdatingTeacherId = null;
          this.roleTarget = null;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (resp: UpdateTeacherRoleResponse) => {
          const resolvedRole = this.normalizeRole(resp?.role) || targetRole;
          teacher.role = resolvedRole;
          this.roleResult = {
            teacherId,
            username: resp.username || teacher.username || `#${teacherId}`,
            role: resolvedRole,
          };
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.actionError = this.extractRoleUpdateErrorMessage(err) || 'Failed to update role.';
          this.cdr.detectChanges();
        },
      });
  }

  toggleAdminRole(teacher: TeacherAccount): void {
    const targetRole: TeacherRole = this.isAdminRole(teacher) ? 'TEACHER' : 'ADMIN';
    this.setRole(teacher, targetRole);
  }

  private normalizeTeacherList(
    payload: TeacherAccount[] | { items?: TeacherAccount[]; data?: TeacherAccount[] } | null | undefined
  ): TeacherAccount[] {
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

    return list.map((teacher) => ({
      ...teacher,
      role: this.normalizeRole(teacher.role) || teacher.role,
    }));
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

  displayRole(teacher: TeacherAccount): string {
    return this.normalizeRole(teacher.role) || '-';
  }

  isAdminRole(teacher: TeacherAccount): boolean {
    return this.normalizeRole(teacher.role) === 'ADMIN';
  }

  private normalizeRole(role: unknown): TeacherRole | null {
    const normalized = String(role || '').toUpperCase();
    return normalized === 'ADMIN' || normalized === 'TEACHER' ? normalized : null;
  }

  private extractRoleUpdateErrorMessage(err: HttpErrorResponse): string {
    const status = err?.status;
    const code = this.extractErrorCode(err);

    if (status === 401) {
      return 'Unauthenticated. Please login again.';
    }

    if (status === 403 && code === 'MUST_CHANGE_PASSWORD_REQUIRED') {
      return 'Password change required before role management.';
    }

    if (status === 403) {
      return this.extractErrorMessage(err) || 'Forbidden: admin role required.';
    }

    if (status === 404 && code === 'NOT_FOUND') {
      return this.extractErrorMessage(err) || 'Teacher account not found.';
    }

    if (status === 400 && code === 'BAD_REQUEST') {
      return this.extractErrorMessage(err) || 'Invalid role. Expected ADMIN or TEACHER.';
    }

    return this.extractErrorMessage(err);
  }

  private extractErrorCode(err: HttpErrorResponse): string {
    const payload = err?.error;
    if (payload && typeof payload === 'object') {
      return String((payload as any).code || '');
    }
    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        return String(parsed?.code || '');
      } catch {
        return '';
      }
    }
    return '';
  }
}
