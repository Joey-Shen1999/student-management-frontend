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
import {
  CreateStudentInviteResponse,
  StudentInviteService,
} from '../../services/student-invite.service';
import { AuthService } from '../../services/auth.service';
import {
  TeacherAccount,
  TeacherManagementService,
} from '../../services/teacher-management.service';

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

interface InviteTeacherOption {
  teacherId: number;
  label: string;
}

@Component({
  selector: 'app-student-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div style="max-width:980px;margin:40px auto;font-family:Arial">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <h2 style="margin:0;">学生账号管理</h2>
        <a routerLink="/teacher/dashboard" style="margin-left:auto;">返回</a>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:14px 0 8px;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <div *ngIf="isAdminUser" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#444;">
              教师
              <select
                [(ngModel)]="selectedInviteTeacherId"
                [disabled]="creatingInvite || loadingInviteTeachers"
                style="padding:7px 8px;min-width:180px;"
              >
                <option [ngValue]="null">{{ loadingInviteTeachers ? '加载中...' : '选择教师 ID' }}</option>
                <option *ngFor="let option of inviteTeacherOptions" [ngValue]="option.teacherId">
                  {{ option.label }}
                </option>
              </select>
            </label>

            <button
              type="button"
              (click)="refreshInviteTeachers()"
              [disabled]="creatingInvite || loadingInviteTeachers"
            >
              {{ loadingInviteTeachers ? '加载教师中...' : '刷新教师列表' }}
            </button>
          </div>

          <button type="button" (click)="loadStudents()" [disabled]="loadingList">
            {{ loadingList ? '加载中...' : '刷新列表' }}
          </button>

          <button
            type="button"
            (click)="createInviteLink()"
            [disabled]="creatingInvite || (isAdminUser && !selectedInviteTeacherId)"
          >
            {{ creatingInvite ? '生成中...' : '生成学生邀请链接' }}
          </button>
        </div>

        <span style="color:#666;font-size:13px;">总数：{{ students.length }}</span>
      </div>

      <div
        *ngIf="inviteTeacherLoadError"
        style="margin:0 0 12px;padding:10px;border:1px solid #f2b8b5;background:#fff1f0;border-radius:8px;color:#b00020;"
      >
        {{ inviteTeacherLoadError }}
      </div>

      <div
        *ngIf="inviteError"
        style="margin:0 0 12px;padding:10px;border:1px solid #f2b8b5;background:#fff1f0;border-radius:8px;color:#b00020;"
      >
        {{ inviteError }}
      </div>

      <div
        *ngIf="inviteLink"
        style="margin:0 0 12px;padding:12px;border:1px solid #cfe8cf;background:#f3fff3;border-radius:8px;"
      >
        <div style="font-weight:bold;">学生邀请链接已生成</div>
        <div style="margin-top:6px;color:#555;">一个链接只能注册一个新学生账号。</div>

        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px;">
          <input
            [value]="inviteLink"
            readonly
            style="flex:1 1 520px;min-width:280px;padding:8px;border:1px solid #ccc;border-radius:6px;"
          />
          <button type="button" (click)="copyInviteLink()">{{ inviteCopied ? '已复制' : '复制链接' }}</button>
        </div>

        <div *ngIf="inviteExpiresAt" style="margin-top:8px;color:#666;">
          <b>过期时间：</b> {{ inviteExpiresAt }}
        </div>
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
            {{ showInactive ? '隐藏已归档' : '显示已归档' }}
          </button>

          <input
            type="search"
            placeholder="按 ID、用户名、姓名、邮箱搜索"
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
            清空
          </button>
        </div>

        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end;margin-left:auto;">
          <span style="color:#666;font-size:13px;white-space:nowrap;">
            显示：{{ visibleStudents.length }} / 筛选后：{{ filteredCount }}
          </span>

          <label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#444;">
            数量
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
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">学生 ID</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">用户名</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">显示名称</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">邮箱</th>
              <th style="text-align:center;padding:10px;border-bottom:1px solid #e5e5e5;white-space:nowrap;width:120px;">档案</th>
              <th style="text-align:center;padding:10px;border-bottom:1px solid #e5e5e5;white-space:nowrap;width:120px;">重置密码</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">归档</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let student of visibleStudents; trackBy: trackStudent">
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{{ resolveStudentId(student) ?? '-' }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{{ student.username || '-' }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{{ displayName(student) }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{{ student.email || '-' }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;text-align:center;vertical-align:middle;">
                <button
                  type="button"
                  [routerLink]="profileRoute(student)"
                  style="min-width:86px;white-space:nowrap;"
                  [disabled]="!resolveStudentId(student)"
                >
                  编辑档案
                </button>
              </td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;text-align:center;vertical-align:middle;">
                <button
                  type="button"
                  (click)="resetPassword(student)"
                  style="min-width:86px;white-space:nowrap;"
                  [disabled]="
                    !resolveStudentId(student) ||
                    resettingStudentId === resolveStudentId(student) ||
                    statusUpdatingStudentId === resolveStudentId(student)
                  "
                >
                  {{
                    resettingStudentId === resolveStudentId(student)
                      ? '重置中...'
                      : '重置密码'
                  }}
                </button>
              </td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">
                <label
                  style="display:inline-flex;align-items:center;cursor:pointer;user-select:none;"
                  [style.opacity]="statusUpdatingStudentId === resolveStudentId(student) ? '0.7' : '1'"
                  title="归档"
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
              <td colspan="7" style="padding:14px;color:#666;text-align:center;">未找到学生账号。</td>
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
        <div style="font-weight:bold;">账号状态更新成功</div>
        <div style="margin-top:8px;"><b>学生：</b> {{ statusResult.username }}</div>
        <div style="margin-top:8px;"><b>新状态：</b> {{ statusResult.status === 'ACTIVE' ? '启用' : '归档' }}</div>
      </div>

      <div
        *ngIf="resetResult"
        style="margin-top:14px;padding:12px;border:1px solid #cfe8cf;background:#f3fff3;border-radius:8px;"
      >
        <div style="font-weight:bold;">临时密码重置成功</div>
        <div style="margin-top:8px;"><b>学生：</b> {{ resetResult.username }}</div>
        <div style="margin-top:8px;">
          <b>临时密码（仅显示一次）：</b>
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
  creatingInvite = false;
  inviteError = '';
  inviteLink = '';
  inviteExpiresAt = '';
  inviteCopied = false;
  isAdminUser = false;
  sessionTeacherId: number | null = null;
  selectedInviteTeacherId: number | null = null;
  inviteTeacherOptions: InviteTeacherOption[] = [];
  loadingInviteTeachers = false;
  inviteTeacherLoadError = '';

  resettingStudentId: number | null = null;
  statusUpdatingStudentId: number | null = null;
  statusTarget: StudentAccountStatus | null = null;
  actionError = '';
  resetResult: PasswordResetResult | null = null;
  statusResult: StatusUpdateResult | null = null;

  constructor(
    private studentApi: StudentManagementService,
    private inviteApi: StudentInviteService,
    private teacherApi: TeacherManagementService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef = { detectChanges: () => {} } as ChangeDetectorRef
  ) {
    this.captureSessionContext();
  }

  ngOnInit(): void {
    this.refreshInviteTeachers();
    this.loadStudents();
  }

  refreshInviteTeachers(): void {
    if (!this.isAdminUser) return;

    this.loadingInviteTeachers = true;
    this.inviteTeacherLoadError = '';
    this.cdr.detectChanges();

    this.teacherApi
      .listTeachers()
      .pipe(
        finalize(() => {
          this.loadingInviteTeachers = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (payload) => {
          this.inviteTeacherOptions = this.normalizeInviteTeacherOptions(payload);

          if (
            this.sessionTeacherId &&
            this.inviteTeacherOptions.some((option) => option.teacherId === this.sessionTeacherId)
          ) {
            this.selectedInviteTeacherId = this.sessionTeacherId;
          } else if (
            this.selectedInviteTeacherId &&
            !this.inviteTeacherOptions.some((option) => option.teacherId === this.selectedInviteTeacherId)
          ) {
            this.selectedInviteTeacherId = null;
          }

          if (!this.selectedInviteTeacherId && this.inviteTeacherOptions.length === 1) {
            this.selectedInviteTeacherId = this.inviteTeacherOptions[0].teacherId;
          }

          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.inviteTeacherLoadError = this.extractErrorMessage(err) || '加载教师 ID 列表失败。';
          this.inviteTeacherOptions = [];
          this.selectedInviteTeacherId = null;
          this.cdr.detectChanges();
        },
      });
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

  profileRoute(student: StudentAccount): string[] {
    const studentId = this.resolveStudentId(student);
    if (!studentId) {
      return ['/teacher/students'];
    }
    return ['/teacher/students', String(studentId), 'profile'];
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
          this.listError = this.extractErrorMessage(err) || '加载学生列表失败。';
          this.students = [];
          this.applyListView();
          this.cdr.detectChanges();
        },
      });
  }

  createInviteLink(): void {
    if (this.creatingInvite) return;

    const targetTeacherId = this.resolveTargetTeacherIdForInvite();
    if (this.isAdminUser && !targetTeacherId) {
      this.inviteError = '管理员生成邀请链接时必须选择教师 ID。';
      this.cdr.detectChanges();
      return;
    }

    this.creatingInvite = true;
    this.inviteError = '';
    this.inviteLink = '';
    this.inviteExpiresAt = '';
    this.inviteCopied = false;
    this.cdr.detectChanges();

    this.inviteApi
      .createInvite(targetTeacherId || undefined)
      .pipe(
        finalize(() => {
          this.creatingInvite = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (resp: CreateStudentInviteResponse) => {
          const resolvedLink = this.resolveInviteLink(resp);
          if (!resolvedLink) {
            this.inviteError = '邀请创建成功，但响应中缺少邀请链接。';
            this.cdr.detectChanges();
            return;
          }

          this.inviteLink = resolvedLink;
          this.inviteExpiresAt = String(resp?.expiresAt || '').trim();
          this.inviteCopied = false;
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.inviteError = this.extractErrorMessage(err) || '生成学生邀请链接失败。';
          this.cdr.detectChanges();
        },
      });
  }

  copyInviteLink(): void {
    if (!this.inviteLink) return;

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(this.inviteLink)
        .then(() => {
          this.inviteCopied = true;
          this.cdr.detectChanges();
        })
        .catch(() => {
          this.inviteCopied = false;
          this.cdr.detectChanges();
        });
      return;
    }

    this.inviteCopied = false;
    this.cdr.detectChanges();
  }

  private captureSessionContext(): void {
    const session = this.auth.getSession();
    const role = String(session?.role || '')
      .trim()
      .toUpperCase();
    this.isAdminUser = role === 'ADMIN';

    const teacherId = Number(session?.teacherId);
    this.sessionTeacherId = Number.isFinite(teacherId) && teacherId > 0 ? teacherId : null;
    this.selectedInviteTeacherId = this.sessionTeacherId;
  }

  private resolveTargetTeacherIdForInvite(): number | null {
    const value = this.isAdminUser ? this.selectedInviteTeacherId : this.sessionTeacherId;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
  }

  resetPassword(student: StudentAccount): void {
    const studentId = this.resolveStudentId(student);
    if (!studentId) {
      this.actionError = '缺少学生 ID，无法重置密码。';
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
            this.actionError = '重置成功，但响应中缺少临时密码。';
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
          this.actionError = this.extractErrorMessage(err) || '重置密码失败。';
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
      this.actionError = '缺少学生 ID，无法更新账号状态。';
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
          this.actionError = this.extractStatusUpdateErrorMessage(err) || '更新账号状态失败。';
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

  private normalizeInviteTeacherOptions(
    payload: TeacherAccount[] | { items?: TeacherAccount[]; data?: TeacherAccount[] } | null | undefined
  ): InviteTeacherOption[] {
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

    const unique = new Map<number, InviteTeacherOption>();
    for (const teacher of list) {
      const teacherId = this.resolveInviteTeacherId(teacher);
      if (!teacherId) continue;

      const username = String(teacher?.username || '').trim();
      const displayName = String(teacher?.displayName || '').trim();
      const name = displayName || username || '未知';

      unique.set(teacherId, {
        teacherId,
        label: `${teacherId} - ${name}`,
      });
    }

    return Array.from(unique.values()).sort((a, b) => a.teacherId - b.teacherId);
  }

  private resolveInviteTeacherId(teacher: TeacherAccount | null | undefined): number | null {
    const id = teacher?.teacherId ?? teacher?.id ?? teacher?.userId;
    return typeof id === 'number' && Number.isFinite(id) && id > 0 ? id : null;
  }

  private resolveInviteLink(resp: CreateStudentInviteResponse | null | undefined): string {
    const directLink = String(resp?.inviteUrl || resp?.registrationUrl || '').trim();
    if (directLink) return this.toAbsoluteUrl(directLink);

    const inviteToken = String(resp?.inviteToken || '').trim();
    if (!inviteToken) return '';

    const encodedToken = encodeURIComponent(inviteToken);
    return this.toAbsoluteUrl(`/register?inviteToken=${encodedToken}`);
  }

  private toAbsoluteUrl(url: string): string {
    const normalized = String(url || '').trim();
    if (!normalized) return '';

    if (/^https?:\/\//i.test(normalized)) {
      return normalized;
    }

    const origin = String((globalThis as any)?.location?.origin || '')
      .trim()
      .replace(/\/+$/, '');
    if (!origin) {
      return normalized;
    }

    if (normalized.startsWith('/')) {
      return `${origin}${normalized}`;
    }

    const cleaned = normalized.replace(/^\.?\//, '');
    return `${origin}/${cleaned}`;
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
      return '未登录或登录已过期，请重新登录。';
    }
    if (status === 403 && code === 'MUST_CHANGE_PASSWORD_REQUIRED') {
      return '请先修改密码后再进行账号管理。';
    }
    if (status === 403) {
      return this.extractErrorMessage(err) || '无权限：需要教师或管理员角色。';
    }
    if (status === 404 && code === 'NOT_FOUND') {
      return this.extractErrorMessage(err) || '未找到学生账号。';
    }
    if (status === 400 && code === 'BAD_REQUEST') {
      return this.extractErrorMessage(err) || '无效账号状态，必须为 ACTIVE 或 ARCHIVED。';
    }

    return this.extractErrorMessage(err);
  }
}
