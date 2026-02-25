import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import {
  ResetTeacherPasswordResponse,
  TeacherAccount,
  TeacherAccountStatus,
  TeacherRole,
  TeacherManagementService,
  UpdateTeacherRoleResponse,
  UpdateTeacherStatusResponse,
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

interface StatusUpdateResult {
  teacherId: number;
  username: string;
  status: TeacherAccountStatus;
}

@Component({
  selector: 'app-teacher-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div style="max-width:980px;margin:40px auto;font-family:Arial">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <h2 style="margin:0;">教师账号管理</h2>
        <a routerLink="/teacher/dashboard" style="margin-left:auto;">返回</a>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:14px 0 8px;">
        <button type="button" (click)="loadTeachers()" [disabled]="loadingList">
          {{ loadingList ? '加载中...' : '刷新列表' }}
        </button>

        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-left:auto;">
          <span style="color:#666;font-size:13px;">总数：{{ teachers.length }}</span>
          <button type="button" routerLink="/teacher/invites">新增教师</button>
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
          <label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#444;">
            角色
            <select
              [(ngModel)]="roleFilter"
              (ngModelChange)="applyListView()"
              [disabled]="loadingList"
              style="padding:4px 6px;"
            >
              <option value="ALL">全部</option>
              <option value="ADMIN">管理员</option>
              <option value="TEACHER">教师</option>
            </select>
          </label>

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
            [disabled]="loadingList || (listLimit === 20 && roleFilter === 'ALL' && !showInactive && !searchKeyword.trim())"
          >
            清空
          </button>
        </div>

        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end;margin-left:auto;">
          <span style="color:#666;font-size:13px;white-space:nowrap;">
            显示：{{ visibleTeachers.length }} / 筛选后：{{ filteredCount }}
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
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">教师 ID</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">用户名</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">显示名称</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">邮箱</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">管理员</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">启用</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let teacher of visibleTeachers; trackBy: trackTeacher">
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{{ resolveTeacherId(teacher) ?? '-' }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{{ teacher.username || '-' }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{{ displayName(teacher) }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{{ teacher.email || '-' }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">
                <div style="display:grid;grid-template-columns:auto 1fr;column-gap:12px;align-items:center;width:100%;">
                  <label
                    style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;user-select:none;"
                    [style.opacity]="
                      roleUpdatingTeacherId === resolveTeacherId(teacher) ||
                      statusUpdatingTeacherId === resolveTeacherId(teacher)
                        ? '0.7'
                        : '1'
                    "
                  >
                    <input
                      type="checkbox"
                      [checked]="isAdminRole(teacher)"
                      (change)="toggleAdminRole(teacher)"
                      [disabled]="
                        !resolveTeacherId(teacher) ||
                        roleUpdatingTeacherId === resolveTeacherId(teacher) ||
                        statusUpdatingTeacherId === resolveTeacherId(teacher)
                      "
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
                  </label>

                  <div style="display:flex;justify-content:center;">
                    <button
                      type="button"
                      (click)="resetPassword(teacher)"
                      [disabled]="
                        !resolveTeacherId(teacher) ||
                        resettingTeacherId === resolveTeacherId(teacher) ||
                        roleUpdatingTeacherId === resolveTeacherId(teacher) ||
                        statusUpdatingTeacherId === resolveTeacherId(teacher)
                      "
                    >
                      {{
                        resettingTeacherId === resolveTeacherId(teacher)
                          ? '重置中...'
                          : '重置密码'
                      }}
                    </button>
                  </div>

                </div>
              </td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">
                <label
                  style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;user-select:none;"
                  [style.opacity]="
                    roleUpdatingTeacherId === resolveTeacherId(teacher) ||
                    statusUpdatingTeacherId === resolveTeacherId(teacher)
                      ? '0.7'
                      : '1'
                  "
                  title="启用"
                >
                  <input
                    type="checkbox"
                    [checked]="isActive(teacher)"
                    (change)="toggleArchiveStatus(teacher)"
                    [disabled]="
                      !resolveTeacherId(teacher) ||
                      roleUpdatingTeacherId === resolveTeacherId(teacher) ||
                      statusUpdatingTeacherId === resolveTeacherId(teacher)
                    "
                    style="display:none;"
                  />

                  <span
                    style="position:relative;width:44px;height:24px;border-radius:999px;transition:all 0.2s ease;display:inline-block;"
                    [style.background]="
                      statusUpdatingTeacherId === resolveTeacherId(teacher)
                        ? '#bdbdbd'
                        : isArchived(teacher)
                          ? '#c62828'
                          : '#19a34a'
                    "
                  >
                    <span
                      style="position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:all 0.2s ease;box-shadow:0 1px 3px rgba(0,0,0,0.25);"
                      [style.transform]="isActive(teacher) ? 'translateX(20px)' : 'translateX(0)'"
                    ></span>
                  </span>

                </label>
              </td>
            </tr>
            <tr *ngIf="!loadingList && visibleTeachers.length === 0">
              <td colspan="6" style="padding:14px;color:#666;text-align:center;">未找到教师账号。</td>
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
        <div style="font-weight:bold;">角色更新成功</div>
        <div style="margin-top:8px;"><b>教师：</b> {{ roleResult.username }}</div>
        <div style="margin-top:8px;"><b>新角色：</b> {{ roleResult.role === 'ADMIN' ? '管理员' : '教师' }}</div>
      </div>

      <div
        *ngIf="statusResult"
        style="margin-top:14px;padding:12px;border:1px solid #cfe8cf;background:#f3fff3;border-radius:8px;"
      >
        <div style="font-weight:bold;">账号状态更新成功</div>
        <div style="margin-top:8px;"><b>教师：</b> {{ statusResult.username }}</div>
        <div style="margin-top:8px;"><b>新状态：</b> {{ statusResult.status === 'ACTIVE' ? '启用' : '归档' }}</div>
      </div>

      <div
        *ngIf="resetResult"
        style="margin-top:14px;padding:12px;border:1px solid #cfe8cf;background:#f3fff3;border-radius:8px;"
      >
        <div style="font-weight:bold;">临时密码重置成功</div>
        <div style="margin-top:8px;"><b>教师：</b> {{ resetResult.username }}</div>
        <div style="margin-top:8px;">
          <b>临时密码（仅显示一次）：</b>
          <pre
            style="margin:8px 0 0;padding:10px;background:#fff;border:1px solid #ddd;border-radius:6px;font-size:16px;"
          >{{ resetResult.tempPassword }}</pre>
        </div>
        <div style="margin-top:8px;color:#666;">
          请通过安全方式发送给教师。首次登录将强制修改密码。
        </div>
      </div>
    </div>
  `,
})
export class TeacherManagementComponent implements OnInit {
  readonly limitOptions: number[] = [20, 50, 100];
  teachers: TeacherAccount[] = [];
  visibleTeachers: TeacherAccount[] = [];
  filteredCount = 0;
  loadingList = false;
  listError = '';
  listLimit = 20;
  roleFilter: 'ALL' | TeacherRole = 'ALL';
  showInactive = false;
  searchKeyword = '';

  resettingTeacherId: number | null = null;
  roleUpdatingTeacherId: number | null = null;
  roleTarget: TeacherRole | null = null;
  statusUpdatingTeacherId: number | null = null;
  statusTarget: TeacherAccountStatus | null = null;
  actionError = '';
  resetResult: PasswordResetResult | null = null;
  roleResult: RoleUpdateResult | null = null;
  statusResult: StatusUpdateResult | null = null;

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
          this.applyListView();
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.listError = this.extractErrorMessage(err) || '加载教师列表失败。';
          this.teachers = [];
          this.applyListView();
          this.cdr.detectChanges();
        },
      });
  }

  resetPassword(teacher: TeacherAccount): void {
    const teacherId = this.resolveTeacherId(teacher);
    if (!teacherId) {
      this.actionError = '缺少教师 ID，无法重置密码。';
      this.cdr.detectChanges();
      return;
    }

    this.actionError = '';
    this.resetResult = null;
    this.roleResult = null;
    this.statusResult = null;
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
            this.actionError = '重置成功，但响应中缺少临时密码。';
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
          this.actionError = this.extractErrorMessage(err) || '重置密码失败。';
          this.cdr.detectChanges();
        },
      });
  }

  setRole(teacher: TeacherAccount, targetRole: TeacherRole): void {
    const teacherId = this.resolveTeacherId(teacher);
    if (!teacherId) {
      this.actionError = '缺少教师 ID，无法更新角色。';
      this.cdr.detectChanges();
      return;
    }

    this.actionError = '';
    this.resetResult = null;
    this.roleResult = null;
    this.statusResult = null;
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
          this.applyListView();
          this.statusResult = null;
          this.roleResult = {
            teacherId,
            username: resp.username || teacher.username || `#${teacherId}`,
            role: resolvedRole,
          };
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.actionError = this.extractRoleUpdateErrorMessage(err) || '更新角色失败。';
          this.cdr.detectChanges();
        },
      });
  }

  toggleAdminRole(teacher: TeacherAccount): void {
    const targetRole: TeacherRole = this.isAdminRole(teacher) ? 'TEACHER' : 'ADMIN';
    this.setRole(teacher, targetRole);
  }

  toggleArchiveStatus(teacher: TeacherAccount): void {
    const targetStatus: TeacherAccountStatus = this.isArchived(teacher) ? 'ACTIVE' : 'ARCHIVED';
    this.setTeacherStatus(teacher, targetStatus);
  }

  setTeacherStatus(teacher: TeacherAccount, targetStatus: TeacherAccountStatus): void {
    const teacherId = this.resolveTeacherId(teacher);
    if (!teacherId) {
      this.actionError = '缺少教师 ID，无法更新账号状态。';
      this.cdr.detectChanges();
      return;
    }

    this.actionError = '';
    this.resetResult = null;
    this.roleResult = null;
    this.statusResult = null;
    this.statusUpdatingTeacherId = teacherId;
    this.statusTarget = targetStatus;
    this.cdr.detectChanges();

    this.teacherApi
      .updateTeacherStatus(teacherId, targetStatus)
      .pipe(
        finalize(() => {
          this.statusUpdatingTeacherId = null;
          this.statusTarget = null;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (resp: UpdateTeacherStatusResponse) => {
          const resolvedStatus = this.resolveStatus(resp) || targetStatus;
          this.assignStatus(teacher, resolvedStatus);
          this.applyListView();
          this.roleResult = null;
          this.statusResult = {
            teacherId,
            username: resp.username || teacher.username || `#${teacherId}`,
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
    this.roleFilter = 'ALL';
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
    const filtered = this.teachers.filter((teacher) => {
      if (this.roleFilter !== 'ALL') {
        if (this.normalizeRole(teacher.role) !== this.roleFilter) {
          return false;
        }
      }

      if (!this.showInactive && this.resolveStatus(teacher) !== 'ACTIVE') {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const searchFields = [
        String(this.resolveTeacherId(teacher) ?? ''),
        String(teacher.username || ''),
        this.displayName(teacher),
        String(teacher.email || ''),
      ];

      return searchFields.some((field) => field.toLowerCase().includes(keyword));
    });

    this.filteredCount = filtered.length;
    this.visibleTeachers = filtered.slice(0, this.listLimit);
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
      status: this.resolveStatus(teacher),
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

  isAdminRole(teacher: TeacherAccount): boolean {
    return this.normalizeRole(teacher.role) === 'ADMIN';
  }

  isArchived(teacher: TeacherAccount): boolean {
    return this.resolveStatus(teacher) === 'ARCHIVED';
  }

  isActive(teacher: TeacherAccount): boolean {
    return !this.isArchived(teacher);
  }

  private normalizeRole(role: unknown): TeacherRole | null {
    const normalized = String(role || '').toUpperCase();
    return normalized === 'ADMIN' || normalized === 'TEACHER' ? normalized : null;
  }

  private resolveStatus(value: unknown): TeacherAccountStatus {
    if (value && typeof value === 'object') {
      const obj = value as any;

      const statusText =
        String(obj.status || obj.accountStatus || obj.userStatus || '')
          .trim()
          .toUpperCase();
      if (statusText === 'ARCHIVED' || statusText === 'ACTIVE') {
        return statusText as TeacherAccountStatus;
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

  private assignStatus(teacher: TeacherAccount, status: TeacherAccountStatus): void {
    teacher['status'] = status;
    teacher['archived'] = status === 'ARCHIVED';
    teacher['isArchived'] = status === 'ARCHIVED';
    teacher['active'] = status === 'ACTIVE';
    teacher['enabled'] = status === 'ACTIVE';
    teacher['disabled'] = status === 'ARCHIVED';
  }

  private extractRoleUpdateErrorMessage(err: HttpErrorResponse): string {
    const status = err?.status;
    const code = this.extractErrorCode(err);

    if (status === 401) {
      return '未登录或登录已过期，请重新登录。';
    }

    if (status === 403 && code === 'MUST_CHANGE_PASSWORD_REQUIRED') {
      return '请先修改密码后再进行角色管理。';
    }

    if (status === 403) {
      return this.extractErrorMessage(err) || '无权限：需要管理员角色。';
    }

    if (status === 404 && code === 'NOT_FOUND') {
      return this.extractErrorMessage(err) || '未找到教师账号。';
    }

    if (status === 400 && code === 'BAD_REQUEST') {
      return this.extractErrorMessage(err) || '无效角色，必须为 ADMIN 或 TEACHER。';
    }

    return this.extractErrorMessage(err);
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
      return this.extractErrorMessage(err) || '无权限：需要管理员角色。';
    }

    if (status === 404 && code === 'NOT_FOUND') {
      return this.extractErrorMessage(err) || '未找到教师账号。';
    }

    if (status === 400 && code === 'BAD_REQUEST') {
      return this.extractErrorMessage(err) || '无效账号状态，必须为 ACTIVE 或 ARCHIVED。';
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
