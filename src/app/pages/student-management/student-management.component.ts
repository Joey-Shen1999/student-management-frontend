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
import {
  StudentProfilePayload,
  StudentProfileResponse,
  StudentProfileService,
} from '../../services/student-profile.service';

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

type StudentCountryFilter = 'ALL' | 'N/A' | string;

interface StudentListMetadata {
  email: string;
  phone: string;
  currentSchoolCountry: string;
}

const COUNTRY_FILTER_ALL_OPTION = '全部国家';
const COUNTRY_FILTER_NA_OPTION = 'N/A 尚未填写';
const COUNTRY_FILTER_PRIORITY_OPTIONS = ['Canada', '中国 / China (Mainland)', 'USA'] as const;
const COUNTRY_FILTER_FALLBACK_OPTIONS = [
  'United Kingdom',
  'Australia',
  'New Zealand',
  'Japan',
  'South Korea',
  'Singapore',
  'India',
  'France',
  'Germany',
  'Italy',
  'Spain',
  'Netherlands',
  'Switzerland',
  'Sweden',
  'Norway',
  'Denmark',
  'Finland',
  'Ireland',
  'Belgium',
  'Austria',
  'Portugal',
  'Mexico',
  'Brazil',
  'Argentina',
  'Chile',
  'South Africa',
  'Egypt',
  'Saudi Arabia',
  'United Arab Emirates',
] as const;

