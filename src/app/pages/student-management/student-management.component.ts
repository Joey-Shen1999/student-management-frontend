import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import {
  ResetStudentPasswordResponse,
  StudentAccount,
  StudentAccountStatus,
  StudentManagementService,
  UpdateStudentStatusResponse,
} from '../../services/student-management.service';

interface PasswordResetResult {
  studentId: number;
  username: string;
  tempPassword: string;
}

interface StatusUpdateResult {
  studentId: number;
  username: string;
  status: StudentAccountStatus;
}

@Component({
  selector: 'app-student-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div style="max-width:980px;margin:40px auto;font-family:Arial">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <h2 style="margin:0;">Student Account Management</h2>
        <a routerLink="/teacher/dashboard" style="margin-left:auto;">Back</a>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:14px 0 8px;">
        <button type="button" (click)="loadStudents()" [disabled]="loadingList">
          {{ loadingList ? 'Loading...' : 'Refresh List' }}
        </button>
        <span style="color:#666;font-size:13px;">Total: {{ students.length }}</span>
      </div>

      <div
        style="
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          flex-wrap:wrap;
          margin:0 0 14px;
          padding:10px 12px;
          border:1px solid #e7e9ef;
          border-radius:10px;
          background:#fafbfe;
        "
      >
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <button type="button" (click)="toggleInactiveVisibility()" [disabled]="loadingList">
            {{ showInactive ? 'Hide Inactive' : 'Show Inactive' }}
          </button>

          <input
            type="search"
            placeholder="Search by id, username, name, email"
            [(ngModel)]="searchKeyword"
            (ngModelChange)="applyListView()"
            [disabled]="loadingList"
            style="min-width:260px;max-width:360px;flex:1 1 300px;padding:6px 8px;"
          />

          <button
            type="button"
            (click)="clearListControls()"
            [disabled]="loadingList || (listLimit === 20 && !showInactive && !searchKeyword.trim())"
          >
            Clear
          </button>
        </div>

        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end;margin-left:auto;">
          <span style="color:#666;font-size:13px;white-space:nowrap;">
            Showing: {{ visibleStudents.length }} / Filtered: {{ filteredCount }}
          </span>

          <label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#444;">
            Limit
            <select
              [(ngModel)]="listLimit"
              (ngModelChange)="applyListView()"
              [disabled]="loadingList"
              style="padding:4px 6px;"
            >
              <option *ngFor="let size of limitOptions" [ngValue]="size">{{ size }}</option>
            </select>
          </label>
        </div>
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
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">Student ID</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">Username</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">Display Name</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">Email</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">Reset Password</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">Active</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let student of visibleStudents; trackBy: trackStudent">
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{{ resolveStudentId(student) ?? '-' }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{{ student.username || '-' }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{{ displayName(student) }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{{ student.email || '-' }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;text-align:center;">
                <button
                  type="button"
                  (click)="resetPassword(student)"
                  [disabled]="
                    !resolveStudentId(student) ||
                    resettingStudentId === resolveStudentId(student) ||
                    statusUpdatingStudentId === resolveStudentId(student)
                  "
                >
                  {{
                    resettingStudentId === resolveStudentId(student)
                      ? 'Resetting...'
                      : 'Reset password'
                  }}
                </button>
              </td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">
                <label
                  style="display:inline-flex;align-items:center;cursor:pointer;user-select:none;"
                  [style.opacity]="statusUpdatingStudentId === resolveStudentId(student) ? '0.7' : '1'"
                  title="Active"
                >
                  <input
                    type="checkbox"
                    [checked]="isActive(student)"
                    (change)="toggleActiveStatus(student)"
                    [disabled]="
                      !resolveStudentId(student) || statusUpdatingStudentId === resolveStudentId(student)
                    "
                    style="display:none;"
                  />

                  <span
                    style="position:relative;width:44px;height:24px;border-radius:999px;transition:all 0.2s ease;display:inline-block;"
                    [style.background]="
                      statusUpdatingStudentId === resolveStudentId(student)
                        ? '#bdbdbd'
                        : isArchived(student)
                          ? '#c62828'
                          : '#19a34a'
                    "
                  >
                    <span
                      style="position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:all 0.2s ease;box-shadow:0 1px 3px rgba(0,0,0,0.25);"
                      [style.transform]="isActive(student) ? 'translateX(20px)' : 'translateX(0)'"
                    ></span>
                  </span>
                </label>
              </td>
            </tr>
            <tr *ngIf="!loadingList && visibleStudents.length === 0">
              <td colspan="6" style="padding:14px;color:#666;text-align:center;">No students found.</td>
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
        *ngIf="statusResult"
        style="margin-top:14px;padding:12px;border:1px solid #cfe8cf;background:#f3fff3;border-radius:8px;"
      >
        <div style="font-weight:bold;">Account status updated successfully</div>
        <div style="margin-top:8px;"><b>Student:</b> {{ statusResult.username }}</div>
        <div style="margin-top:8px;"><b>New Status:</b> {{ statusResult.status }}</div>
      </div>

      <div
        *ngIf="resetResult"
        style="margin-top:14px;padding:12px;border:1px solid #cfe8cf;background:#f3fff3;border-radius:8px;"
      >
        <div style="font-weight:bold;">Temporary password reset successfully</div>
        <div style="margin-top:8px;"><b>Student:</b> {{ resetResult.username }}</div>
        <div style="margin-top:8px;">
          <b>Temporary Password (show once):</b>
          <pre
            style="margin:8px 0 0;padding:10px;background:#fff;border:1px solid #ddd;border-radius:6px;font-size:16px;"
          >{{ resetResult.tempPassword }}</pre>
        </div>
      </div>
    </div>
  `,
})
export class StudentManagementComponent implements OnInit {
  readonly limitOptions: number[] = [20, 50, 100];
  students: StudentAccount[] = [];
  visibleStudents: StudentAccount[] = [];
  filteredCount = 0;
  loadingList = false;
  listError = '';
  listLimit = 20;
  showInactive = false;
  searchKeyword = '';

  resettingStudentId: number | null = null;
  statusUpdatingStudentId: number | null = null;
  statusTarget: StudentAccountStatus | null = null;
  actionError = '';
  resetResult: PasswordResetResult | null = null;
  statusResult: StatusUpdateResult | null = null;

  constructor(
    private studentApi: StudentManagementService,
    private cdr: ChangeDetectorRef = { detectChanges: () => {} } as ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadStudents();
  }

  trackStudent = (_index: number, student: StudentAccount): string | number => {
    return this.resolveStudentId(student) ?? student.username;
  };

  displayName(student: StudentAccount): string {
    if (student.displayName?.trim()) return student.displayName.trim();

    const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim();
    return fullName || '-';
  }

  resolveStudentId(student: StudentAccount): number | null {
    const id = student.studentId ?? student.id ?? student.userId;
    return typeof id === 'number' && Number.isFinite(id) && id > 0 ? id : null;
  }

  loadStudents(): void {
    this.loadingList = true;
    this.listError = '';
    this.cdr.detectChanges();

    this.studentApi
      .listStudents()
      .pipe(
        finalize(() => {
          this.loadingList = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (payload) => {
          this.students = this.normalizeStudentList(payload);
          this.applyListView();
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.listError = this.extractErrorMessage(err) || 'Failed to load student list.';
          this.students = [];
          this.applyListView();
          this.cdr.detectChanges();
        },
      });
  }

  resetPassword(student: StudentAccount): void {
    const studentId = this.resolveStudentId(student);
    if (!studentId) {
      this.actionError = 'Missing student id, unable to reset password.';
      this.cdr.detectChanges();
      return;
    }

    this.actionError = '';
    this.resetResult = null;
    this.statusResult = null;
    this.resettingStudentId = studentId;
    this.cdr.detectChanges();

    this.studentApi
      .resetStudentPassword(studentId)
      .pipe(
        finalize(() => {
          this.resettingStudentId = null;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (resp: ResetStudentPasswordResponse) => {
          if (!resp?.tempPassword) {
            this.actionError = 'Reset succeeded but temp password is missing in response.';
            this.cdr.detectChanges();
            return;
          }

          this.resetResult = {
            studentId,
            username: resp.username || student.username || `#${studentId}`,
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

  toggleActiveStatus(student: StudentAccount): void {
    const targetStatus: StudentAccountStatus = this.isActive(student) ? 'ARCHIVED' : 'ACTIVE';
    this.setStudentStatus(student, targetStatus);
  }

  setStudentStatus(student: StudentAccount, targetStatus: StudentAccountStatus): void {
    const studentId = this.resolveStudentId(student);
    if (!studentId) {
      this.actionError = 'Missing student id, unable to update account status.';
      this.cdr.detectChanges();
      return;
    }

    this.actionError = '';
    this.resetResult = null;
    this.statusResult = null;
    this.statusUpdatingStudentId = studentId;
    this.statusTarget = targetStatus;
    this.cdr.detectChanges();

    this.studentApi
      .updateStudentStatus(studentId, targetStatus)
      .pipe(
        finalize(() => {
          this.statusUpdatingStudentId = null;
          this.statusTarget = null;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (resp: UpdateStudentStatusResponse) => {
          const resolvedStatus = this.resolveStatus(resp) || targetStatus;
          this.assignStatus(student, resolvedStatus);
          this.applyListView();
          this.statusResult = {
            studentId,
            username: resp.username || student.username || `#${studentId}`,
            status: resolvedStatus,
          };
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.actionError = this.extractStatusUpdateErrorMessage(err) || 'Failed to update account status.';
          this.cdr.detectChanges();
        },
      });
  }

  clearListControls(): void {
    this.listLimit = 20;
    this.showInactive = false;
    this.searchKeyword = '';
    this.applyListView();
  }

  toggleInactiveVisibility(): void {
    this.showInactive = !this.showInactive;
    this.applyListView();
  }

  applyListView(): void {
    const keyword = this.searchKeyword.trim().toLowerCase();
    const filtered = this.students.filter((student) => {
      if (!this.showInactive && this.resolveStatus(student) !== 'ACTIVE') {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const searchFields = [
        String(this.resolveStudentId(student) ?? ''),
        String(student.username || ''),
        this.displayName(student),
        String(student.email || ''),
      ];

      return searchFields.some((field) => field.toLowerCase().includes(keyword));
    });

    this.filteredCount = filtered.length;
    this.visibleStudents = filtered.slice(0, this.listLimit);
  }

  isArchived(student: StudentAccount): boolean {
    return this.resolveStatus(student) === 'ARCHIVED';
  }

  isActive(student: StudentAccount): boolean {
    return !this.isArchived(student);
  }

  private normalizeStudentList(
    payload: StudentAccount[] | { items?: StudentAccount[]; data?: StudentAccount[] } | null | undefined
  ): StudentAccount[] {
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

    return list.map((student) => ({
      ...student,
      status: this.resolveStatus(student),
    }));
  }

  private resolveStatus(value: unknown): StudentAccountStatus {
    if (value && typeof value === 'object') {
      const obj = value as any;
      const statusText = String(obj.status || obj.accountStatus || obj.userStatus || '')
        .trim()
        .toUpperCase();
      if (statusText === 'ACTIVE' || statusText === 'ARCHIVED') {
        return statusText as StudentAccountStatus;
      }

      if (obj.archived === true || obj.isArchived === true) {
        return 'ARCHIVED';
      }
      if (obj.archived === false || obj.isArchived === false) {
        return 'ACTIVE';
      }
      if (obj.active === false || obj.enabled === false || obj.disabled === true) {
        return 'ARCHIVED';
      }
      if (obj.active === true || obj.enabled === true || obj.disabled === false) {
        return 'ACTIVE';
      }
    }
    return 'ACTIVE';
  }

  private assignStatus(student: StudentAccount, status: StudentAccountStatus): void {
    student['status'] = status;
    student['archived'] = status === 'ARCHIVED';
    student['isArchived'] = status === 'ARCHIVED';
    student['active'] = status === 'ACTIVE';
    student['enabled'] = status === 'ACTIVE';
    student['disabled'] = status === 'ARCHIVED';
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

  private extractStatusUpdateErrorMessage(err: HttpErrorResponse): string {
    const status = err?.status;
    const code = this.extractErrorCode(err);

    if (status === 401) {
      return 'Unauthenticated. Please login again.';
    }
    if (status === 403 && code === 'MUST_CHANGE_PASSWORD_REQUIRED') {
      return 'Password change required before account management.';
    }
    if (status === 403) {
      return this.extractErrorMessage(err) || 'Forbidden: teacher/admin role required.';
    }
    if (status === 404 && code === 'NOT_FOUND') {
      return this.extractErrorMessage(err) || 'Student account not found.';
    }
    if (status === 400 && code === 'BAD_REQUEST') {
      return this.extractErrorMessage(err) || 'Invalid account status. Expected ACTIVE or ARCHIVED.';
    }

    return this.extractErrorMessage(err);
  }
}
