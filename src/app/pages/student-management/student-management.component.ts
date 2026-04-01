import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
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
  EDUCATION_BOARD_LIBRARY_OPTIONS,
  StudentProfilePayload,
  StudentProfileResponse,
  StudentProfileService,
} from '../../services/student-profile.service';
import { AuthService } from '../../services/auth.service';
import { IeltsTrackingService } from '../../services/ielts-tracking.service';
import { TeacherPreferenceService } from '../../services/teacher-preference.service';
import { IeltsTrackingStatus } from '../../features/ielts/ielts-types';
import {
  CITY_FILTER_OPTIONS_BY_COUNTRY,
  COUNTRY_FILTER_ALL_OPTION,
  COUNTRY_FILTER_FALLBACK_OPTIONS,
  COUNTRY_FILTER_NA_OPTION,
  COUNTRY_FILTER_PRIORITY_OPTIONS,
  PROVINCE_FILTER_COUNTRIES,
  PROVINCE_FILTER_OPTIONS_BY_COUNTRY,
  type ProvinceFilterCountry,
} from '../../shared/student-location/student-location-options';
import {
  buildDefaultVisibleColumnKeys as buildVisibleColumnDefaults,
  normalizeVisibleColumnKeys as normalizeVisibleKeys,
} from '../../shared/student-columns/student-column-visibility.util';

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

type StudentListColumnKey =
  | 'name'
  | 'email'
  | 'phone'
  | 'graduation'
  | 'schoolName'
  | 'canadaIdentity'
  | 'gender'
  | 'nationality'
  | 'firstLanguage'
  | 'schoolBoard'
  | 'country'
  | 'province'
  | 'city'
  | 'teacherNote'
  | 'profile'
  | 'ielts'
  | 'resetPassword'
  | 'archive';

type StudentIeltsStatusKey = IeltsTrackingStatus | 'NO_IELTS_REQUIRED' | 'LOADING' | 'UNAVAILABLE';

interface StudentListColumnConfig {
  key: StudentListColumnKey;
  label: string;
  defaultVisible: boolean;
  hideable: boolean;
  backendDependent: boolean;
  headerStyle: string;
  cellStyle: string;
}

type StudentCountryFilter = 'ALL' | 'N/A' | string;
type StudentProvinceFilter = string;
type StudentManagementPageContext = 'students' | 'ielts';

interface StudentListMetadata {
  email: string;
  phone: string;
  schoolName: string;
  canadaIdentity: string;
  gender: string;
  nationality: string;
  firstLanguage: string;
  currentSchoolCountry: string;
  currentSchoolProvince: string;
  currentSchoolCity: string;
  currentSchoolBoard: string;
  currentSchoolExpectedGraduation: string;
}

interface StudentSchoolContext {
  profileNode: Record<string, unknown>;
  currentSchool: Record<string, unknown>;
  schoolNode: Record<string, unknown>;
  schoolAddress: Record<string, unknown>;
  schoolNodeAddress: Record<string, unknown>;
}

const STUDENT_LIST_COLUMN_PREFERENCE_STORAGE_KEY_PREFIX =
  'student-management.student-list.visible-columns';
const STUDENT_LIST_COLUMN_PREFERENCE_PAGE_KEY_BY_CONTEXT: Record<
  StudentManagementPageContext,
  string
> = {
  students: 'student-management.list-columns',
  ielts: 'ielts-tracking.list-columns',
};

const IELTS_TRACKING_DEFAULT_COLUMN_KEYS: readonly StudentListColumnKey[] = [
  'name',
  'graduation',
  'schoolName',
  'canadaIdentity',
  'teacherNote',
  'ielts',
  'resetPassword',
];

const STUDENT_LIST_COLUMN_PREFERENCE_VERSION = 'v2';
const STUDENT_LIST_COLUMN_VISIBILITY_OVERRIDE_STORAGE_KEY_PREFIX =
  'student-management.student-list.column-override';

const STUDENT_LIST_COLUMNS: readonly StudentListColumnConfig[] = [
  {
    key: 'name',
    label: '姓名',
    defaultVisible: true,
    hideable: false,
    backendDependent: false,
    headerStyle: 'text-align:left;padding:6px 8px;border-bottom:1px solid #e5e5e5;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;',
  },
  {
    key: 'email',
    label: '邮箱',
    defaultVisible: true,
    hideable: true,
    backendDependent: false,
    headerStyle: 'text-align:left;padding:6px 8px;border-bottom:1px solid #e5e5e5;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;',
  },
  {
    key: 'phone',
    label: '电话',
    defaultVisible: true,
    hideable: true,
    backendDependent: false,
    headerStyle: 'text-align:left;padding:6px 8px;border-bottom:1px solid #e5e5e5;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;',
  },
  {
    key: 'graduation',
    label: '毕业时间',
    defaultVisible: true,
    hideable: true,
    backendDependent: false,
    headerStyle:
      'text-align:left;padding:6px 8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;',
  },
  {
    key: 'schoolName',
    label: '学校名',
    defaultVisible: false,
    hideable: true,
    backendDependent: true,
    headerStyle:
      'text-align:left;padding:6px 8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;',
  },
  {
    key: 'canadaIdentity',
    label: '在加拿大的身份',
    defaultVisible: false,
    hideable: true,
    backendDependent: true,
    headerStyle:
      'text-align:left;padding:6px 8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;',
  },
  {
    key: 'gender',
    label: '性别',
    defaultVisible: false,
    hideable: true,
    backendDependent: true,
    headerStyle:
      'text-align:left;padding:6px 8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;',
  },
  {
    key: 'nationality',
    label: '国籍',
    defaultVisible: false,
    hideable: true,
    backendDependent: true,
    headerStyle:
      'text-align:left;padding:6px 8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;',
  },
  {
    key: 'firstLanguage',
    label: '第一语言',
    defaultVisible: false,
    hideable: true,
    backendDependent: true,
    headerStyle:
      'text-align:left;padding:6px 8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;',
  },
  {
    key: 'schoolBoard',
    label: '所属教育局（在读学校）',
    defaultVisible: false,
    hideable: true,
    backendDependent: false,
    headerStyle: 'text-align:left;padding:6px 8px;border-bottom:1px solid #e5e5e5;min-width:160px;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;',
  },
  {
    key: 'country',
    label: '国家',
    defaultVisible: false,
    hideable: true,
    backendDependent: false,
    headerStyle:
      'text-align:left;padding:6px 8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;',
  },
  {
    key: 'province',
    label: '省份',
    defaultVisible: false,
    hideable: true,
    backendDependent: false,
    headerStyle:
      'text-align:left;padding:6px 8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;',
  },
  {
    key: 'city',
    label: '城市（在读学校）',
    defaultVisible: false,
    hideable: true,
    backendDependent: false,
    headerStyle:
      'text-align:left;padding:6px 8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;',
  },
  {
    key: 'teacherNote',
    label: '教师备注（学生不可见）',
    defaultVisible: true,
    hideable: true,
    backendDependent: true,
    headerStyle: 'text-align:left;padding:6px 8px;border-bottom:1px solid #e5e5e5;min-width:220px;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;vertical-align:top;',
  },
  {
    key: 'profile',
    label: '档案',
    defaultVisible: true,
    hideable: true,
    backendDependent: false,
    headerStyle:
      'text-align:center;padding:6px 8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;width:120px;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:center;vertical-align:middle;',
  },
  {
    key: 'ielts',
    label: 'IELTS',
    defaultVisible: false,
    hideable: true,
    backendDependent: true,
    headerStyle:
      'text-align:center;padding:6px 8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;width:180px;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:center;vertical-align:middle;',
  },
  {
    key: 'resetPassword',
    label: '重置密码',
    defaultVisible: true,
    hideable: true,
    backendDependent: false,
    headerStyle:
      'text-align:center;padding:6px 8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;width:120px;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:center;vertical-align:middle;',
  },
  {
    key: 'archive',
    label: '归档',
    defaultVisible: true,
    hideable: true,
    backendDependent: false,
    headerStyle: 'text-align:left;padding:6px 8px;border-bottom:1px solid #e5e5e5;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;',
  },
];

const PROVINCE_FILTER_ALIASES_BY_COUNTRY: Partial<
  Record<ProvinceFilterCountry, Record<string, string>>
> = {
  Canada: {
    ontario: 'Ontario',
    on: 'Ontario',
    安省: 'Ontario',
    bc: 'British Columbia',
    'b c': 'British Columbia',
    'british columbia': 'British Columbia',
    卑诗省: 'British Columbia',
    ab: 'Alberta',
    'a b': 'Alberta',
    alberta: 'Alberta',
    阿省: 'Alberta',
    quebec: 'Quebec',
    qc: 'Quebec',
    'q c': 'Quebec',
    魁省: 'Quebec',
  },
};