@Component({
  selector: 'app-student-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div style="max-width:980px;margin:40px auto;font-family:Arial">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <h2 style="margin:0;">学生账号管理</h2>
        <button type="button" routerLink="/teacher/dashboard" class="student-back-btn" style="margin-left:auto;">
          返回
        </button>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:14px 0 8px;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <button type="button" (click)="loadStudents()" [disabled]="loadingList">
            {{ loadingList ? '加载中...' : '刷新列表' }}
          </button>

          <button
            type="button"
            (click)="createInviteLink()"
            [disabled]="creatingInvite"
          >
            {{ creatingInvite ? '生成中...' : '生成学生邀请链接' }}
          </button>
        </div>

        <span style="color:#666;font-size:13px;">总数：{{ students.length }}</span>
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
            placeholder="按 ID、姓名、邮箱、电话搜索"
            [(ngModel)]="searchKeyword"
            (ngModelChange)="applyListView()"
            [disabled]="loadingList"
            style="min-width:260px;max-width:360px;flex:1 1 300px;padding:6px 8px;"
          />

          <label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#444;">
            国家
            <input
              [(ngModel)]="countryFilterInput"
              (ngModelChange)="onCountryFilterInputChange($event)"
              name="countryFilter"
              list="countryFilterOptions"
              placeholder="全部国家"
              [disabled]="loadingList"
              style="padding:4px 6px;min-width:180px;"
            />
            <datalist id="countryFilterOptions">
              <option *ngFor="let option of countryFilterOptions" [value]="option"></option>
            </datalist>
          </label>

          <button
            type="button"
            (click)="clearListControls()"
            [disabled]="loadingList || (listLimit === 20 && !showInactive && !searchKeyword.trim() && countryFilter === 'ALL')"
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

      <div
        *ngIf="resetResult"
        style="margin-top:14px;padding:12px;border:1px solid #cfe8cf;background:#f3fff3;border-radius:8px;"
      >
        <div style="font-weight:bold;">临时密码重置成功</div>
        <div style="margin-top:8px;"><b>登录用户名：</b> {{ resetResult.username }}</div>
        <div style="margin-top:8px;">
          <b>临时密码（仅显示一次）：</b>
          <pre
            style="margin:8px 0 0;padding:10px;background:#fff;border:1px solid #ddd;border-radius:6px;font-size:16px;"
          >{{ resetResult.tempPassword }}</pre>
        </div>
      </div>

      <div style="margin-top:12px;border:1px solid #e5e5e5;border-radius:10px;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead style="background:#f6f7fb;">
            <tr>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">姓名</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">邮箱</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">电话</th>
              <th style="text-align:center;padding:10px;border-bottom:1px solid #e5e5e5;white-space:nowrap;width:120px;">档案</th>
              <th style="text-align:center;padding:10px;border-bottom:1px solid #e5e5e5;white-space:nowrap;width:120px;">重置密码</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #e5e5e5;">归档</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let student of visibleStudents; trackBy: trackStudent">
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{{ displayName(student) }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{{ resolveStudentEmail(student) }}</td>
              <td style="padding:10px;border-bottom:1px solid #f0f0f0;">{{ resolveStudentPhone(student) }}</td>
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
              <td colspan="6" style="padding:14px;color:#666;text-align:center;">未找到学生账号。</td>
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

    </div>
  `,
  styles: [
    `
      .student-back-btn {
        border: 1px solid #c8d2e0;
        border-radius: 999px;
        background: #ffffff;
        color: #1f2f47;
        padding: 8px 14px;
        font-size: 13px;
        font-weight: 600;
        line-height: 1;
        cursor: pointer;
        box-shadow: 0 8px 18px rgba(21, 40, 68, 0.12);
        transition:
          border-color 0.15s ease,
          box-shadow 0.15s ease,
          transform 0.15s ease;
      }

      .student-back-btn:hover {
        border-color: #9db2d0;
        box-shadow: 0 10px 22px rgba(21, 40, 68, 0.16);
        transform: translateY(-1px);
      }

      .student-back-btn:focus-visible {
        outline: 2px solid #8aa8d3;
        outline-offset: 2px;
      }
    `,
  ],
})
export class StudentManagementComponent implements OnInit {
  readonly limitOptions: number[] = [20, 50, 100];
  readonly countryFilterOptions: string[] = this.buildCountryFilterOptions();
  students: StudentAccount[] = [];
  visibleStudents: StudentAccount[] = [];
  filteredCount = 0;
  loadingList = false;
  listError = '';
  listLimit = 20;
  showInactive = false;
  searchKeyword = '';
  countryFilterInput = COUNTRY_FILTER_ALL_OPTION;
  countryFilter: StudentCountryFilter = 'ALL';
  creatingInvite = false;
  inviteError = '';
  inviteLink = '';
  inviteExpiresAt = '';
  inviteCopied = false;

  resettingStudentId: number | null = null;
  statusUpdatingStudentId: number | null = null;
  statusTarget: StudentAccountStatus | null = null;
  actionError = '';
  resetResult: PasswordResetResult | null = null;
  statusResult: StatusUpdateResult | null = null;
  private readonly studentContactCache = new Map<number, StudentListMetadata>();
  private readonly studentContactLoadInFlight = new Set<number>();

  constructor(
    private studentApi: StudentManagementService,
    private studentProfileApi: StudentProfileService,
    private inviteApi: StudentInviteService,
    private cdr: ChangeDetectorRef = { detectChanges: () => {} } as ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadStudents();
  }

  trackStudent = (_index: number, student: StudentAccount): string | number => {
    return this.resolveStudentId(student) ?? student.username;
  };

  displayName(student: StudentAccount): string {
    const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim();
    if (fullName) return fullName;

    if (student.displayName?.trim()) return student.displayName.trim();

    return '-';
  }

  resolveStudentId(student: StudentAccount): number | null {
    const id = student.studentId ?? student.id ?? student.userId;
    return typeof id === 'number' && Number.isFinite(id) && id > 0 ? id : null;
  }

  resolveStudentEmail(student: StudentAccount): string {
    return this.resolveStudentEmailValue(student) || '-';
  }

  resolveStudentPhone(student: StudentAccount): string {
    return this.resolveStudentPhoneValue(student) || '-';
  }

  onCountryFilterInputChange(value: string): void {
    const input = String(value ?? '').trim();
    this.countryFilterInput = input || COUNTRY_FILTER_ALL_OPTION;
    this.countryFilter = this.resolveCountryFilterSelection(this.countryFilterInput);
    this.applyListView();
  }

  private resolveCurrentSchoolCountryForFilter(student: StudentAccount): StudentCountryFilter {
    const normalized = this.normalizeCountryFilterValue(this.resolveCurrentSchoolCountryValue(student));
    return normalized || 'N/A';
  }

  private resolveCurrentSchoolCountryValue(student: StudentAccount): string {
    const profile = student?.['profile'] as Record<string, unknown> | undefined;
    const profileNode =
      profile && typeof profile === 'object' ? profile : ({} as Record<string, unknown>);

    const schoolRows =
      (Array.isArray(student?.['schools']) ? student['schools'] : null) ||
      (Array.isArray(student?.['schoolRecords']) ? student['schoolRecords'] : null) ||
      (Array.isArray(student?.['highSchools']) ? student['highSchools'] : null) ||
      (Array.isArray(profileNode['schools']) ? profileNode['schools'] : null) ||
      (Array.isArray(profileNode['schoolRecords']) ? profileNode['schoolRecords'] : null) ||
      (Array.isArray(profileNode['highSchools']) ? profileNode['highSchools'] : null) ||
      [];

    const currentSchoolCandidate =
      schoolRows.find((value) => {
        if (!value || typeof value !== 'object') return false;
        const schoolType = String((value as Record<string, unknown>)['schoolType'] || '')
          .trim()
          .toUpperCase();
        return schoolType === 'MAIN';
      }) || schoolRows[0];
    const currentSchool =
      currentSchoolCandidate && typeof currentSchoolCandidate === 'object'
        ? (currentSchoolCandidate as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const schoolAddress =
      currentSchool['address'] && typeof currentSchool['address'] === 'object'
        ? (currentSchool['address'] as Record<string, unknown>)
        : ({} as Record<string, unknown>);

    return this.pickFirstText([
      student?.['currentSchoolCountry'],
      student?.['schoolCountry'],
      student?.['country'],
      profileNode['currentSchoolCountry'],
      profileNode['schoolCountry'],
      currentSchool['country'],
      schoolAddress['country'],
    ]);
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
          this.hydrateStudentMetadata(this.students);
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

    this.creatingInvite = true;
    this.inviteError = '';
    this.inviteLink = '';
    this.inviteExpiresAt = '';
    this.inviteCopied = false;
    this.cdr.detectChanges();

    this.inviteApi
      .createInvite()
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
    this.countryFilterInput = COUNTRY_FILTER_ALL_OPTION;
    this.countryFilter = 'ALL';
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

      if (this.countryFilter !== 'ALL') {
        const studentCountry = this.resolveCurrentSchoolCountryForFilter(student);
        if (this.countryFilter === 'N/A') {
          return studentCountry === 'N/A';
        }
        if (this.countryFilter === 'Canada') {
          return studentCountry === 'Canada' || studentCountry === 'N/A';
        }
        return studentCountry === this.countryFilter;
      }

      if (!keyword) {
        return true;
      }

      const searchFields = [
        String(this.resolveStudentId(student) ?? ''),
        this.displayName(student),
        this.resolveStudentEmailValue(student),
        this.resolveStudentPhoneValue(student),
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

    return list.map((student) => {
      const email = this.resolveStudentEmailValue(student);
      const phone = this.resolveStudentPhoneValue(student);
      const currentSchoolCountry = this.resolveCurrentSchoolCountryValue(student);

      return {
        ...student,
        email: email || undefined,
        phone: phone || undefined,
        currentSchoolCountry: currentSchoolCountry || undefined,
        status: this.resolveStatus(student),
      };
    });
  }

  private hydrateStudentMetadata(students: StudentAccount[]): void {
    for (const student of students) {
      const studentId = this.resolveStudentId(student);
      if (!studentId) {
        continue;
      }

      const cached = this.studentContactCache.get(studentId);
      if (cached) {
        this.applyStudentMetadata(student, cached);
      }

      const email = this.resolveStudentEmailValue(student);
      const phone = this.resolveStudentPhoneValue(student);
      const currentSchoolCountry = this.resolveCurrentSchoolCountryValue(student);
      if (email && phone && currentSchoolCountry) {
        this.studentContactCache.set(studentId, { email, phone, currentSchoolCountry });
        continue;
      }

      if (this.studentContactLoadInFlight.has(studentId)) {
        continue;
      }

      this.studentContactLoadInFlight.add(studentId);
      this.studentProfileApi
        .getStudentProfileForTeacher(studentId)
        .pipe(
          finalize(() => {
            this.studentContactLoadInFlight.delete(studentId);
          })
        )
        .subscribe({
          next: (payload) => {
            const metadata = this.extractStudentMetadataFromProfile(payload);
            if (!metadata.email && !metadata.phone && !metadata.currentSchoolCountry) {
              return;
            }

            this.studentContactCache.set(studentId, metadata);
            this.applyStudentMetadata(student, metadata);
            this.applyListView();
            this.cdr.detectChanges();
          },
          error: () => {},
        });
    }
  }

  private extractStudentMetadataFromProfile(
    payload: StudentProfilePayload | StudentProfileResponse | null | undefined
  ): StudentListMetadata {
    const root =
      payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const profileNode =
      root['profile'] && typeof root['profile'] === 'object'
        ? (root['profile'] as Record<string, unknown>)
        : root;
    const schoolRows =
      (Array.isArray(profileNode['schools']) ? profileNode['schools'] : null) ||
      (Array.isArray(profileNode['schoolRecords']) ? profileNode['schoolRecords'] : null) ||
      (Array.isArray(profileNode['highSchools']) ? profileNode['highSchools'] : null) ||
      (Array.isArray(root['schools']) ? root['schools'] : null) ||
      (Array.isArray(root['schoolRecords']) ? root['schoolRecords'] : null) ||
      (Array.isArray(root['highSchools']) ? root['highSchools'] : null) ||
      [];
    const currentSchoolCandidate =
      schoolRows.find((value) => {
        if (!value || typeof value !== 'object') return false;
        const schoolType = String((value as Record<string, unknown>)['schoolType'] || '')
          .trim()
          .toUpperCase();
        return schoolType === 'MAIN';
      }) || schoolRows[0];
    const currentSchool =
      currentSchoolCandidate && typeof currentSchoolCandidate === 'object'
        ? (currentSchoolCandidate as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const schoolAddress =
      currentSchool['address'] && typeof currentSchool['address'] === 'object'
        ? (currentSchool['address'] as Record<string, unknown>)
        : ({} as Record<string, unknown>);

    return {
      email: this.pickFirstText([
        profileNode['email'],
        profileNode['emailAddress'],
        root['email'],
        root['emailAddress'],
        root['contactEmail'],
      ]),
      phone: this.pickFirstText([
        profileNode['phone'],
        profileNode['phoneNumber'],
        root['phone'],
        root['phoneNumber'],
        root['mobile'],
        root['mobilePhone'],
        root['telephone'],
        root['tel'],
        root['contactPhone'],
      ]),
      currentSchoolCountry: this.pickFirstText([
        profileNode['currentSchoolCountry'],
        profileNode['schoolCountry'],
        root['currentSchoolCountry'],
        root['schoolCountry'],
        currentSchool['country'],
        schoolAddress['country'],
      ]),
    };
  }

  private applyStudentMetadata(
    student: StudentAccount,
    metadata: StudentListMetadata
  ): void {
    if (!this.resolveStudentEmailValue(student) && metadata.email) {
      student.email = metadata.email;
    }
    if (!this.resolveStudentPhoneValue(student) && metadata.phone) {
      student.phone = metadata.phone;
    }
    if (!this.resolveCurrentSchoolCountryValue(student) && metadata.currentSchoolCountry) {
      student['currentSchoolCountry'] = metadata.currentSchoolCountry;
    }
  }

  private resolveStudentEmailValue(student: StudentAccount): string {
    const profile = student?.['profile'] as Record<string, unknown> | undefined;
    const contact = student?.['contact'] as Record<string, unknown> | undefined;

    return this.pickFirstText([
      student?.email,
      student?.['emailAddress'],
      student?.['contactEmail'],
      student?.['mail'],
      profile?.['email'],
      profile?.['emailAddress'],
      contact?.['email'],
    ]);
  }

  private resolveStudentPhoneValue(student: StudentAccount): string {
    const profile = student?.['profile'] as Record<string, unknown> | undefined;
    const contact = student?.['contact'] as Record<string, unknown> | undefined;

    return this.pickFirstText([
      student?.phone,
      student?.['phoneNumber'],
      student?.['mobile'],
      student?.['mobilePhone'],
      student?.['telephone'],
      student?.['tel'],
      student?.['contactPhone'],
      profile?.['phone'],
      profile?.['phoneNumber'],
      contact?.['phone'],
    ]);
  }

  private pickFirstText(candidates: unknown[]): string {
    for (const candidate of candidates) {
      const value = String(candidate ?? '').trim();
      if (value) {
        return value;
      }
    }

    return '';
  }

  private resolveCountryFilterSelection(value: unknown): StudentCountryFilter {
    const normalized = this.normalizeCountryFilterValue(value);
    return normalized || 'ALL';
  }

  private normalizeCountryFilterValue(value: unknown): StudentCountryFilter | '' {
    const rawText = String(value ?? '').trim();
    const normalizedKey = this.normalizeCountryKey(rawText);
    if (!normalizedKey) {
      return '';
    }

    if (
      normalizedKey === 'all' ||
      normalizedKey === 'all countries' ||
      normalizedKey === 'all country' ||
      normalizedKey === '全部' ||
      normalizedKey === '全部国家'
    ) {
      return 'ALL';
    }

    if (
      normalizedKey === 'n a' ||
      normalizedKey === 'na' ||
      normalizedKey === 'not available' ||
      normalizedKey === '尚未填写' ||
      normalizedKey === '未填写' ||
      normalizedKey === 'n a 尚未填写'
    ) {
      return 'N/A';
    }

    if (normalizedKey === 'ca' || normalizedKey === 'canada' || normalizedKey === '加拿大') {
      return 'Canada';
    }

    if (
      normalizedKey === 'cn' ||
      normalizedKey === 'china' ||
      normalizedKey === '中国' ||
      normalizedKey === 'pr china' ||
      normalizedKey === 'peoples republic of china' ||
      normalizedKey === 'china mainland' ||
      normalizedKey === '中国 china mainland'
    ) {
      return 'China (Mainland)';
    }

    if (
      normalizedKey === 'us' ||
      normalizedKey === 'usa' ||
      normalizedKey === 'u s' ||
      normalizedKey === 'u s a' ||
      normalizedKey === 'america' ||
      normalizedKey === '美国' ||
      normalizedKey === 'united states' ||
      normalizedKey === 'united states of america' ||
      normalizedKey === 'usa united states'
    ) {
      return 'USA';
    }

    const matched = this.countryFilterOptions.find(
      (option) => this.normalizeCountryKey(option) === normalizedKey
    );
    return matched || rawText;
  }

  private normalizeCountryKey(value: unknown): string {
    return String(value ?? '')
      .toLowerCase()
      .replace(/[.]/g, '')
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
      .trim();
  }

  private buildCountryFilterOptions(): string[] {
    const options: string[] = [];
    const seen = new Set<string>();
    const append = (value: unknown): void => {
      const text = String(value ?? '').trim();
      if (!text) return;
      const key = text.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      options.push(text);
    };

    COUNTRY_FILTER_PRIORITY_OPTIONS.forEach(append);
    append(COUNTRY_FILTER_NA_OPTION);
    this.buildRegionCountryFilterOptions().forEach(append);
    COUNTRY_FILTER_FALLBACK_OPTIONS.forEach(append);
    append(COUNTRY_FILTER_ALL_OPTION);

    return options;
  }

  private buildRegionCountryFilterOptions(): string[] {
    try {
      if (typeof Intl === 'undefined' || typeof Intl.DisplayNames !== 'function') {
        return [];
      }

      const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
      const options: string[] = [];
      for (let first = 65; first <= 90; first += 1) {
        for (let second = 65; second <= 90; second += 1) {
          const code = `${String.fromCharCode(first)}${String.fromCharCode(second)}`;
          const name = displayNames.of(code);
          if (!name || name === code) continue;
          options.push(String(name));
        }
      }
      return options;
    } catch {
      return [];
    }
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