@Component({
  selector: 'app-student-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div style="max-width:1320px;margin:56px auto 40px;font-family:Arial">
      <div class="student-page-header" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <h2 style="margin:0;">{{ pageTitle }}</h2>
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
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
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
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;width:100%;">
          <button
            type="button"
            (click)="toggleFilterPanel()"
            [disabled]="loadingList"
            [attr.aria-expanded]="isFilterPanelExpanded"
            style="min-width:108px;"
          >
            {{ isFilterPanelExpanded ? '收起筛选' : '展开筛选' }}
          </button>
        </div>

        <div
          *ngIf="isFilterPanelExpanded"
          style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;width:100%;"
        >
          <button type="button" (click)="toggleInactiveVisibility()" [disabled]="loadingList">
            {{ showInactive ? '隐藏已归档' : '显示已归档' }}
          </button>

          <input
            type="search"
            placeholder="按 ID、姓名、邮箱、电话、毕业季搜索"
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
              placeholder="All"
              [disabled]="loadingList"
              style="padding:4px 6px;min-width:180px;"
            />
            <datalist id="countryFilterOptions">
              <option *ngFor="let option of countryFilterOptions" [value]="option"></option>
            </datalist>
          </label>

          <label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#444;">
            省份
            <input
              [(ngModel)]="provinceFilterInput"
              (ngModelChange)="onProvinceFilterInputChange($event)"
              name="provinceFilter"
              list="provinceFilterOptions"
              placeholder="All"
              [disabled]="loadingList"
              style="padding:4px 6px;min-width:180px;"
            />
            <datalist id="provinceFilterOptions">
              <option *ngFor="let option of provinceFilterOptions" [value]="option"></option>
            </datalist>
          </label>

          <label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#444;">
            城市
            <input
              [(ngModel)]="cityFilterInput"
              (ngModelChange)="onCityFilterInputChange($event)"
              name="cityFilter"
              list="cityFilterOptions"
              placeholder="All"
              [disabled]="loadingList"
              style="padding:4px 6px;min-width:180px;"
            />
            <datalist id="cityFilterOptions">
              <option *ngFor="let option of cityFilterOptions" [value]="option"></option>
            </datalist>
          </label>

          <label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#444;">
            &#25152;&#23646;&#25945;&#32946;&#23616;
            <input
              [(ngModel)]="schoolBoardFilterInput"
              (ngModelChange)="onSchoolBoardFilterInputChange($event)"
              name="schoolBoardFilter"
              list="schoolBoardFilterOptions"
              placeholder="All"
              [disabled]="loadingList"
              style="padding:4px 6px;min-width:200px;"
            />
            <datalist id="schoolBoardFilterOptions">
              <option *ngFor="let option of schoolBoardFilterOptions" [value]="option"></option>
            </datalist>
          </label>

          <label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#444;">
            毕业季
            <input
              [(ngModel)]="graduationSeasonFilterInput"
              (ngModelChange)="onGraduationSeasonFilterInputChange($event)"
              name="graduationSeasonFilter"
              list="graduationSeasonFilterOptions"
              placeholder="All"
              [disabled]="loadingList"
              style="padding:4px 6px;min-width:170px;"
            />
            <datalist id="graduationSeasonFilterOptions">
              <option *ngFor="let option of graduationSeasonFilterOptions" [value]="option"></option>
            </datalist>
          </label>

          <button
            type="button"
            (click)="clearListControls()"
            [disabled]="loadingList || isListControlsAtDefault()"
          >
            清空
          </button>
        </div>

        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end;margin-left:auto;">
          <span style="color:#666;font-size:13px;white-space:nowrap;">
            显示：{{ visibleStudents.length }} / 筛选后：{{ filteredCount }}
          </span>

          <button
            type="button"
            (click)="toggleColumnPanel()"
            [disabled]="loadingList"
            [attr.aria-expanded]="isColumnPanelExpanded"
          >
            {{ isColumnPanelExpanded ? '收起字段' : '字段显示' }}
          </button>

          <button
            type="button"
            (click)="resetVisibleColumns()"
            [disabled]="loadingList || isColumnSelectionAtDefault()"
          >
            恢复默认字段
          </button>

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
        <div
          *ngIf="isColumnPanelExpanded"
          style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;width:100%;padding-top:4px;border-top:1px dashed #d9dfea;"
        >
          <label
            *ngFor="let column of columnToggleOptions; trackBy: trackColumn"
            style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#3d4b61;padding:2px 8px;border:1px solid #dbe4f2;border-radius:999px;background:#fff;"
            [title]="column.backendDependent ? '可能依赖详情接口数据' : ''"
          >
            <input
              type="checkbox"
              [checked]="isColumnVisible(column.key)"
              (change)="onColumnVisibilityChange(column.key, $event)"
              [disabled]="loadingList || !column.hideable"
            />
            <span>{{ column.label }}</span>
            <small *ngIf="!column.hideable" style="color:#7f8a9e;">必选</small>
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
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead style="background:#f6f7fb;">
            <tr *ngIf="visibleColumns.length > 0">
              <th
                *ngFor="let column of visibleColumns; trackBy: trackColumn"
                [attr.style]="column.headerStyle"
              >
                {{ column.label }}
              </th>
            </tr>
            <tr *ngIf="false">
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #e5e5e5;">姓名</th>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #e5e5e5;">邮箱</th>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #e5e5e5;">电话</th>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;">毕业时间</th>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #e5e5e5;min-width:220px;">教师备注（学生不可见）</th>
              <th style="text-align:center;padding:6px 8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;width:120px;">档案</th>
              <th style="text-align:center;padding:6px 8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;width:120px;">重置密码</th>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #e5e5e5;">归档</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let student of visibleStudents; trackBy: trackStudent">
              <td
                *ngFor="let column of visibleColumns; trackBy: trackColumn"
                [attr.style]="column.cellStyle"
              >
                <ng-container [ngSwitch]="column.key">
                  <ng-container *ngSwitchCase="'teacherNote'">
                    <textarea
                      class="teacher-note-inline-textarea"
                      [ngModel]="resolveTeacherNoteCellValue(student)"
                      (focus)="prepareTeacherNoteCell(student)"
                      (ngModelChange)="onTeacherNoteCellChange(student, $event)"
                      (blur)="onTeacherNoteCellBlur(student)"
                      rows="1"
                      [disabled]="!resolveStudentId(student) || (isTeacherNoteRowSelected(student) && (teacherNoteLoading || teacherNoteSaving))"
                      placeholder="输入教师内部备注"
                    ></textarea>
                  </ng-container>

                  <ng-container *ngSwitchCase="'profile'">
                    <button
                      type="button"
                      [routerLink]="profileRoute(student)"
                      style="min-width:86px;white-space:nowrap;"
                      [disabled]="!resolveStudentId(student)"
                    >
                      编辑档案
                    </button>
                  </ng-container>

                  <ng-container *ngSwitchCase="'ielts'">
                    <button
                      type="button"
                      [routerLink]="ieltsRoute(student)"
                      style="min-width:150px;white-space:nowrap;padding:6px 10px;border-radius:999px;border:1px solid;font-weight:600;"
                      [style.background]="resolveIeltsStatusBackground(student)"
                      [style.color]="resolveIeltsStatusTextColor(student)"
                      [style.borderColor]="resolveIeltsStatusTextColor(student)"
                      [disabled]="!resolveStudentId(student)"
                    >
                      {{ resolveIeltsStatusLabel(student) }}
                    </button>
                  </ng-container>

                  <ng-container *ngSwitchCase="'resetPassword'">
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
                  </ng-container>

                  <ng-container *ngSwitchCase="'archive'">
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
                  </ng-container>

                  <ng-container *ngSwitchDefault>
                    {{ resolveStudentColumnValue(student, column.key) }}
                  </ng-container>
                </ng-container>
              </td>
            </tr>
            <tr *ngFor="let student of visibleStudents | slice:0:0; trackBy: trackStudent">
              <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">{{ displayName(student) }}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">{{ resolveStudentEmail(student) }}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">{{ resolveStudentPhone(student) }}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">{{ resolveStudentGraduation(student) }}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;vertical-align:top;">
                <textarea
                  class="teacher-note-inline-textarea"
                  [ngModel]="resolveTeacherNoteCellValue(student)"
                  (focus)="prepareTeacherNoteCell(student)"
                  (ngModelChange)="onTeacherNoteCellChange(student, $event)"
                  (blur)="onTeacherNoteCellBlur(student)"
                  rows="1"
                  [disabled]="!resolveStudentId(student) || (isTeacherNoteRowSelected(student) && (teacherNoteLoading || teacherNoteSaving))"
                  placeholder="输入教师内部备注"
                ></textarea>
              </td>
              <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:center;vertical-align:middle;">
                <button
                  type="button"
                  [routerLink]="profileRoute(student)"
                  style="min-width:86px;white-space:nowrap;"
                  [disabled]="!resolveStudentId(student)"
                >
                  编辑档案
                </button>
              </td>
              <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:center;vertical-align:middle;">
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
              <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">
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
              <td [attr.colspan]="visibleColumns.length || 1" style="padding:14px;color:#666;text-align:center;">
                未找到学生账号。
              </td>
            </tr>
            <tr *ngIf="false && !loadingList && visibleStudents.length === 0">
              <td colspan="8" style="padding:14px;color:#666;text-align:center;">未找到学生账号。</td>
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
      .teacher-note-inline-textarea {
        width: 100%;
        min-height: 24px;
        max-height: 56px;
        overflow-y: auto;
        resize: vertical;
        border: 1px solid #c8d2e0;
        border-radius: 8px;
        padding: 2px 4px;
        font-size: 13px;
        line-height: 1.2;
        box-sizing: border-box;
      }

      .student-page-header {
        padding-right: 128px;
      }

      .student-back-btn {
        border: 1px solid #c8d2e0;
        border-radius: 999px;
        background: #ffffff;
        color: #1f2f47;
        padding: 11px 20px;
        font-size: 14px;
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

      @media (max-width: 960px) {
        .student-page-header {
          padding-right: 0;
        }
      }

    `,
  ],
})
export class StudentManagementComponent implements OnInit {
  readonly limitOptions: number[] = [20, 50, 100];
  readonly countryFilterOptions: string[] = this.buildCountryFilterOptions();
  readonly schoolBoardFilterBaseOptions: string[] = this.buildSchoolBoardFilterBaseOptions();
  readonly studentListColumns: readonly StudentListColumnConfig[] = STUDENT_LIST_COLUMNS;
  students: StudentAccount[] = [];
  visibleStudents: StudentAccount[] = [];
  visibleColumnKeys = new Set<StudentListColumnKey>(
    this.studentListColumns
      .filter((column) => column.defaultVisible || !column.hideable)
      .map((column) => column.key)
  );
  filteredCount = 0;
  loadingList = false;
  listError = '';
  listLimit = 20;
  isFilterPanelExpanded = false;
  isColumnPanelExpanded = false;
  showInactive = false;
  searchKeyword = '';
  countryFilterInput = '';
  countryFilter: StudentCountryFilter = 'ALL';
  provinceFilterInput = '';
  provinceFilter: StudentProvinceFilter = '';
  cityFilterInput = '';
  cityFilter: string = '';
  schoolBoardFilterInput = '';
  schoolBoardFilter: string = '';
  graduationSeasonFilterInput = '';
  graduationSeasonFilter: string = '';
  creatingInvite = false;
  inviteError = '';
  inviteLink = '';
  inviteExpiresAt = '';
  inviteCopied = false;
  selectedNoteStudentId: number | null = null;
  selectedNoteStudentName = '';
  teacherNoteDraft = '';
  teacherNoteLoading = false;
  teacherNoteSaving = false;
  teacherNoteError = '';
  teacherNoteSuccess = '';

  resettingStudentId: number | null = null;
  statusUpdatingStudentId: number | null = null;
  statusTarget: StudentAccountStatus | null = null;
  actionError = '';
  resetResult: PasswordResetResult | null = null;
  statusResult: StatusUpdateResult | null = null;
  private readonly studentContactCache = new Map<number, StudentListMetadata>();
  private readonly studentContactLoadInFlight = new Set<number>();
  private readonly teacherNoteCache = new Map<number, string>();
  private readonly teacherNoteLoadInFlight = new Set<number>();
  private readonly ieltsStatusCache = new Map<number, IeltsTrackingStatus>();
  private readonly ieltsStatusLoadInFlight = new Set<number>();
  private readonly ieltsNoRequirement = new Set<number>();
  private readonly ieltsStatusUnavailable = new Set<number>();
  private readonly teacherNoteProfileCache = new Map<
    number,
    StudentProfilePayload | StudentProfileResponse
  >();
  private teacherNoteAutoSaveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private studentApi: StudentManagementService,
    private studentProfileApi: StudentProfileService,
    private inviteApi: StudentInviteService,
    private auth: AuthService,
    private router: Router,
    private ieltsApi: IeltsTrackingService,
    private teacherPreferenceApi: TeacherPreferenceService,
    private cdr: ChangeDetectorRef = { detectChanges: () => {} } as ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeVisibleColumns();
    this.loadVisibleColumnsPreferenceFromServer();
    this.loadStudents();
  }

  trackStudent = (_index: number, student: StudentAccount): string | number => {
    return this.resolveStudentId(student) ?? student.username;
  };

  trackColumn = (_index: number, column: StudentListColumnConfig): StudentListColumnKey => {
    return column.key;
  };

  displayName(student: StudentAccount): string {
    const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim();
    if (fullName) return fullName;

    if (student.displayName?.trim()) return student.displayName.trim();

    return '-';
  }

  resolveStudentId(student: StudentAccount): number | null {
    const row = (student ?? {}) as Record<string, unknown>;
    const nestedStudent =
      row['student'] && typeof row['student'] === 'object'
        ? (row['student'] as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const nestedUser =
      row['user'] && typeof row['user'] === 'object'
        ? (row['user'] as Record<string, unknown>)
        : ({} as Record<string, unknown>);

    const candidates: unknown[] = [
      student.studentId,
      row['studentId'],
      row['student_id'],
      row['studentID'],
      student.id,
      row['id'],
      nestedStudent['studentId'],
      nestedStudent['student_id'],
      nestedStudent['id'],
      student.userId,
      row['userId'],
      row['user_id'],
      nestedUser['studentId'],
      nestedUser['student_id'],
    ];

    for (const candidate of candidates) {
      const normalized = this.coercePositiveIntegerId(candidate);
      if (normalized !== null) return normalized;
    }
    return null;
  }

  private coercePositiveIntegerId(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return Math.trunc(value);
    }

    const text = String(value ?? '').trim();
    if (!text) return null;
    if (!/^\d+$/.test(text)) return null;

    const parsed = Number(text);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
  }

  resolveStudentEmail(student: StudentAccount): string {
    return this.resolveStudentEmailValue(student) || '-';
  }

  resolveStudentPhone(student: StudentAccount): string {
    return this.resolveStudentPhoneValue(student) || '-';
  }

  resolveStudentGraduation(student: StudentAccount): string {
    return this.formatGraduationYearMonth(this.resolveCurrentSchoolExpectedGraduationValue(student));
  }

  resolveStudentSchoolName(student: StudentAccount): string {
    return this.resolveCurrentSchoolNameValue(student) || '-';
  }

  resolveStudentCanadaIdentity(student: StudentAccount): string {
    return this.resolveIdentityInCanadaValue(student) || '-';
  }

  resolveStudentGender(student: StudentAccount): string {
    return this.resolveGenderValue(student) || '-';
  }

  resolveStudentNationality(student: StudentAccount): string {
    return this.resolveNationalityValue(student) || '-';
  }

  resolveStudentFirstLanguage(student: StudentAccount): string {
    return this.resolveFirstLanguageValue(student) || '-';
  }

  resolveStudentSchoolBoard(student: StudentAccount): string {
    return this.resolveCurrentSchoolBoardForFilter(student) || '-';
  }

  resolveStudentCountry(student: StudentAccount): string {
    return this.resolveCurrentSchoolCountryValue(student) || '-';
  }

  resolveStudentProvince(student: StudentAccount): string {
    return this.resolveCurrentSchoolProvinceValue(student) || '-';
  }

  resolveStudentCity(student: StudentAccount): string {
    return this.resolveCurrentSchoolCityValue(student) || '-';
  }

  resolveStudentColumnValue(student: StudentAccount, columnKey: StudentListColumnKey): string {
    switch (columnKey) {
      case 'name':
        return this.displayName(student);
      case 'email':
        return this.resolveStudentEmail(student);
      case 'phone':
        return this.resolveStudentPhone(student);
      case 'graduation':
        return this.resolveStudentGraduation(student);
      case 'schoolName':
        return this.resolveStudentSchoolName(student);
      case 'canadaIdentity':
        return this.resolveStudentCanadaIdentity(student);
      case 'gender':
        return this.resolveStudentGender(student);
      case 'nationality':
        return this.resolveStudentNationality(student);
      case 'firstLanguage':
        return this.resolveStudentFirstLanguage(student);
      case 'schoolBoard':
        return this.resolveStudentSchoolBoard(student);
      case 'country':
        return this.resolveStudentCountry(student);
      case 'province':
        return this.resolveStudentProvince(student);
      case 'city':
        return this.resolveStudentCity(student);
      default:
        return '-';
    }
  }

  get pageTitle(): string {
    return this.resolvePageContext() === 'ielts' ? '雅思跟踪' : '学生账号管理';
  }

  get visibleColumns(): readonly StudentListColumnConfig[] {
    return this.studentListColumns.filter((column) => this.visibleColumnKeys.has(column.key));
  }

  get columnToggleOptions(): readonly StudentListColumnConfig[] {
    return this.studentListColumns;
  }

  isColumnVisible(columnKey: StudentListColumnKey): boolean {
    return this.visibleColumnKeys.has(columnKey);
  }

  get provinceFilterCountry(): ProvinceFilterCountry | '' {
    if (this.countryFilter === 'Canada') return 'Canada';
    if (this.countryFilter === 'China (mainland)') return 'China (mainland)';
    if (this.countryFilter === 'United States') return 'United States';
    return '';
  }

  get provinceFilterOptions(): readonly string[] {
    return this.collectProvinceFilterOptions(this.provinceFilterCountry);
  }

  get cityFilterCountry(): ProvinceFilterCountry | '' {
    return this.provinceFilterCountry;
  }

  get cityFilterOptions(): readonly string[] {
    return this.collectCityFilterOptions(this.cityFilterCountry);
  }

  get schoolBoardFilterOptions(): readonly string[] {
    return this.mergeFilterOptions(
      this.schoolBoardFilterBaseOptions,
      this.collectSchoolBoardFilterOptions()
    );
  }

  get graduationSeasonFilterOptions(): readonly string[] {
    return this.collectGraduationSeasonFilterOptions();
  }

  onCountryFilterInputChange(value: string): void {
    const input = String(value ?? '').trim();
    this.countryFilterInput = input;
    this.countryFilter = input ? this.resolveCountryFilterSelection(input) : 'ALL';
    this.syncSchoolBoardFilterSelection();
    this.syncGraduationSeasonFilterSelection();
    this.applyListView();
  }

  onProvinceFilterInputChange(value: string): void {
    const input = String(value ?? '').trim();
    this.provinceFilterInput = input;
    const country = this.provinceFilterCountry;
    this.provinceFilter = input ? this.resolveProvinceFilterSelection(input, country) : '';
    this.syncSchoolBoardFilterSelection();
    this.syncGraduationSeasonFilterSelection();
    this.applyListView();
  }

  onCityFilterInputChange(value: string): void {
    const input = String(value ?? '').trim();
    this.cityFilterInput = input;
    const country = this.cityFilterCountry;
    this.cityFilter = input ? this.resolveCityFilterSelection(input, country) : '';
    this.syncSchoolBoardFilterSelection();
    this.syncGraduationSeasonFilterSelection();
    this.applyListView();
  }

  onSchoolBoardFilterInputChange(value: string): void {
    const input = String(value ?? '').trim();
    this.schoolBoardFilterInput = input;
    this.schoolBoardFilter = input ? this.resolveSchoolBoardFilterSelection(input) : '';
    this.syncGraduationSeasonFilterSelection();
    this.applyListView();
  }

  onGraduationSeasonFilterInputChange(value: string): void {
    const input = String(value ?? '').trim();
    this.graduationSeasonFilterInput = input;
    this.graduationSeasonFilter = input ? this.resolveGraduationSeasonFilterSelection(input) : '';
    this.applyListView();
  }

  private resolveCurrentSchoolCountryForFilter(student: StudentAccount): StudentCountryFilter {
    const normalized = this.normalizeCountryFilterValue(this.resolveCurrentSchoolCountryValue(student));
    return normalized || 'N/A';
  }

  private resolveCurrentSchoolProvinceForFilter(
    student: StudentAccount,
    country: ProvinceFilterCountry | '' = ''
  ): StudentProvinceFilter {
    const countryForNormalization =
      country || this.resolveProvinceFilterCountry(this.resolveCurrentSchoolCountryForFilter(student));
    const normalized = this.normalizeProvinceFilterValue(
      this.resolveCurrentSchoolProvinceValue(student),
      countryForNormalization
    );
    return normalized || '';
  }

  private collectProvinceFilterOptions(country: ProvinceFilterCountry | '' = ''): string[] {
    const baseOptions = country
      ? PROVINCE_FILTER_OPTIONS_BY_COUNTRY[country]
      : PROVINCE_FILTER_COUNTRIES.flatMap(
          (supportedCountry) => PROVINCE_FILTER_OPTIONS_BY_COUNTRY[supportedCountry]
        );
    const dynamicOptions: string[] = [];
    for (const student of this.students) {
      const studentCountry = this.resolveProvinceFilterCountry(
        this.resolveCurrentSchoolCountryForFilter(student)
      );
      if (country && studentCountry !== country) {
        continue;
      }
      const province = this.resolveCurrentSchoolProvinceForFilter(student, country || studentCountry);
      if (province) {
        dynamicOptions.push(province);
      }
    }
    return this.mergeFilterOptions(baseOptions, dynamicOptions);
  }

  private resolveCurrentSchoolCityForFilter(
    student: StudentAccount,
    country: ProvinceFilterCountry | '' = ''
  ): string {
    const countryForNormalization =
      country || this.resolveProvinceFilterCountry(this.resolveCurrentSchoolCountryForFilter(student));
    const normalized = this.normalizeCityFilterValue(
      this.resolveCurrentSchoolCityValue(student),
      countryForNormalization
    );
    return normalized || '';
  }

  private resolveCurrentSchoolBoardForFilter(student: StudentAccount): string {
    return String(this.resolveCurrentSchoolBoardValue(student) ?? '').trim();
  }

  private resolveCurrentSchoolGraduationSeasonForFilter(student: StudentAccount): string {
    const yearMonth = this.resolveGraduationYearMonth(
      this.resolveCurrentSchoolExpectedGraduationValue(student)
    );
    return this.toGraduationSeasonTag(yearMonth);
  }

  private collectCityFilterOptions(country: ProvinceFilterCountry | '' = ''): string[] {
    const baseOptions = country
      ? CITY_FILTER_OPTIONS_BY_COUNTRY[country]
      : PROVINCE_FILTER_COUNTRIES.flatMap(
          (supportedCountry) => CITY_FILTER_OPTIONS_BY_COUNTRY[supportedCountry]
        );
    const dynamicOptions: string[] = [];
    for (const student of this.students) {
      const studentCountry = this.resolveProvinceFilterCountry(
        this.resolveCurrentSchoolCountryForFilter(student)
      );
      if (country && studentCountry !== country) {
        continue;
      }
      const city = this.resolveCurrentSchoolCityForFilter(student, country || studentCountry);
      if (city) {
        dynamicOptions.push(city);
      }
    }
    return this.mergeFilterOptions(baseOptions, dynamicOptions);
  }

  private collectSchoolBoardFilterOptions(): string[] {
    const options: string[] = [];
    for (const student of this.students) {
      if (!this.matchesListFilters(student, true, false)) {
        continue;
      }

      const schoolBoard = this.resolveCurrentSchoolBoardForFilter(student);
      if (schoolBoard) {
        options.push(schoolBoard);
      }
    }

    return this.mergeFilterOptions([], options);
  }

  private collectGraduationSeasonFilterOptions(): string[] {
    const options: string[] = [];
    for (let year = 2025; year <= 2030; year += 1) {
      options.push(`${year} Fall`);
      options.push(`${year} Winter`);
    }

    return this.mergeFilterOptions([], options);
  }

  private syncSchoolBoardFilterSelection(): void {
    const input = String(this.schoolBoardFilterInput ?? '').trim();
    if (!input) {
      this.schoolBoardFilter = '';
      return;
    }

    const resolved = this.resolveSchoolBoardFilterSelection(input);
    const resolvedKey = this.normalizeCountryKey(resolved);
    const optionExists = this.schoolBoardFilterOptions.some(
      (option) => this.normalizeCountryKey(option) === resolvedKey
    );

    if (!resolved || !optionExists) {
      this.schoolBoardFilterInput = '';
      this.schoolBoardFilter = '';
      return;
    }

    this.schoolBoardFilterInput = resolved;
    this.schoolBoardFilter = resolved;
  }

  private syncGraduationSeasonFilterSelection(): void {
    const input = String(this.graduationSeasonFilterInput ?? '').trim();
    if (!input) {
      this.graduationSeasonFilter = '';
      return;
    }

    const resolved = this.resolveGraduationSeasonFilterSelection(input);
    const resolvedKey = this.normalizeGraduationSeasonFilterValue(resolved);
    const optionExists = this.graduationSeasonFilterOptions.some(
      (option) => this.normalizeGraduationSeasonFilterValue(option) === resolvedKey
    );

    if (!resolved || !resolvedKey || !optionExists) {
      this.graduationSeasonFilterInput = '';
      this.graduationSeasonFilter = '';
      return;
    }

    this.graduationSeasonFilterInput = resolved;
    this.graduationSeasonFilter = resolved;
  }

  private mergeFilterOptions(primary: readonly string[], extra: readonly string[]): string[] {
    const options: string[] = [];
    const seen = new Set<string>();
    const append = (value: unknown): void => {
      const text = String(value ?? '').trim();
      if (!text) return;
      const key = this.normalizeCountryKey(text);
      if (!key || seen.has(key)) return;
      seen.add(key);
      options.push(text);
    };

    primary.forEach(append);
    extra.forEach(append);
    return options;
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
    const schoolNode =
      currentSchool['school'] && typeof currentSchool['school'] === 'object'
        ? (currentSchool['school'] as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const schoolAddress =
      currentSchool['address'] && typeof currentSchool['address'] === 'object'
        ? (currentSchool['address'] as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const schoolNodeAddress =
      schoolNode['address'] && typeof schoolNode['address'] === 'object'
        ? (schoolNode['address'] as Record<string, unknown>)
        : ({} as Record<string, unknown>);

    return this.pickFirstText([
      student?.['currentSchoolCountry'],
      student?.['schoolCountry'],
      student?.['country'],
      profileNode['currentSchoolCountry'],
      profileNode['schoolCountry'],
      currentSchool['country'],
      schoolNode['country'],
      schoolAddress['country'],
      schoolNodeAddress['country'],
    ]);
  }

  private resolveCurrentSchoolProvinceValue(student: StudentAccount): string {
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
    const schoolNode =
      currentSchool['school'] && typeof currentSchool['school'] === 'object'
        ? (currentSchool['school'] as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const schoolAddress =
      currentSchool['address'] && typeof currentSchool['address'] === 'object'
        ? (currentSchool['address'] as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const schoolNodeAddress =
      schoolNode['address'] && typeof schoolNode['address'] === 'object'
        ? (schoolNode['address'] as Record<string, unknown>)
        : ({} as Record<string, unknown>);

    return this.pickFirstText([
      student?.['currentSchoolProvince'],
      student?.['schoolProvince'],
      student?.['province'],
      student?.['state'],
      student?.['region'],
      profileNode['currentSchoolProvince'],
      profileNode['schoolProvince'],
      profileNode['province'],
      profileNode['state'],
      profileNode['region'],
      currentSchool['province'],
      currentSchool['state'],
      currentSchool['region'],
      schoolNode['province'],
      schoolNode['state'],
      schoolNode['region'],
      schoolAddress['province'],
      schoolAddress['state'],
      schoolAddress['region'],
      schoolAddress['administrativeArea'],
      schoolNodeAddress['province'],
      schoolNodeAddress['state'],
      schoolNodeAddress['region'],
      schoolNodeAddress['administrativeArea'],
    ]);
  }

  private resolveCurrentSchoolCityValue(student: StudentAccount): string {
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
    const schoolNode =
      currentSchool['school'] && typeof currentSchool['school'] === 'object'
        ? (currentSchool['school'] as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const schoolAddress =
      currentSchool['address'] && typeof currentSchool['address'] === 'object'
        ? (currentSchool['address'] as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const schoolNodeAddress =
      schoolNode['address'] && typeof schoolNode['address'] === 'object'
        ? (schoolNode['address'] as Record<string, unknown>)
        : ({} as Record<string, unknown>);

    return this.pickFirstText([
      student?.['currentSchoolCity'],
      student?.['schoolCity'],
      student?.['city'],
      student?.['town'],
      student?.['municipality'],
      profileNode['currentSchoolCity'],
      profileNode['schoolCity'],
      profileNode['city'],
      profileNode['town'],
      profileNode['municipality'],
      currentSchool['city'],
      currentSchool['town'],
      currentSchool['municipality'],
      schoolNode['city'],
      schoolNode['town'],
      schoolNode['municipality'],
      schoolAddress['city'],
      schoolAddress['town'],
      schoolAddress['municipality'],
      schoolAddress['locality'],
      schoolNodeAddress['city'],
      schoolNodeAddress['town'],
      schoolNodeAddress['municipality'],
      schoolNodeAddress['locality'],
    ]);
  }

  private resolveCurrentSchoolBoardValue(student: StudentAccount): string {
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
    const schoolNode =
      currentSchool['school'] && typeof currentSchool['school'] === 'object'
        ? (currentSchool['school'] as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const schoolAddress =
      currentSchool['address'] && typeof currentSchool['address'] === 'object'
        ? (currentSchool['address'] as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const schoolNodeAddress =
      schoolNode['address'] && typeof schoolNode['address'] === 'object'
        ? (schoolNode['address'] as Record<string, unknown>)
        : ({} as Record<string, unknown>);

    return this.pickFirstText([
      student?.['currentSchoolBoard'],
      student?.['schoolBoard'],
      student?.['boardName'],
      student?.['educationBureau'],
      student?.['bureau'],
      student?.['schoolBoardName'],
      student?.['board'],
      student?.['district'],
      student?.['districtName'],
      profileNode['currentSchoolBoard'],
      profileNode['schoolBoard'],
      profileNode['boardName'],
      profileNode['educationBureau'],
      profileNode['bureau'],
      profileNode['schoolBoardName'],
      profileNode['board'],
      profileNode['district'],
      profileNode['districtName'],
      currentSchool['schoolBoard'],
      currentSchool['boardName'],
      currentSchool['educationBureau'],
      currentSchool['bureau'],
      currentSchool['schoolBoardName'],
      currentSchool['board'],
      currentSchool['district'],
      currentSchool['districtName'],
      schoolNode['schoolBoard'],
      schoolNode['boardName'],
      schoolNode['educationBureau'],
      schoolNode['bureau'],
      schoolNode['schoolBoardName'],
      schoolNode['board'],
      schoolNode['district'],
      schoolNode['districtName'],
      schoolAddress['schoolBoard'],
      schoolAddress['boardName'],
      schoolAddress['educationBureau'],
      schoolAddress['bureau'],
      schoolAddress['schoolBoardName'],
      schoolAddress['board'],
      schoolAddress['district'],
      schoolAddress['districtName'],
      schoolNodeAddress['schoolBoard'],
      schoolNodeAddress['boardName'],
      schoolNodeAddress['educationBureau'],
      schoolNodeAddress['bureau'],
      schoolNodeAddress['schoolBoardName'],
      schoolNodeAddress['board'],
      schoolNodeAddress['district'],
      schoolNodeAddress['districtName'],
    ]);
  }

  private resolveCurrentSchoolExpectedGraduationValue(student: StudentAccount): string {
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
    const schoolNode =
      currentSchool['school'] && typeof currentSchool['school'] === 'object'
        ? (currentSchool['school'] as Record<string, unknown>)
        : ({} as Record<string, unknown>);

    return this.pickFirstText([
      student?.['currentSchoolExpectedGraduation'],
      student?.['expectedGraduationTime'],
      student?.['expectedGraduationDate'],
      student?.['expectedGraduateDate'],
      student?.['expectedGraduateTime'],
      student?.['expectedGraduationAt'],
      student?.['graduationDate'],
      student?.['graduationTime'],
      student?.['graduationAt'],
      student?.['endTime'],
      profileNode['currentSchoolExpectedGraduation'],
      profileNode['expectedGraduationTime'],
      profileNode['expectedGraduationDate'],
      profileNode['expectedGraduateDate'],
      profileNode['expectedGraduateTime'],
      profileNode['expectedGraduationAt'],
      profileNode['graduationDate'],
      profileNode['graduationTime'],
      profileNode['graduationAt'],
      currentSchool['currentSchoolExpectedGraduation'],
      currentSchool['expectedGraduationTime'],
      currentSchool['expectedGraduationDate'],
      currentSchool['expectedGraduateDate'],
      currentSchool['expectedGraduateTime'],
      currentSchool['expectedGraduationAt'],
      currentSchool['graduationDate'],
      currentSchool['graduationTime'],
      currentSchool['graduationAt'],
      currentSchool['endTime'],
      schoolNode['currentSchoolExpectedGraduation'],
      schoolNode['expectedGraduationTime'],
      schoolNode['expectedGraduationDate'],
      schoolNode['expectedGraduateDate'],
      schoolNode['expectedGraduateTime'],
      schoolNode['expectedGraduationAt'],
      schoolNode['graduationDate'],
      schoolNode['graduationTime'],
      schoolNode['graduationAt'],
      schoolNode['endTime'],
    ]);
  }

  profileRoute(student: StudentAccount): string[] {
    const studentId = this.resolveStudentId(student);
    if (!studentId) {
      return ['/teacher/students'];
    }
    return ['/teacher/students', String(studentId), 'profile'];
  }

  ieltsRoute(student: StudentAccount): string[] {
    const studentId = this.resolveStudentId(student);
    if (!studentId) {
      return ['/teacher/students'];
    }
    return ['/teacher/students', String(studentId), 'ielts'];
  }

  resolveIeltsStatusLabel(student: StudentAccount): string {
    const status = this.resolveIeltsStatusKey(this.resolveStudentId(student));
    if (status === 'NO_IELTS_REQUIRED') return '无需雅思';
    if (status === 'GREEN_STRICT_PASS') return '以满足雅思';
    if (status === 'GREEN_COMMON_PASS_WITH_WARNING') return '以满足雅思(大部分本科)';
    if (status === 'LOADING') return '加载中...';
    if (status === 'YELLOW_NEEDS_PREPARATION' || status === 'UNAVAILABLE') return '可能需要雅思';
    return '可能需要雅思';
  }

  resolveIeltsStatusBackground(student: StudentAccount): string {
    const status = this.resolveIeltsStatusKey(this.resolveStudentId(student));
    if (status === 'NO_IELTS_REQUIRED') return '#f1f3f5';
    if (status === 'UNAVAILABLE') return '#fff2d8';
    if (status === 'GREEN_STRICT_PASS') return '#d8f3dc';
    if (status === 'GREEN_COMMON_PASS_WITH_WARNING') return '#e4f6e8';
    if (status === 'YELLOW_NEEDS_PREPARATION') return '#fff2d8';
    if (status === 'LOADING') return '#edf2fb';
    return '#f1f3f5';
  }

  resolveIeltsStatusTextColor(student: StudentAccount): string {
    const status = this.resolveIeltsStatusKey(this.resolveStudentId(student));
    if (status === 'NO_IELTS_REQUIRED') return '#6a7385';
    if (status === 'UNAVAILABLE') return '#8a5a00';
    if (status === 'GREEN_STRICT_PASS') return '#1f6a33';
    if (status === 'GREEN_COMMON_PASS_WITH_WARNING') return '#2d7d45';
    if (status === 'YELLOW_NEEDS_PREPARATION') return '#8a5a00';
    if (status === 'LOADING') return '#4a5f82';
    return '#6a7385';
  }

  loadStudents(): void {
    this.loadingList = true;
    this.listError = '';
    this.ieltsStatusCache.clear();
    this.ieltsStatusLoadInFlight.clear();
    this.ieltsNoRequirement.clear();
    this.ieltsStatusUnavailable.clear();
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

  isTeacherNoteRowSelected(student: StudentAccount): boolean {
    const studentId = this.resolveStudentId(student);
    return !!studentId && studentId === this.selectedNoteStudentId;
  }

  resolveTeacherNoteCellValue(student: StudentAccount): string {
    const studentId = this.resolveStudentId(student);
    if (!studentId) {
      return '';
    }

    if (this.selectedNoteStudentId === studentId) {
      return this.teacherNoteDraft;
    }

    return this.teacherNoteCache.get(studentId) ?? '';
  }

  prepareTeacherNoteCell(student: StudentAccount): void {
    if (this.isTeacherNoteRowSelected(student)) {
      return;
    }

    this.openTeacherNote(student);
  }

  onTeacherNoteCellChange(student: StudentAccount, value: unknown): void {
    const studentId = this.resolveStudentId(student);
    if (!studentId) {
      return;
    }

    if (this.selectedNoteStudentId !== studentId) {
      const resolvedDisplayName = this.displayName(student);
      this.selectedNoteStudentId = studentId;
      this.selectedNoteStudentName =
        resolvedDisplayName !== '-' ? resolvedDisplayName : student.username || `#${studentId}`;
      this.teacherNoteError = '';
      this.teacherNoteSuccess = '';
    }

    this.teacherNoteDraft = String(value ?? '');
    this.teacherNoteCache.set(studentId, this.teacherNoteDraft);
    this.teacherNoteSuccess = '';
    this.scheduleTeacherNoteAutoSave(studentId);
    this.cdr.detectChanges();
  }

  onTeacherNoteCellBlur(student: StudentAccount): void {
    const studentId = this.resolveStudentId(student);
    if (!studentId) {
      return;
    }

    if (this.selectedNoteStudentId !== studentId) {
      this.openTeacherNote(student);
      return;
    }

    this.flushTeacherNoteAutoSave(studentId);
  }

  openTeacherNote(student: StudentAccount): void {
    const studentId = this.resolveStudentId(student);
    if (!studentId) {
      this.teacherNoteError = '缺少学生 ID，无法编辑备注。';
      this.teacherNoteSuccess = '';
      this.cdr.detectChanges();
      return;
    }

    this.clearTeacherNoteAutoSaveTimer();

    const resolvedDisplayName = this.displayName(student);
    this.selectedNoteStudentId = studentId;
    this.selectedNoteStudentName =
      resolvedDisplayName !== '-' ? resolvedDisplayName : student.username || `#${studentId}`;
    this.teacherNoteError = '';
    this.teacherNoteSuccess = '';
    this.teacherNoteDraft = this.teacherNoteCache.get(studentId) ?? '';

    const cachedProfile = this.teacherNoteProfileCache.get(studentId);
    if (cachedProfile) {
      if (!this.teacherNoteDraft) {
        const cachedNote = this.extractTeacherNoteFromProfile(cachedProfile);
        this.teacherNoteDraft = cachedNote;
        this.teacherNoteCache.set(studentId, cachedNote);
      }
      this.cdr.detectChanges();
      return;
    }

    this.teacherNoteLoading = true;
    this.cdr.detectChanges();
    this.studentProfileApi
      .getStudentProfileForTeacher(studentId)
      .pipe(
        finalize(() => {
          this.teacherNoteLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (payload) => {
          this.teacherNoteProfileCache.set(studentId, payload);
          const note = this.extractTeacherNoteFromProfile(payload);
          this.teacherNoteDraft = note;
          this.teacherNoteCache.set(studentId, note);
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.teacherNoteError = this.extractErrorMessage(err) || '加载备注失败。';
          this.cdr.detectChanges();
        },
      });
  }

  saveTeacherNote(): void {
    const studentId = this.selectedNoteStudentId;
    if (!studentId || this.teacherNoteSaving) {
      return;
    }

    this.clearTeacherNoteAutoSaveTimer();

    const noteText = String(this.teacherNoteDraft ?? '').trim();
    this.teacherNoteSaving = true;
    this.teacherNoteError = '';
    this.teacherNoteSuccess = '';
    this.cdr.detectChanges();

    const cachedProfile = this.teacherNoteProfileCache.get(studentId);
    if (cachedProfile) {
      this.saveTeacherNoteWithProfile(studentId, cachedProfile, noteText);
      return;
    }

    this.studentProfileApi.getStudentProfileForTeacher(studentId).subscribe({
      next: (payload) => {
        this.teacherNoteProfileCache.set(studentId, payload);
        this.saveTeacherNoteWithProfile(studentId, payload, noteText);
      },
      error: (err: HttpErrorResponse) => {
        this.teacherNoteSaving = false;
        this.teacherNoteError = this.extractErrorMessage(err) || '保存备注失败。';
        this.cdr.detectChanges();
      },
    });
  }

  private scheduleTeacherNoteAutoSave(studentId: number): void {
    if (this.selectedNoteStudentId !== studentId) {
      return;
    }

    this.clearTeacherNoteAutoSaveTimer();
    this.teacherNoteAutoSaveTimer = setTimeout(() => {
      this.teacherNoteAutoSaveTimer = null;
      if (
        this.selectedNoteStudentId !== studentId ||
        this.teacherNoteLoading ||
        this.teacherNoteSaving
      ) {
        return;
      }
      this.saveTeacherNote();
    }, 700);
  }

  private flushTeacherNoteAutoSave(studentId: number): void {
    this.clearTeacherNoteAutoSaveTimer();
    if (
      this.selectedNoteStudentId !== studentId ||
      this.teacherNoteLoading ||
      this.teacherNoteSaving
    ) {
      return;
    }
    this.saveTeacherNote();
  }

  private clearTeacherNoteAutoSaveTimer(): void {
    if (this.teacherNoteAutoSaveTimer) {
      clearTimeout(this.teacherNoteAutoSaveTimer);
      this.teacherNoteAutoSaveTimer = null;
    }
  }

  private saveTeacherNoteWithProfile(
    studentId: number,
    profilePayload: StudentProfilePayload | StudentProfileResponse | null | undefined,
    noteText: string
  ): void {
    const requestPayload = this.buildTeacherProfilePayloadWithNote(profilePayload, noteText);
    this.studentProfileApi
      .saveStudentProfileForTeacher(studentId, requestPayload)
      .pipe(
        finalize(() => {
          this.teacherNoteSaving = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (savedPayload) => {
          this.teacherNoteProfileCache.set(studentId, savedPayload);
          this.teacherNoteCache.set(studentId, noteText);
          this.teacherNoteDraft = noteText;
          this.teacherNoteSuccess = '备注已保存。';
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.teacherNoteError = this.extractErrorMessage(err) || '保存备注失败。';
          this.cdr.detectChanges();
        },
      });
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

  toggleFilterPanel(): void {
    this.isFilterPanelExpanded = !this.isFilterPanelExpanded;
  }

  toggleColumnPanel(): void {
    this.isColumnPanelExpanded = !this.isColumnPanelExpanded;
  }

  onColumnVisibilityChange(columnKey: StudentListColumnKey, event: Event): void {
    const config = this.studentListColumns.find((column) => column.key === columnKey);
    if (!config || !config.hideable) return;

    const checked = (event.target as HTMLInputElement | null)?.checked === true;
    const next = new Set(this.visibleColumnKeys);
    if (checked) next.add(columnKey);
    else next.delete(columnKey);

    for (const requiredColumn of this.studentListColumns) {
      if (!requiredColumn.hideable) {
        next.add(requiredColumn.key);
      }
    }

    this.visibleColumnKeys = next;
    this.persistIndependentColumnOverrides();
    this.persistVisibleColumnsPreference();
    this.syncVisibleColumnsPreferenceToServer();

    if (checked && config.backendDependent) {
      this.hydrateStudentMetadata(this.students);
    }

    if (columnKey === 'teacherNote' && checked) {
      this.prefetchVisibleTeacherNotes();
      this.cdr.detectChanges();
    }
  }

  resetVisibleColumns(): void {
    this.visibleColumnKeys = this.buildDefaultVisibleColumnKeys();
    this.persistIndependentColumnOverrides();
    this.persistVisibleColumnsPreference();
    this.syncVisibleColumnsPreferenceToServer();
    this.hydrateStudentMetadata(this.students);
    if (this.visibleColumnKeys.has('teacherNote')) {
      this.prefetchVisibleTeacherNotes();
      this.cdr.detectChanges();
    }
  }

  isColumnSelectionAtDefault(): boolean {
    const defaultSet = this.buildDefaultVisibleColumnKeys();
    if (defaultSet.size !== this.visibleColumnKeys.size) {
      return false;
    }
    for (const key of defaultSet.values()) {
      if (!this.visibleColumnKeys.has(key)) {
        return false;
      }
    }
    return true;
  }

  private initializeVisibleColumns(): void {
    const defaults = this.buildDefaultVisibleColumnKeys();
    const persisted = this.readVisibleColumnsPreference();
    if (!persisted) {
      this.visibleColumnKeys = this.applyIndependentColumnOverrides(defaults);
      this.persistIndependentColumnOverrides();
      return;
    }

    const restored = this.normalizeVisibleColumnKeys(persisted);
    const base = restored.size > 0 ? restored : defaults;
    this.visibleColumnKeys = this.applyIndependentColumnOverrides(base);
    this.persistIndependentColumnOverrides();
  }

  private buildDefaultVisibleColumnKeys(): Set<StudentListColumnKey> {
    if (this.resolvePageContext() === 'ielts') {
      return this.normalizeVisibleColumnKeys(IELTS_TRACKING_DEFAULT_COLUMN_KEYS);
    }
    return buildVisibleColumnDefaults(this.studentListColumns);
  }

  private persistVisibleColumnsPreference(): void {
    try {
      const storage = (globalThis as { localStorage?: Storage }).localStorage;
      if (!storage) return;
      const storageKey = this.resolveVisibleColumnsStorageKey();
      storage.setItem(
        storageKey,
        JSON.stringify(Array.from(this.visibleColumnKeys.values()))
      );
    } catch {}
  }

  private readVisibleColumnsPreference(): StudentListColumnKey[] | null {
    try {
      const storage = (globalThis as { localStorage?: Storage }).localStorage;
      if (!storage) return null;
      const storageKey = this.resolveVisibleColumnsStorageKey();
      const raw = storage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      const keys = parsed
        .map((value) => String(value ?? '').trim())
        .filter((value): value is StudentListColumnKey => {
          return this.studentListColumns.some((column) => column.key === value);
        });
      return keys.length > 0 ? keys : null;
    } catch {
      return null;
    }
  }

  private resolveVisibleColumnsStorageKey(): string {
    const pageContext = this.resolvePageContext();
    const pageScope = `page-${pageContext}`;
    const session = this.auth.getSession();
    const teacherId = Number(session?.teacherId);
    if (Number.isFinite(teacherId) && teacherId > 0) {
      return `${STUDENT_LIST_COLUMN_PREFERENCE_STORAGE_KEY_PREFIX}.${pageScope}.teacher-${Math.trunc(teacherId)}.${STUDENT_LIST_COLUMN_PREFERENCE_VERSION}`;
    }

    const userId = this.auth.getCurrentUserId();
    if (userId && userId > 0) {
      return `${STUDENT_LIST_COLUMN_PREFERENCE_STORAGE_KEY_PREFIX}.${pageScope}.user-${Math.trunc(userId)}.${STUDENT_LIST_COLUMN_PREFERENCE_VERSION}`;
    }

    return `${STUDENT_LIST_COLUMN_PREFERENCE_STORAGE_KEY_PREFIX}.${pageScope}.anonymous.${STUDENT_LIST_COLUMN_PREFERENCE_VERSION}`;
  }

  private resolvePageContext(): StudentManagementPageContext {
    const url = String(this.router.url || (globalThis as { location?: Location }).location?.pathname || '')
      .trim()
      .toLowerCase();
    if (url.startsWith('/teacher/ielts')) {
      return 'ielts';
    }
    return 'students';
  }

  private resolveVisibleColumnsPreferencePageKey(): string {
    return STUDENT_LIST_COLUMN_PREFERENCE_PAGE_KEY_BY_CONTEXT[this.resolvePageContext()];
  }

  private normalizeVisibleColumnKeys(keys: readonly string[]): Set<StudentListColumnKey> {
    return normalizeVisibleKeys(this.studentListColumns, keys);
  }

  private loadVisibleColumnsPreferenceFromServer(): void {
    const authorization = this.auth.getAuthorizationHeaderValue();
    if (!authorization) return;

    const pagePreferenceKey = this.resolveVisibleColumnsPreferencePageKey();
    this.teacherPreferenceApi.getPagePreference(pagePreferenceKey).subscribe({
      next: (payload) => {
        const remoteKeys = Array.isArray(payload?.visibleColumnKeys)
          ? payload.visibleColumnKeys.map((key) => String(key ?? '').trim())
          : [];
        if (remoteKeys.length === 0) {
          return;
        }

        const normalized = this.normalizeVisibleColumnKeys(remoteKeys);
        if (normalized.size === 0) {
          return;
        }

        this.visibleColumnKeys = this.applyIndependentColumnOverrides(normalized);
        this.persistIndependentColumnOverrides();
        this.persistVisibleColumnsPreference();
        this.hydrateStudentMetadata(this.students);
        if (this.visibleColumnKeys.has('teacherNote')) {
          this.prefetchVisibleTeacherNotes();
        }
        this.cdr.detectChanges();
      },
      error: () => {},
    });
  }

  private isIndependentlyOverridableColumn(
    columnKey: StudentListColumnKey
  ): columnKey is 'profile' | 'ielts' {
    return columnKey === 'profile' || columnKey === 'ielts';
  }

  private persistIndependentColumnOverride(columnKey: StudentListColumnKey): void {
    if (!this.isIndependentlyOverridableColumn(columnKey)) return;

    try {
      const storage = (globalThis as { localStorage?: Storage }).localStorage;
      if (!storage) return;
      const storageKey = this.resolveIndependentColumnOverrideStorageKey(columnKey);
      const visible = this.visibleColumnKeys.has(columnKey) ? '1' : '0';
      storage.setItem(storageKey, visible);
    } catch {}
  }

  private persistIndependentColumnOverrides(): void {
    this.persistIndependentColumnOverride('profile');
    this.persistIndependentColumnOverride('ielts');
  }

  private applyIndependentColumnOverrides(
    base: Set<StudentListColumnKey>
  ): Set<StudentListColumnKey> {
    const next = new Set<StudentListColumnKey>(base);
    for (const columnKey of ['profile', 'ielts'] as const) {
      const override = this.readIndependentColumnOverride(columnKey);
      if (override === null) continue;
      if (override) next.add(columnKey);
      else next.delete(columnKey);
    }
    return next;
  }

  private readIndependentColumnOverride(columnKey: 'profile' | 'ielts'): boolean | null {
    try {
      const storage = (globalThis as { localStorage?: Storage }).localStorage;
      if (!storage) return null;
      const storageKey = this.resolveIndependentColumnOverrideStorageKey(columnKey);
      const raw = String(storage.getItem(storageKey) ?? '').trim();
      if (!raw) return null;
      if (raw === '1' || raw.toLowerCase() === 'true') return true;
      if (raw === '0' || raw.toLowerCase() === 'false') return false;
      return null;
    } catch {
      return null;
    }
  }

  private resolveIndependentColumnOverrideStorageKey(columnKey: 'profile' | 'ielts'): string {
    const sessionScopedKey = this.resolveVisibleColumnsStorageKey();
    return `${STUDENT_LIST_COLUMN_VISIBILITY_OVERRIDE_STORAGE_KEY_PREFIX}.${sessionScopedKey}.${columnKey}`;
  }

  private syncVisibleColumnsPreferenceToServer(): void {
    const authorization = this.auth.getAuthorizationHeaderValue();
    if (!authorization) return;

    const pagePreferenceKey = this.resolveVisibleColumnsPreferencePageKey();
    const payload = {
      version: STUDENT_LIST_COLUMN_PREFERENCE_VERSION,
      visibleColumnKeys: Array.from(this.visibleColumnKeys.values()),
    };
    this.teacherPreferenceApi
      .upsertPagePreference(pagePreferenceKey, payload)
      .subscribe({
        next: () => {},
        error: () => {},
      });
  }

  isListControlsAtDefault(): boolean {
    return (
      this.listLimit === 20 &&
      !this.showInactive &&
      !this.searchKeyword.trim() &&
      this.countryFilter === 'ALL' &&
      !this.provinceFilterInput.trim() &&
      !this.cityFilterInput.trim() &&
      !this.schoolBoardFilterInput.trim() &&
      !this.graduationSeasonFilterInput.trim()
    );
  }

  clearListControls(): void {
    this.listLimit = 20;
    this.showInactive = false;
    this.searchKeyword = '';
    this.countryFilterInput = '';
    this.countryFilter = 'ALL';
    this.provinceFilterInput = '';
    this.provinceFilter = '';
    this.cityFilterInput = '';
    this.cityFilter = '';
    this.schoolBoardFilterInput = '';
    this.schoolBoardFilter = '';
    this.graduationSeasonFilterInput = '';
    this.graduationSeasonFilter = '';
    this.applyListView();
  }

  toggleInactiveVisibility(): void {
    this.showInactive = !this.showInactive;
    this.applyListView();
  }

  applyListView(): void {
    const filtered = this.students.filter((student) => this.matchesListFilters(student));

    this.filteredCount = filtered.length;
    this.visibleStudents = filtered.slice(0, this.listLimit);
    if (this.visibleColumnKeys.has('teacherNote')) {
      this.prefetchVisibleTeacherNotes();
    }
    if (this.visibleColumnKeys.has('ielts')) {
      this.prefetchVisibleIeltsStatuses();
    }
  }

  private matchesListFilters(
    student: StudentAccount,
    ignoreSchoolBoardFilter = false,
    ignoreGraduationSeasonFilter = false
  ): boolean {
    if (!this.showInactive && this.resolveStatus(student) !== 'ACTIVE') {
      return false;
    }

    const studentCountry = this.resolveCurrentSchoolCountryForFilter(student);

    if (this.countryFilter !== 'ALL') {
      let countryMatched = false;
      if (this.countryFilter === 'N/A') {
        countryMatched = studentCountry === 'N/A';
      } else if (this.countryFilter === 'Canada') {
        countryMatched = studentCountry === 'Canada' || studentCountry === 'N/A';
      } else {
        countryMatched = studentCountry === this.countryFilter;
      }
      if (!countryMatched) {
        return false;
      }
    }

    const provinceFilterKey = this.normalizeCountryKey(this.provinceFilter);
    if (provinceFilterKey) {
      const provinceCountry = this.resolveProvinceFilterCountry(studentCountry);
      const studentProvince = this.resolveCurrentSchoolProvinceForFilter(student, provinceCountry);
      if (!studentProvince) {
        return false;
      }
      if (this.normalizeCountryKey(studentProvince) !== provinceFilterKey) {
        return false;
      }
    }

    const cityFilterKey = this.normalizeCountryKey(this.cityFilter);
    if (cityFilterKey) {
      const cityCountry = this.resolveProvinceFilterCountry(studentCountry);
      const studentCity = this.resolveCurrentSchoolCityForFilter(student, cityCountry);
      if (!studentCity) {
        return false;
      }
      if (this.normalizeCountryKey(studentCity) !== cityFilterKey) {
        return false;
      }
    }

    if (!ignoreSchoolBoardFilter) {
      const schoolBoardFilterKey = this.normalizeCountryKey(this.schoolBoardFilter);
      if (schoolBoardFilterKey) {
        const studentSchoolBoard = this.resolveCurrentSchoolBoardForFilter(student);
        if (!studentSchoolBoard) {
          return false;
        }
        if (this.normalizeCountryKey(studentSchoolBoard) !== schoolBoardFilterKey) {
          return false;
        }
      }
    }

    if (!ignoreGraduationSeasonFilter) {
      const seasonFilter = this.normalizeGraduationSeasonFilterValue(this.graduationSeasonFilter);
      if (seasonFilter) {
        const studentSeason = this.resolveCurrentSchoolGraduationSeasonForFilter(student);
        if (!studentSeason) {
          return false;
        }
        if (this.normalizeGraduationSeasonFilterValue(studentSeason) !== seasonFilter) {
          return false;
        }
      }
    }

    const keyword = this.searchKeyword.trim().toLowerCase();
    if (!keyword) {
      return true;
    }

    const searchFields = [
      String(this.resolveStudentId(student) ?? ''),
      this.displayName(student),
      this.resolveStudentEmailValue(student),
      this.resolveStudentPhoneValue(student),
      this.resolveStudentGraduation(student),
      this.resolveCurrentSchoolGraduationSeasonForFilter(student),
      this.resolveCurrentSchoolNameValue(student),
      this.resolveIdentityInCanadaValue(student),
      this.resolveGenderValue(student),
      this.resolveNationalityValue(student),
      this.resolveFirstLanguageValue(student),
      this.resolveCurrentSchoolBoardValue(student),
      this.resolveCurrentSchoolCountryValue(student),
      this.resolveCurrentSchoolProvinceValue(student),
      this.resolveCurrentSchoolCityValue(student),
    ];

    return searchFields.some((field) => field.toLowerCase().includes(keyword));
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
      const schoolName = this.resolveCurrentSchoolNameValue(student);
      const canadaIdentity = this.resolveIdentityInCanadaValue(student);
      const gender = this.resolveGenderValue(student);
      const nationality = this.resolveNationalityValue(student);
      const firstLanguage = this.resolveFirstLanguageValue(student);
      const currentSchoolCountry = this.resolveCurrentSchoolCountryValue(student);
      const currentSchoolProvince = this.resolveCurrentSchoolProvinceValue(student);
      const currentSchoolCity = this.resolveCurrentSchoolCityValue(student);
      const currentSchoolBoard = this.resolveCurrentSchoolBoardValue(student);
      const currentSchoolExpectedGraduation = this.resolveCurrentSchoolExpectedGraduationValue(student);

      return {
        ...student,
        email: email || undefined,
        phone: phone || undefined,
        currentSchoolName: schoolName || undefined,
        canadaIdentity: canadaIdentity || undefined,
        gender: gender || undefined,
        nationality: nationality || undefined,
        firstLanguage: firstLanguage || undefined,
        currentSchoolCountry: currentSchoolCountry || undefined,
        currentSchoolProvince: currentSchoolProvince || undefined,
        currentSchoolCity: currentSchoolCity || undefined,
        currentSchoolBoard: currentSchoolBoard || undefined,
        currentSchoolExpectedGraduation: currentSchoolExpectedGraduation || undefined,
        status: this.resolveStatus(student),
      };
    });
  }

  private hydrateStudentMetadata(students: StudentAccount[]): void {
    const requiresExtendedMetadata =
      this.visibleColumnKeys.has('schoolName') ||
      this.visibleColumnKeys.has('canadaIdentity') ||
      this.visibleColumnKeys.has('gender') ||
      this.visibleColumnKeys.has('nationality') ||
      this.visibleColumnKeys.has('firstLanguage');

    for (const student of students) {
      const studentId = this.resolveStudentId(student);
      if (!studentId) {
        continue;
      }

      const cached = this.studentContactCache.get(studentId);
      if (cached) {
        this.applyStudentMetadata(student, cached);
        const cachedHasCore =
          !!(
            cached.email &&
            cached.phone &&
            cached.currentSchoolCountry &&
            cached.currentSchoolProvince &&
            cached.currentSchoolCity &&
            cached.currentSchoolBoard &&
            cached.currentSchoolExpectedGraduation
          );
        const cachedHasExtended =
          !!(
            cached.schoolName &&
            cached.canadaIdentity &&
            cached.gender &&
            cached.nationality &&
            cached.firstLanguage
          );
        if (cachedHasCore && (!requiresExtendedMetadata || cachedHasExtended)) {
          continue;
        }
      }

      const email = this.resolveStudentEmailValue(student);
      const phone = this.resolveStudentPhoneValue(student);
      const schoolName = this.resolveCurrentSchoolNameValue(student);
      const canadaIdentity = this.resolveIdentityInCanadaValue(student);
      const gender = this.resolveGenderValue(student);
      const nationality = this.resolveNationalityValue(student);
      const firstLanguage = this.resolveFirstLanguageValue(student);
      const currentSchoolCountry = this.resolveCurrentSchoolCountryValue(student);
      const currentSchoolProvince = this.resolveCurrentSchoolProvinceValue(student);
      const currentSchoolCity = this.resolveCurrentSchoolCityValue(student);
      const currentSchoolBoard = this.resolveCurrentSchoolBoardValue(student);
      const currentSchoolExpectedGraduation = this.resolveCurrentSchoolExpectedGraduationValue(student);
      const hasCoreMetadata =
        !!(
          email &&
          phone &&
          currentSchoolCountry &&
          currentSchoolProvince &&
          currentSchoolCity &&
          currentSchoolBoard &&
          currentSchoolExpectedGraduation
        );
      const hasExtendedMetadata =
        !!(
          schoolName &&
          canadaIdentity &&
          gender &&
          nationality &&
          firstLanguage
        );

      if (hasCoreMetadata && (!requiresExtendedMetadata || hasExtendedMetadata)) {
        this.studentContactCache.set(studentId, {
          email,
          phone,
          schoolName,
          canadaIdentity,
          gender,
          nationality,
          firstLanguage,
          currentSchoolCountry,
          currentSchoolProvince,
          currentSchoolCity,
          currentSchoolBoard,
          currentSchoolExpectedGraduation,
        });
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
            this.teacherNoteProfileCache.set(studentId, payload);
            this.teacherNoteCache.set(studentId, this.extractTeacherNoteFromProfile(payload));
            if (
              !metadata.email &&
              !metadata.phone &&
              !metadata.schoolName &&
              !metadata.canadaIdentity &&
              !metadata.gender &&
              !metadata.nationality &&
              !metadata.firstLanguage &&
              !metadata.currentSchoolCountry &&
              !metadata.currentSchoolProvince &&
              !metadata.currentSchoolCity &&
              !metadata.currentSchoolBoard &&
              !metadata.currentSchoolExpectedGraduation
            ) {
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

  private resolveIeltsStatusKey(studentId: number | null): StudentIeltsStatusKey {
    if (!studentId) return 'UNAVAILABLE';

    if (this.ieltsNoRequirement.has(studentId)) return 'NO_IELTS_REQUIRED';
    const cachedStatus = this.ieltsStatusCache.get(studentId);
    if (cachedStatus) return cachedStatus;
    if (this.ieltsStatusLoadInFlight.has(studentId)) return 'LOADING';
    if (this.ieltsStatusUnavailable.has(studentId)) return 'UNAVAILABLE';
    return 'LOADING';
  }

  private prefetchVisibleIeltsStatuses(): void {
    for (const student of this.visibleStudents) {
      const studentId = this.resolveStudentId(student);
      if (!studentId) continue;
      if (
        this.ieltsNoRequirement.has(studentId) ||
        this.ieltsStatusCache.has(studentId) ||
        this.ieltsStatusUnavailable.has(studentId)
      ) {
        continue;
      }
      if (this.ieltsStatusLoadInFlight.has(studentId)) continue;

      this.ieltsStatusLoadInFlight.add(studentId);
      this.ieltsApi
        .getTeacherStudentIeltsSummary(studentId)
        .pipe(
          finalize(() => {
            this.ieltsStatusLoadInFlight.delete(studentId);
          })
        )
        .subscribe({
          next: (payload) => {
            const trackingStatus = this.normalizeIeltsTrackingStatus(payload?.summary?.trackingStatus);
            if (payload?.summary?.shouldShowModule === false) {
              this.ieltsNoRequirement.add(studentId);
              this.ieltsStatusCache.delete(studentId);
              this.ieltsStatusUnavailable.delete(studentId);
            } else if (!trackingStatus) {
              this.ieltsStatusUnavailable.add(studentId);
              this.ieltsNoRequirement.delete(studentId);
            } else {
              this.ieltsStatusCache.set(studentId, trackingStatus);
              this.ieltsNoRequirement.delete(studentId);
              this.ieltsStatusUnavailable.delete(studentId);
            }
            this.cdr.detectChanges();
          },
          error: () => {
            this.ieltsStatusUnavailable.add(studentId);
            this.cdr.detectChanges();
          },
        });
    }
  }

  private normalizeIeltsTrackingStatus(value: unknown): IeltsTrackingStatus | null {
    const normalized = String(value ?? '')
      .trim()
      .toUpperCase();

    if (normalized === 'GREEN_STRICT_PASS') return 'GREEN_STRICT_PASS';
    if (normalized === 'GREEN_COMMON_PASS_WITH_WARNING') return 'GREEN_COMMON_PASS_WITH_WARNING';
    if (normalized === 'YELLOW_NEEDS_PREPARATION') return 'YELLOW_NEEDS_PREPARATION';
    return null;
  }

  private prefetchVisibleTeacherNotes(): void {
    for (const student of this.visibleStudents) {
      const studentId = this.resolveStudentId(student);
      if (!studentId || this.teacherNoteCache.has(studentId)) {
        continue;
      }

      const cachedProfile = this.teacherNoteProfileCache.get(studentId);
      if (cachedProfile) {
        this.teacherNoteCache.set(studentId, this.extractTeacherNoteFromProfile(cachedProfile));
        continue;
      }

      if (this.teacherNoteLoadInFlight.has(studentId)) {
        continue;
      }

      this.teacherNoteLoadInFlight.add(studentId);
      this.studentProfileApi
        .getStudentProfileForTeacher(studentId)
        .pipe(
          finalize(() => {
            this.teacherNoteLoadInFlight.delete(studentId);
          })
        )
        .subscribe({
          next: (payload) => {
            this.teacherNoteProfileCache.set(studentId, payload);
            this.teacherNoteCache.set(studentId, this.extractTeacherNoteFromProfile(payload));
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
    const schoolNode =
      currentSchool['school'] && typeof currentSchool['school'] === 'object'
        ? (currentSchool['school'] as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const schoolAddress =
      currentSchool['address'] && typeof currentSchool['address'] === 'object'
        ? (currentSchool['address'] as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const schoolNodeAddress =
      schoolNode['address'] && typeof schoolNode['address'] === 'object'
        ? (schoolNode['address'] as Record<string, unknown>)
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
      schoolName: this.pickFirstText([
        profileNode['currentSchoolName'],
        profileNode['schoolName'],
        profileNode['school'],
        root['currentSchoolName'],
        root['schoolName'],
        root['school'],
        currentSchool['schoolName'],
        currentSchool['name'],
        schoolNode['schoolName'],
        schoolNode['name'],
      ]),
      canadaIdentity: this.pickFirstText([
        profileNode['identityInCanada'],
        profileNode['statusInCanada'],
        profileNode['canadaIdentity'],
        profileNode['canadianStatus'],
        profileNode['immigrationStatus'],
        profileNode['visaStatus'],
        profileNode['studyPermitStatus'],
        root['identityInCanada'],
        root['statusInCanada'],
        root['canadaIdentity'],
        root['canadianStatus'],
        root['immigrationStatus'],
        root['visaStatus'],
        root['studyPermitStatus'],
      ]),
      gender: this.pickFirstText([
        profileNode['gender'],
        profileNode['sex'],
        root['gender'],
        root['sex'],
      ]),
      nationality: this.pickFirstText([
        profileNode['nationality'],
        profileNode['citizenship'],
        profileNode['countryOfNationality'],
        root['nationality'],
        root['citizenship'],
        root['countryOfNationality'],
      ]),
      firstLanguage: this.pickFirstText([
        profileNode['firstLanguage'],
        profileNode['primaryLanguage'],
        profileNode['nativeLanguage'],
        profileNode['motherTongue'],
        root['firstLanguage'],
        root['primaryLanguage'],
        root['nativeLanguage'],
        root['motherTongue'],
      ]),
      currentSchoolCountry: this.pickFirstText([
        profileNode['currentSchoolCountry'],
        profileNode['schoolCountry'],
        root['currentSchoolCountry'],
        root['schoolCountry'],
        currentSchool['country'],
        schoolNode['country'],
        schoolAddress['country'],
        schoolNodeAddress['country'],
      ]),
      currentSchoolProvince: this.pickFirstText([
        profileNode['currentSchoolProvince'],
        profileNode['schoolProvince'],
        profileNode['province'],
        profileNode['state'],
        profileNode['region'],
        root['currentSchoolProvince'],
        root['schoolProvince'],
        root['province'],
        root['state'],
        root['region'],
        currentSchool['province'],
        currentSchool['state'],
        currentSchool['region'],
        schoolNode['province'],
        schoolNode['state'],
        schoolNode['region'],
        schoolAddress['province'],
        schoolAddress['state'],
        schoolAddress['region'],
        schoolAddress['administrativeArea'],
        schoolNodeAddress['province'],
        schoolNodeAddress['state'],
        schoolNodeAddress['region'],
        schoolNodeAddress['administrativeArea'],
      ]),
      currentSchoolCity: this.pickFirstText([
        profileNode['currentSchoolCity'],
        profileNode['schoolCity'],
        profileNode['city'],
        profileNode['town'],
        profileNode['municipality'],
        root['currentSchoolCity'],
        root['schoolCity'],
        root['city'],
        root['town'],
        root['municipality'],
        currentSchool['city'],
        currentSchool['town'],
        currentSchool['municipality'],
        schoolNode['city'],
        schoolNode['town'],
        schoolNode['municipality'],
        schoolAddress['city'],
        schoolAddress['town'],
        schoolAddress['municipality'],
        schoolAddress['locality'],
        schoolNodeAddress['city'],
        schoolNodeAddress['town'],
        schoolNodeAddress['municipality'],
        schoolNodeAddress['locality'],
      ]),
      currentSchoolBoard: this.pickFirstText([
        profileNode['currentSchoolBoard'],
        profileNode['schoolBoard'],
        profileNode['boardName'],
        profileNode['educationBureau'],
        profileNode['bureau'],
        profileNode['schoolBoardName'],
        profileNode['board'],
        profileNode['district'],
        profileNode['districtName'],
        root['currentSchoolBoard'],
        root['schoolBoard'],
        root['boardName'],
        root['educationBureau'],
        root['bureau'],
        root['schoolBoardName'],
        root['board'],
        root['district'],
        root['districtName'],
        currentSchool['schoolBoard'],
        currentSchool['boardName'],
        currentSchool['educationBureau'],
        currentSchool['bureau'],
        currentSchool['schoolBoardName'],
        currentSchool['board'],
        currentSchool['district'],
        currentSchool['districtName'],
        schoolNode['schoolBoard'],
        schoolNode['boardName'],
        schoolNode['educationBureau'],
        schoolNode['bureau'],
        schoolNode['schoolBoardName'],
        schoolNode['board'],
        schoolNode['district'],
        schoolNode['districtName'],
        schoolAddress['schoolBoard'],
        schoolAddress['boardName'],
        schoolAddress['educationBureau'],
        schoolAddress['bureau'],
        schoolAddress['schoolBoardName'],
        schoolAddress['board'],
        schoolAddress['district'],
        schoolAddress['districtName'],
        schoolNodeAddress['schoolBoard'],
        schoolNodeAddress['boardName'],
        schoolNodeAddress['educationBureau'],
        schoolNodeAddress['bureau'],
        schoolNodeAddress['schoolBoardName'],
        schoolNodeAddress['board'],
        schoolNodeAddress['district'],
        schoolNodeAddress['districtName'],
      ]),
      currentSchoolExpectedGraduation: this.pickFirstText([
        profileNode['currentSchoolExpectedGraduation'],
        profileNode['expectedGraduationTime'],
        profileNode['expectedGraduationDate'],
        profileNode['expectedGraduateDate'],
        profileNode['expectedGraduateTime'],
        profileNode['expectedGraduationAt'],
        profileNode['graduationDate'],
        profileNode['graduationTime'],
        profileNode['graduationAt'],
        root['currentSchoolExpectedGraduation'],
        root['expectedGraduationTime'],
        root['expectedGraduationDate'],
        root['expectedGraduateDate'],
        root['expectedGraduateTime'],
        root['expectedGraduationAt'],
        root['graduationDate'],
        root['graduationTime'],
        root['graduationAt'],
        currentSchool['currentSchoolExpectedGraduation'],
        currentSchool['expectedGraduationTime'],
        currentSchool['expectedGraduationDate'],
        currentSchool['expectedGraduateDate'],
        currentSchool['expectedGraduateTime'],
        currentSchool['expectedGraduationAt'],
        currentSchool['graduationDate'],
        currentSchool['graduationTime'],
        currentSchool['graduationAt'],
        currentSchool['endTime'],
        schoolNode['currentSchoolExpectedGraduation'],
        schoolNode['expectedGraduationTime'],
        schoolNode['expectedGraduationDate'],
        schoolNode['expectedGraduateDate'],
        schoolNode['expectedGraduateTime'],
        schoolNode['expectedGraduationAt'],
        schoolNode['graduationDate'],
        schoolNode['graduationTime'],
        schoolNode['graduationAt'],
        schoolNode['endTime'],
      ]),
    };
  }

  private extractTeacherNoteFromProfile(
    payload: StudentProfilePayload | StudentProfileResponse | null | undefined
  ): string {
    const root =
      payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const profileNode =
      root['profile'] && typeof root['profile'] === 'object'
        ? (root['profile'] as Record<string, unknown>)
        : root;

    return this.pickFirstText([
      profileNode['teacherNote'],
      profileNode['teacherNotes'],
      profileNode['note'],
      profileNode['remark'],
      profileNode['remarks'],
      profileNode['internalNote'],
      root['teacherNote'],
      root['teacherNotes'],
      root['note'],
      root['remark'],
      root['remarks'],
      root['internalNote'],
    ]);
  }

  private buildTeacherProfilePayloadWithNote(
    payload: StudentProfilePayload | StudentProfileResponse | null | undefined,
    noteText: string
  ): StudentProfilePayload {
    const root =
      payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const profileNode =
      root['profile'] && typeof root['profile'] === 'object'
        ? (root['profile'] as Record<string, unknown>)
        : root;
    const normalizedNote = String(noteText ?? '').trim();

    return {
      ...(profileNode as StudentProfilePayload),
      teacherNote: normalizedNote,
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
    if (!this.resolveCurrentSchoolNameValue(student) && metadata.schoolName) {
      student['currentSchoolName'] = metadata.schoolName;
    }
    if (!this.resolveIdentityInCanadaValue(student) && metadata.canadaIdentity) {
      student['canadaIdentity'] = metadata.canadaIdentity;
    }
    if (!this.resolveGenderValue(student) && metadata.gender) {
      student['gender'] = metadata.gender;
    }
    if (!this.resolveNationalityValue(student) && metadata.nationality) {
      student['nationality'] = metadata.nationality;
    }
    if (!this.resolveFirstLanguageValue(student) && metadata.firstLanguage) {
      student['firstLanguage'] = metadata.firstLanguage;
    }
    if (!this.resolveCurrentSchoolCountryValue(student) && metadata.currentSchoolCountry) {
      student['currentSchoolCountry'] = metadata.currentSchoolCountry;
    }
    if (!this.resolveCurrentSchoolProvinceValue(student) && metadata.currentSchoolProvince) {
      student['currentSchoolProvince'] = metadata.currentSchoolProvince;
    }
    if (!this.resolveCurrentSchoolCityValue(student) && metadata.currentSchoolCity) {
      student['currentSchoolCity'] = metadata.currentSchoolCity;
    }
    if (!this.resolveCurrentSchoolBoardValue(student) && metadata.currentSchoolBoard) {
      student['currentSchoolBoard'] = metadata.currentSchoolBoard;
    }
    if (
      !this.resolveCurrentSchoolExpectedGraduationValue(student) &&
      metadata.currentSchoolExpectedGraduation
    ) {
      student['currentSchoolExpectedGraduation'] = metadata.currentSchoolExpectedGraduation;
    }
  }

  private resolveStudentSchoolContext(student: StudentAccount): StudentSchoolContext {
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
    const schoolNode =
      currentSchool['school'] && typeof currentSchool['school'] === 'object'
        ? (currentSchool['school'] as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const schoolAddress =
      currentSchool['address'] && typeof currentSchool['address'] === 'object'
        ? (currentSchool['address'] as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const schoolNodeAddress =
      schoolNode['address'] && typeof schoolNode['address'] === 'object'
        ? (schoolNode['address'] as Record<string, unknown>)
        : ({} as Record<string, unknown>);

    return {
      profileNode,
      currentSchool,
      schoolNode,
      schoolAddress,
      schoolNodeAddress,
    };
  }

  private resolveCurrentSchoolNameValue(student: StudentAccount): string {
    const { profileNode, currentSchool, schoolNode } = this.resolveStudentSchoolContext(student);
    return this.pickFirstText([
      student?.['currentSchoolName'],
      student?.['schoolName'],
      student?.['school'],
      profileNode['currentSchoolName'],
      profileNode['schoolName'],
      profileNode['school'],
      currentSchool['schoolName'],
      currentSchool['name'],
      schoolNode['schoolName'],
      schoolNode['name'],
    ]);
  }

  private resolveIdentityInCanadaValue(student: StudentAccount): string {
    const profile = student?.['profile'] as Record<string, unknown> | undefined;
    return this.pickFirstText([
      student?.['identityInCanada'],
      student?.['statusInCanada'],
      student?.['canadaIdentity'],
      student?.['canadianStatus'],
      student?.['immigrationStatus'],
      student?.['visaStatus'],
      student?.['studyPermitStatus'],
      profile?.['identityInCanada'],
      profile?.['statusInCanada'],
      profile?.['canadaIdentity'],
      profile?.['canadianStatus'],
      profile?.['immigrationStatus'],
      profile?.['visaStatus'],
      profile?.['studyPermitStatus'],
    ]);
  }

  private resolveGenderValue(student: StudentAccount): string {
    const profile = student?.['profile'] as Record<string, unknown> | undefined;
    return this.pickFirstText([
      student?.['gender'],
      student?.['sex'],
      profile?.['gender'],
      profile?.['sex'],
    ]);
  }

  private resolveNationalityValue(student: StudentAccount): string {
    const profile = student?.['profile'] as Record<string, unknown> | undefined;
    return this.pickFirstText([
      student?.['nationality'],
      student?.['citizenship'],
      student?.['countryOfNationality'],
      profile?.['nationality'],
      profile?.['citizenship'],
      profile?.['countryOfNationality'],
    ]);
  }

  private resolveFirstLanguageValue(student: StudentAccount): string {
    const profile = student?.['profile'] as Record<string, unknown> | undefined;
    return this.pickFirstText([
      student?.['firstLanguage'],
      student?.['primaryLanguage'],
      student?.['nativeLanguage'],
      student?.['motherTongue'],
      profile?.['firstLanguage'],
      profile?.['primaryLanguage'],
      profile?.['nativeLanguage'],
      profile?.['motherTongue'],
    ]);
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

  private formatGraduationYearMonth(value: unknown): string {
    const yearMonth = this.resolveGraduationYearMonth(value);
    if (!yearMonth) {
      return '-';
    }

    return `${yearMonth.year}年${yearMonth.month}月`;
  }

  private resolveGraduationYearMonth(
    value: unknown
  ): {
    year: number;
    month: number;
  } | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (value instanceof Date) {
      return this.toValidYearMonth(value.getUTCFullYear(), value.getUTCMonth() + 1);
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      const epochMs = value > 1_000_000_000_000 ? value : value > 1_000_000_000 ? value * 1000 : NaN;
      if (Number.isFinite(epochMs)) {
        const parsedDate = new Date(epochMs);
        if (!Number.isNaN(parsedDate.getTime())) {
          return this.toValidYearMonth(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth() + 1);
        }
      }
    }

    if (value && typeof value === 'object') {
      const node = value as Record<string, unknown>;
      const byParts = this.toValidYearMonth(
        Number(node['year'] ?? node['graduationYear'] ?? node['expectedGraduationYear']),
        Number(node['month'] ?? node['graduationMonth'] ?? node['expectedGraduationMonth'])
      );
      if (byParts) {
        return byParts;
      }

      const nestedDateText = this.pickFirstText([
        node['value'],
        node['date'],
        node['endTime'],
        node['graduationDate'],
        node['expectedGraduationDate'],
      ]);
      if (nestedDateText) {
        return this.resolveGraduationYearMonth(nestedDateText);
      }
    }

    const rawText = String(value ?? '').trim();
    if (!rawText) {
      return null;
    }

    const normalizedText = rawText
      .replace(/年/g, '-')
      .replace(/[月日]/g, '')
      .replace(/[，,]/g, ' ')
      .trim();

    const yearFirstMatch = normalizedText.match(
      /^(\d{4})[-/. ]+(\d{1,2}|[一二三四五六七八九十]{1,3})(?:[-/. ]+\d{1,2})?.*$/
    );
    if (yearFirstMatch) {
      const year = Number(yearFirstMatch[1]);
      const month = this.parseMonthNumber(yearFirstMatch[2]);
      return this.toValidYearMonth(year, month);
    }

    const monthFirstMatch = normalizedText.match(/^(\d{1,2})[-/. ]+(\d{4})$/);
    if (monthFirstMatch) {
      const month = Number(monthFirstMatch[1]);
      const year = Number(monthFirstMatch[2]);
      return this.toValidYearMonth(year, month);
    }

    const parsedEpoch = Date.parse(rawText);
    if (!Number.isNaN(parsedEpoch)) {
      const parsedDate = new Date(parsedEpoch);
      return this.toValidYearMonth(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth() + 1);
    }

    return null;
  }

  private parseMonthNumber(value: unknown): number {
    const rawText = String(value ?? '').trim();
    if (!rawText) {
      return NaN;
    }

    if (/^\d{1,2}$/.test(rawText)) {
      return Number(rawText);
    }

    const normalized = rawText.replace(/\s+/g, '').replace(/月份?$/g, '').replace(/月$/g, '');
    const chineseMonthMap: Record<string, number> = {
      一: 1,
      二: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
      十: 10,
      十一: 11,
      十二: 12,
    };
    return chineseMonthMap[normalized] ?? NaN;
  }

  private toValidYearMonth(
    year: number,
    month: number
  ): {
    year: number;
    month: number;
  } | null {
    const normalizedYear = Number.isFinite(year) ? Math.trunc(year) : NaN;
    const normalizedMonth = Number.isFinite(month) ? Math.trunc(month) : NaN;

    if (!Number.isFinite(normalizedYear) || !Number.isFinite(normalizedMonth)) {
      return null;
    }
    if (normalizedYear < 1900 || normalizedYear > 2999) {
      return null;
    }
    if (normalizedMonth < 1 || normalizedMonth > 12) {
      return null;
    }

    return { year: normalizedYear, month: normalizedMonth };
  }

  private toGraduationSeasonTag(
    yearMonth:
      | {
          year: number;
          month: number;
        }
      | null
  ): string {
    if (!yearMonth) {
      return '';
    }

    const season = yearMonth.month >= 7 ? 'Fall' : 'Winter';
    return `${yearMonth.year} ${season}`;
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
      normalizedKey === 'n a 尚未填写' ||
      normalizedKey === 'n a 未填写'
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
      return 'China (mainland)';
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
      return 'United States';
    }

    const matched = this.countryFilterOptions.find(
      (option) => this.normalizeCountryKey(option) === normalizedKey
    );
    return matched || rawText;
  }

  private resolveProvinceFilterCountry(value: unknown): ProvinceFilterCountry | '' {
    const normalized = this.normalizeCountryFilterValue(value);
    if (
      normalized === 'Canada' ||
      normalized === 'China (mainland)' ||
      normalized === 'United States'
    ) {
      return normalized;
    }
    return '';
  }

  private resolveProvinceFilterSelection(
    value: unknown,
    country: ProvinceFilterCountry | '' = ''
  ): StudentProvinceFilter {
    const normalized = this.normalizeProvinceFilterValue(value, country);
    return normalized || '';
  }

  private normalizeProvinceFilterValue(
    value: unknown,
    country: ProvinceFilterCountry | ''
  ): StudentProvinceFilter | '' {
    const rawText = String(value ?? '').trim();
    if (!rawText) {
      return '';
    }

    const normalizedKey = this.normalizeCountryKey(rawText);
    if (!normalizedKey) {
      return '';
    }

    if (country) {
      const alias = PROVINCE_FILTER_ALIASES_BY_COUNTRY[country]?.[normalizedKey];
      if (alias) {
        return alias;
      }

      const matched = PROVINCE_FILTER_OPTIONS_BY_COUNTRY[country].find(
        (option) => this.normalizeCountryKey(option) === normalizedKey
      );
      return matched || rawText;
    }

    for (const supportedCountry of PROVINCE_FILTER_COUNTRIES) {
      const alias = PROVINCE_FILTER_ALIASES_BY_COUNTRY[supportedCountry]?.[normalizedKey];
      if (alias) {
        return alias;
      }
    }

    for (const supportedCountry of PROVINCE_FILTER_COUNTRIES) {
      const matched = PROVINCE_FILTER_OPTIONS_BY_COUNTRY[supportedCountry].find(
        (option) => this.normalizeCountryKey(option) === normalizedKey
      );
      if (matched) {
        return matched;
      }
    }

    return rawText;
  }

  private resolveCityFilterSelection(value: unknown, country: ProvinceFilterCountry | '' = ''): string {
    const normalized = this.normalizeCityFilterValue(value, country);
    return normalized || '';
  }

  private normalizeCityFilterValue(value: unknown, country: ProvinceFilterCountry | ''): string {
    const rawText = String(value ?? '').trim();
    if (!rawText) {
      return '';
    }

    const normalizedKey = this.normalizeCountryKey(rawText);
    if (!normalizedKey) {
      return '';
    }

    if (country) {
      const matched = CITY_FILTER_OPTIONS_BY_COUNTRY[country].find(
        (option) => this.normalizeCountryKey(option) === normalizedKey
      );
      return matched || rawText;
    }

    for (const supportedCountry of PROVINCE_FILTER_COUNTRIES) {
      const matched = CITY_FILTER_OPTIONS_BY_COUNTRY[supportedCountry].find(
        (option) => this.normalizeCountryKey(option) === normalizedKey
      );
      if (matched) {
        return matched;
      }
    }

    return rawText;
  }

  private resolveSchoolBoardFilterSelection(value: unknown): string {
    const normalized = this.normalizeSchoolBoardFilterValue(value);
    return normalized || '';
  }

  private normalizeSchoolBoardFilterValue(value: unknown): string {
    const rawText = String(value ?? '').trim();
    if (!rawText) {
      return '';
    }

    const normalizedKey = this.normalizeCountryKey(rawText);
    if (!normalizedKey) {
      return '';
    }

    const matched = this.schoolBoardFilterOptions.find(
      (option) => this.normalizeCountryKey(option) === normalizedKey
    );
    return matched || rawText;
  }

  private resolveGraduationSeasonFilterSelection(value: unknown): string {
    const normalized = this.normalizeGraduationSeasonFilterValue(value);
    if (!normalized) {
      return '';
    }

    const matched = this.graduationSeasonFilterOptions.find(
      (option) => this.normalizeGraduationSeasonFilterValue(option) === normalized
    );
    return matched || normalized;
  }

  private normalizeGraduationSeasonFilterValue(value: unknown): string {
    const rawText = String(value ?? '').trim();
    if (!rawText) {
      return '';
    }

    const normalizedKey = this.normalizeCountryKey(rawText);
    if (!normalizedKey) {
      return '';
    }

    const yearFirst = normalizedKey.match(/^(\d{4})\s+([a-z\u4e00-\u9fff]+)$/);
    if (yearFirst) {
      const year = Number(yearFirst[1]);
      const season = this.resolveGraduationSeasonName(yearFirst[2]);
      if (season) {
        return `${year} ${season}`;
      }
    }

    const seasonFirst = normalizedKey.match(/^([a-z\u4e00-\u9fff]+)\s+(\d{4})$/);
    if (seasonFirst) {
      const season = this.resolveGraduationSeasonName(seasonFirst[1]);
      const year = Number(seasonFirst[2]);
      if (season) {
        return `${year} ${season}`;
      }
    }

    const compactText = rawText
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '')
      .trim();
    const compactMatch = compactText.match(/^(\d{4})(fall|autumn|winter|f|w|秋|秋季|冬|冬季)$/);
    if (compactMatch) {
      const year = Number(compactMatch[1]);
      const season = this.resolveGraduationSeasonName(compactMatch[2]);
      if (season) {
        return `${year} ${season}`;
      }
    }

    return '';
  }

  private resolveGraduationSeasonName(value: unknown): 'Fall' | 'Winter' | '' {
    const token = String(value ?? '').trim().toLowerCase();
    if (!token) {
      return '';
    }

    if (token === 'fall' || token === 'autumn' || token === 'f' || token === '秋' || token === '秋季') {
      return 'Fall';
    }
    if (token === 'winter' || token === 'w' || token === '冬' || token === '冬季') {
      return 'Winter';
    }

    return '';
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

    append(COUNTRY_FILTER_NA_OPTION);
    append(COUNTRY_FILTER_ALL_OPTION);
    COUNTRY_FILTER_PRIORITY_OPTIONS.forEach(append);
    this.buildRegionCountryFilterOptions().forEach(append);
    COUNTRY_FILTER_FALLBACK_OPTIONS.forEach(append);

    return options;
  }

  private buildSchoolBoardFilterBaseOptions(): string[] {
    return this.mergeFilterOptions([], EDUCATION_BOARD_LIBRARY_OPTIONS);
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
