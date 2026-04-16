import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { throwError } from 'rxjs';
import { catchError, finalize, switchMap } from 'rxjs/operators';

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
import { OssltTrackingService } from '../../services/osslt-tracking.service';
import {
  VolunteerTrackingService,
  type VolunteerTrackingBatchSummaryItemVm,
} from '../../services/volunteer-tracking.service';
import { TeacherPreferenceService } from '../../services/teacher-preference.service';
import { deriveStudentIeltsModuleState } from '../../features/ielts/ielts-derive';
import {
  IeltsRecordFormValue,
  LanguageCourseStatus,
  IeltsTrackingStatus,
  LanguageTrackingStatus,
  StudentIeltsModuleState,
  UpdateStudentIeltsPayload,
} from '../../features/ielts/ielts-types';
import {
  IeltsStatusDisplayModel,
  resolveIeltsStatusDisplay,
} from '../../features/ielts/ielts-status-display';
import {
  LanguageTrackingStatusDisplay,
  resolveLanguageTrackingStatusDisplay,
} from '../../features/ielts/language-tracking-display';
import { deriveStudentOssltSummary } from '../../features/osslt/osslt-derive';
import { resolveOssltStatusDisplay } from '../../features/osslt/osslt-status-display';
import { OssltResult, OssltTrackingStatus, StudentOssltModuleState } from '../../features/osslt/osslt-types';
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
import {
  STUDENT_LIST_DEFAULT_COLUMN_KEYS_BY_CONTEXT,
  type StudentListColumnKey,
  type StudentManagementPageContext,
  type StudentSelectorFilterFieldKey,
} from '../../shared/student-fields/student-field-presets';
import { StudentFilterFieldsComponent } from '../../shared/student-filter-fields/student-filter-fields.component';

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
type TrackingManualStatusOption = LanguageTrackingStatus | OssltTrackingStatus;

interface StudentListMetadata {
  email: string;
  phone: string;
  schoolName: string;
  canadaIdentity: string;
  gender: string;
  nationality: string;
  firstLanguage: string;
  motherLanguage: string;
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

interface StudentListColumnPreferenceVm {
  visibleColumnKeys?: string[];
  orderedColumnKeys?: string[];
}

interface StudentListFilterPreferenceVm {
  listLimit?: number;
  showInactive?: boolean;
  searchKeyword?: string;
  countryFilterInput?: string;
  countryFilter?: string;
  provinceFilterInput?: string;
  provinceFilter?: string;
  cityFilterInput?: string;
  cityFilter?: string;
  schoolBoardFilterInput?: string;
  schoolBoardFilter?: string;
  graduationSeasonFilterInput?: string;
  graduationSeasonFilter?: string;
  languageScoreFilter?: string;
  languageScoreTrackingFilter?: string;
  languageCourseStatusFilter?: string;
  ossltResultFilter?: string;
  ossltTrackingFilter?: string;
  volunteerCompletedFilter?: boolean;
}

const STUDENT_LIST_COLUMN_PREFERENCE_STORAGE_KEY_PREFIX =
  'student-management.student-list.visible-columns';
const STUDENT_LIST_COLUMN_PREFERENCE_PAGE_KEY_BY_CONTEXT: Record<
  StudentManagementPageContext,
  string
> = {
  students: 'student-management.list-columns',
  ielts: 'ielts-tracking.list-columns',
  osslt: 'osslt-tracking.list-columns',
  volunteer: 'volunteer-tracking.list-columns',
};

const PAGE_TITLE_BY_CONTEXT: Record<StudentManagementPageContext, string> = {
  students: '\u5b66\u751f\u8d26\u53f7\u7ba1\u7406',
  ielts: '\u8bed\u8a00\u6210\u7ee9\u8ddf\u8e2a',
  osslt: 'OSSLT \u8ddf\u8e2a',
  volunteer: '\u4e49\u5de5\u8ddf\u8e2a',
};

const STUDENT_LIST_COLUMN_LABEL_BY_KEY: Record<StudentListColumnKey, string> = {
  name: '\u59d3\u540d',
  email: '\u90ae\u7bb1',
  phone: '\u7535\u8bdd',
  graduation: '\u6bd5\u4e1a\u65f6\u95f4',
  schoolName: '\u5b66\u6821\u540d',
  canadaIdentity: '\u5728\u52a0\u62ff\u5927\u7684\u8eab\u4efd',
  gender: '\u6027\u522b',
  nationality: '\u56fd\u7c4d',
  firstLanguage: '\u7b2c\u4e00\u8bed\u8a00',
  motherLanguage: '\u6bcd\u8bed',
  schoolBoard: '\u6240\u5c5e\u6559\u80b2\u5c40\uff08\u5728\u8bfb\u5b66\u6821\uff09',
  country: '\u56fd\u5bb6',
  province: '\u7701\u4efd',
  city: '\u57ce\u5e02\uff08\u5728\u8bfb\u5b66\u6821\uff09',
  serviceItems: '\u670d\u52a1\u9879\u76ee',
  teacherNote: '\u8001\u5e08\u5907\u6ce8\uff08\u5b66\u751f\u4e0d\u53ef\u89c1\uff09',
  profile: '\u6863\u6848',
  ielts: '\u8bed\u8a00\u6210\u7ee9',
  languageTracking: '\u8bed\u8a00\u6210\u7ee9\u8ddf\u8e2a',
  languageCourseStatus: '\u8bed\u8a00\u62a5\u8bfe\u60c5\u51b5',
  ossltResult: 'OSSLT \u6210\u7ee9',
  ossltTracking: 'OSSLT \u8ddf\u8fdb\u72b6\u6001',
  volunteerTracking: '\u4e49\u5de5\u8ddf\u8e2a',
  resetPassword: '\u91cd\u7f6e\u5bc6\u7801',
  archive: '\u5f52\u6863',
  status: '\u5f52\u6863\u72b6\u6001',
  selectable: '\u53ef\u9009\u62e9',
};

const SERVICE_ITEM_OPTIONS = [
  '面试辅导',
  '雅思A类全科班',
  'SAT全科班',
  '数学竞赛类班课',
  '3U&4U阅写及文学素养',
  '雅思VIP 20小时包',
  '雅思VIP 50小时包',
  '学科VIP 20小时包',
  '学科VIP 50小时包',
  'AP/IB/数学竞赛VIP 50小时包',
  '一对一辅导',
] as const;

const STUDENT_LIST_COLUMN_PREFERENCE_VERSION = 'v10';
const STUDENT_LIST_COLUMN_VISIBILITY_OVERRIDE_STORAGE_KEY_PREFIX =
  'student-management.student-list.column-override';
const STUDENT_LIST_FILTER_PREFERENCE_STORAGE_KEY_PREFIX =
  'student-management.student-list.filters';
const STUDENT_LIST_FILTER_PREFERENCE_VERSION = 'v1';

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
    key: 'serviceItems',
    label: '服务项目',
    defaultVisible: true,
    hideable: true,
    backendDependent: true,
    headerStyle: 'text-align:left;padding:6px 8px;border-bottom:1px solid #e5e5e5;min-width:88px;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;vertical-align:top;position:relative;',
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
    key: 'motherLanguage',
    label: '母语',
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
    label: '语言成绩',
    defaultVisible: false,
    hideable: true,
    backendDependent: true,
    headerStyle:
      'text-align:center;padding:6px 8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;width:180px;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:center;vertical-align:middle;',
  },
  {
    key: 'languageTracking',
    label: '跟进状态',
    defaultVisible: true,
    hideable: true,
    backendDependent: true,
    headerStyle:
      'text-align:center;padding:6px 8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;width:220px;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:center;vertical-align:middle;',
  },
  {
    key: 'languageCourseStatus',
    label: '语言报课情况',
    defaultVisible: false,
    hideable: true,
    backendDependent: true,
    headerStyle:
      'text-align:center;padding:6px 8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;width:220px;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:center;vertical-align:middle;',
  },
  {
    key: 'ossltResult',
    label: 'OSSLT 成绩',
    defaultVisible: false,
    hideable: true,
    backendDependent: true,
    headerStyle:
      'text-align:center;padding:6px 8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;width:180px;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:center;vertical-align:middle;',
  },
  {
    key: 'ossltTracking',
    label: 'OSSLT 跟进状态',
    defaultVisible: false,
    hideable: true,
    backendDependent: true,
    headerStyle:
      'text-align:center;padding:6px 8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;width:220px;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:center;vertical-align:middle;',
  },
  {
    key: 'volunteerTracking',
    label: '义工跟踪',
    defaultVisible: false,
    hideable: true,
    backendDependent: false,
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
  {
    key: 'status',
    label: '归档状态',
    defaultVisible: false,
    hideable: true,
    backendDependent: false,
    headerStyle:
      'text-align:center;padding:6px 8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;width:120px;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:center;vertical-align:middle;',
  },
  {
    key: 'selectable',
    label: '可选择',
    defaultVisible: false,
    hideable: true,
    backendDependent: false,
    headerStyle:
      'text-align:center;padding:6px 8px;border-bottom:1px solid #e5e5e5;white-space:nowrap;width:120px;',
    cellStyle: 'padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:center;vertical-align:middle;',
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
  imports: [CommonModule, FormsModule, RouterModule, StudentFilterFieldsComponent],
  template: `
    <div style="max-width:1320px;margin:56px auto 40px;font-family:Arial">
      <div class="student-page-header" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <h2 style="margin:0;">{{ resolvedPageTitle }}</h2>
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
            {{ showInactive ? '隐藏已' : '显示已' }}
          </button>

          <app-student-filter-fields
            [idPrefix]="'student-management-filters'"
            [disabled]="loadingList"
            [filterFields]="studentManagementCommonFilterFields"
            [countryFilterOptions]="countryFilterOptions"
            [provinceFilterOptions]="provinceFilterOptions"
            [cityFilterOptions]="cityFilterOptions"
            [schoolBoardFilterOptions]="schoolBoardFilterOptions"
            [graduationSeasonFilterOptions]="graduationSeasonFilterOptions"
            [countryFilterInput]="countryFilterInput"
            [provinceFilterInput]="provinceFilterInput"
            [cityFilterInput]="cityFilterInput"
            [schoolBoardFilterInput]="schoolBoardFilterInput"
            [graduationSeasonFilterInput]="graduationSeasonFilterInput"
            [volunteerCompletedFilter]="volunteerCompletedFilter"
            [volunteerCompletedDisabled]="!volunteerCompletedFilterAvailable"
            [volunteerCompletedTitle]="
              volunteerCompletedFilterAvailable
                ? null
                : (volunteerCompletedFilterError || 'Volunteer completed filter data unavailable')
            "
            [studentKeyword]="searchKeyword"
            [keywordPlaceholder]="'按 ID、姓名、邮箱、电话、毕业季搜索'"
            (countryFilterInputChange)="onCountryFilterInputChange($event)"
            (provinceFilterInputChange)="onProvinceFilterInputChange($event)"
            (cityFilterInputChange)="onCityFilterInputChange($event)"
            (schoolBoardFilterInputChange)="onSchoolBoardFilterInputChange($event)"
            (graduationSeasonFilterInputChange)="onGraduationSeasonFilterInputChange($event)"
            (volunteerCompletedFilterChange)="onVolunteerCompletedFilterChange($event)"
            (studentKeywordChange)="onSearchKeywordChange($event)"
          ></app-student-filter-fields>

          <label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#444;">
            &#35821;&#35328;&#25104;&#32489;
            <select
              [(ngModel)]="languageScoreFilter"
              (ngModelChange)="applyListView()"
              [disabled]="loadingList"
              style="padding:4px 6px;min-width:220px;"
            >
              <option [ngValue]="''">All</option>
              <option *ngFor="let status of languageScoreStatusOptions" [ngValue]="status">
                {{ resolveLanguageScoreFilterOptionLabel(status) }}
              </option>
            </select>
          </label>

          <label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#444;">
            &#35821;&#35328;&#25104;&#32489;&#36319;&#36394;
            <select
              [(ngModel)]="languageScoreTrackingFilter"
              (ngModelChange)="applyListView()"
              [disabled]="loadingList"
              style="padding:4px 6px;min-width:220px;"
            >
              <option [ngValue]="''">All</option>
              <option *ngFor="let status of languageScoreTrackingStatusOptions" [ngValue]="status">
                {{ resolveLanguageTrackingStatusOptionLabel(status) }}
              </option>
            </select>
          </label>

          <label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#444;">
            语言报课情况
            <select
              [(ngModel)]="languageCourseStatusFilter"
              (ngModelChange)="applyListView()"
              [disabled]="loadingList"
              style="padding:4px 6px;min-width:240px;"
            >
              <option [ngValue]="''">All</option>
              <option *ngFor="let status of languageCourseStatusOptions" [ngValue]="status">
                {{ resolveLanguageCourseStatusLabel(status) }}
              </option>
            </select>
          </label>

          <label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#444;">
            OSSLT &#25104;&#32489;
            <select
              [(ngModel)]="ossltResultFilter"
              (ngModelChange)="applyListView()"
              [disabled]="loadingList"
              style="padding:4px 6px;min-width:180px;"
            >
              <option [ngValue]="''">All</option>
              <option *ngFor="let result of ossltResultStatusOptions" [ngValue]="result">
                {{ resolveOssltResultFilterOptionLabel(result) }}
              </option>
            </select>
          </label>

          <label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#444;">
            OSSLT &#36319;&#36827;&#29366;&#24577;
            <select
              [(ngModel)]="ossltTrackingFilter"
              (ngModelChange)="applyListView()"
              [disabled]="loadingList"
              style="padding:4px 6px;min-width:220px;"
            >
              <option [ngValue]="''">All</option>
              <option *ngFor="let status of ossltTrackingStatusOptions" [ngValue]="status">
                {{ resolveOssltTrackingStatusOptionLabel(status) }}
              </option>
            </select>
          </label>

          <span
            *ngIf="!volunteerCompletedFilterAvailable && volunteerCompletedFilterError"
            style="font-size:12px;color:#b00020;"
          >
            {{ volunteerCompletedFilterError }}
          </span>

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
            <span>{{ resolveUnifiedStudentListColumnLabel(column) }}</span>
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

      <div class="student-list-table-wrap">
        <table class="student-list-table">
          <thead style="background:#f6f7fb;">
            <tr *ngIf="visibleColumns.length > 0">
              <th
                *ngFor="let column of visibleColumns; trackBy: trackColumn"
                [attr.style]="column.headerStyle"
                class="draggable-column-header"
                [class.draggable-enabled]="canDragColumnHeaders()"
                [draggable]="canDragColumnHeaders()"
                (dragstart)="onColumnHeaderDragStart(column.key, $event)"
                (dragover)="onColumnHeaderDragOver($event)"
                (drop)="onColumnHeaderDrop(column.key, $event)"
                (dragend)="onColumnHeaderDragEnd()"
              >
                {{ resolveUnifiedStudentListColumnLabel(column) }}
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

                  <ng-container *ngSwitchCase="'serviceItems'">
                    <div class="service-items-container" style="position:relative;display:inline-grid;gap:6px;min-width:0;width:auto;justify-items:start;">
                      <button
                        type="button"
                        (click)="toggleServiceItemsPanel(student, $event); $event.stopPropagation()"
                        [attr.data-service-items-trigger-id]="resolveStudentId(student) || null"
                        [disabled]="
                          !resolveStudentId(student) ||
                          isServiceItemsLoading(student) ||
                          isServiceItemsSaving(student)
                        "
                        [attr.title]="resolveServiceItemsPanelTitle(student)"
                        style="display:inline-flex;align-items:center;justify-content:center;gap:2px;padding:3px 6px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;color:#1f2f47;font-weight:600;font-size:12px;line-height:1.1;white-space:nowrap;"
                      >
                        {{ resolveServiceItemsCountLabel(student) }}
                      </button>
                      <small *ngIf="isServiceItemsLoading(student)" style="color:#7f8a9e;">
                        加载中...
                      </small>
                      <small *ngIf="isServiceItemsSaving(student)" style="color:#7f8a9e;">
                        保存中...
                      </small>
                    </div>
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
                      [style.borderColor]="resolveIeltsStatusBorderColor(student)"
                      [disabled]="!resolveStudentId(student)"
                    >
                      {{ resolveIeltsStatusLabel(student) }}
                    </button>
                  </ng-container>

                  <ng-container *ngSwitchCase="'ossltResult'">
                    <button
                      type="button"
                      [routerLink]="ossltRoute(student)"
                      style="min-width:150px;white-space:nowrap;padding:6px 10px;border-radius:999px;border:1px solid;font-weight:600;"
                      [style.background]="resolveOssltResultStatusBackground(student)"
                      [style.color]="resolveOssltResultStatusTextColor(student)"
                      [style.borderColor]="resolveOssltResultStatusBorderColor(student)"
                      [disabled]="!resolveStudentId(student)"
                    >
                      {{ resolveOssltResultStatusLabel(student) }}
                    </button>
                  </ng-container>

                  <ng-container *ngSwitchCase="'languageTracking'">
                    <select
                      [ngModel]="resolveLanguageTrackingStatusSelection(student)"
                      (ngModelChange)="onLanguageTrackingStatusSelectionChange(student, $event)"
                      style="min-width:200px;padding:6px 8px;border-radius:8px;border:1px solid #ced7ea;background:#fff;font-weight:600;"
                      [style.background]="resolveLanguageTrackingStatusBackground(student)"
                      [style.color]="resolveLanguageTrackingStatusTextColor(student)"
                      [style.borderColor]="resolveLanguageTrackingStatusBorderColor(student)"
                      [disabled]="
                        !resolveStudentId(student) ||
                        isLanguageTrackingStatusLoading(student) ||
                        isLanguageTrackingStatusUnavailable(student) ||
                        isLanguageTrackingStatusSaving(student)
                      "
                    >
                      <option
                        *ngIf="isLanguageTrackingStatusLoading(student)"
                        [ngValue]="''"
                      >
                        Loading...
                      </option>
                      <option
                        *ngIf="isLanguageTrackingStatusUnavailable(student)"
                        [ngValue]="''"
                      >
                        Unavailable
                      </option>
                      <option
                        *ngFor="let status of languageScoreTrackingStatusOptions"
                        [ngValue]="status"
                      >
                        {{ resolveLanguageTrackingStatusOptionLabel(status) }}
                      </option>
                    </select>
                  </ng-container>

                  <ng-container *ngSwitchCase="'languageCourseStatus'">
                    <select
                      [ngModel]="resolveLanguageCourseStatusSelection(student)"
                      (ngModelChange)="onLanguageCourseStatusSelectionChange(student, $event)"
                      style="min-width:240px;padding:6px 8px;border-radius:8px;border:1px solid #ced7ea;background:#fff;"
                      [disabled]="!resolveStudentId(student) || isLanguageCourseStatusSaving(student)"
                    >
                      <option [ngValue]="''">待更新</option>
                      <option
                        *ngFor="let status of languageCourseStatusOptions"
                        [ngValue]="status"
                      >
                        {{ resolveLanguageCourseStatusLabel(status) }}
                      </option>
                    </select>
                  </ng-container>

                  <ng-container *ngSwitchCase="'ossltTracking'">
                    <select
                      [ngModel]="resolveOssltTrackingStatusSelection(student)"
                      (ngModelChange)="onOssltTrackingStatusSelectionChangePublic(student, $event)"
                      style="min-width:200px;padding:6px 8px;border-radius:8px;border:1px solid #ced7ea;background:#fff;font-weight:600;"
                      [style.background]="resolveOssltTrackingStatusBackground(student)"
                      [style.color]="resolveOssltTrackingStatusTextColor(student)"
                      [style.borderColor]="resolveOssltTrackingStatusBorderColor(student)"
                      [disabled]="
                        !resolveStudentId(student) ||
                        isOssltTrackingStatusLoading(student) ||
                        isOssltTrackingStatusUnavailable(student) ||
                        isOssltTrackingStatusSaving(student)
                      "
                    >
                      <option
                        *ngIf="isOssltTrackingStatusLoading(student)"
                        [ngValue]="''"
                      >
                        Loading...
                      </option>
                      <option
                        *ngIf="isOssltTrackingStatusUnavailable(student)"
                        [ngValue]="''"
                      >
                        Unavailable
                      </option>
                      <option
                        *ngFor="let status of ossltTrackingStatusOptions"
                        [ngValue]="status"
                      >
                        {{ resolveOssltTrackingStatusOptionLabel(status) }}
                      </option>
                    </select>
                  </ng-container>

                  <ng-container *ngSwitchCase="'volunteerTracking'">
                    <button
                      type="button"
                      [routerLink]="volunteerRoute(student)"
                      style="min-width:150px;white-space:nowrap;padding:6px 10px;border-radius:999px;border:1px solid;font-weight:600;"
                      [style.background]="resolveVolunteerHoursBackground(student)"
                      [style.color]="resolveVolunteerHoursTextColor(student)"
                      [style.borderColor]="resolveVolunteerHoursBorderColor(student)"
                      [disabled]="!resolveStudentId(student)"
                    >
                      {{ resolveVolunteerHoursBadgeLabel(student) }}
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

      <ng-container *ngIf="resolveServiceItemsPanelStudent() as serviceItemsPanelStudent">
        <div
          class="service-items-container service-items-overlay"
          (click)="$event.stopPropagation()"
          style="position:fixed;z-index:2300;width:156px;max-width:min(156px,calc(100vw - 48px));max-height:min(360px,calc(100vh - 24px));overflow-y:auto;padding:12px;border:1px solid #d8e1ee;border-radius:12px;background:#fff;box-shadow:0 14px 28px rgba(15,23,42,0.16);display:grid;gap:10px;"
          [style.top.px]="serviceItemsPanelTop"
          [style.bottom.px]="serviceItemsPanelBottom"
          [style.left.px]="serviceItemsPanelLeft"
        >
          <div
            style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;color:#52607a;"
          >
            <span>逐项勾选服务项目</span>
            <button
              type="button"
              (click)="toggleServiceItemsPanel(serviceItemsPanelStudent)"
              style="border:none;background:transparent;color:#7f8a9e;padding:0;font-size:12px;cursor:pointer;"
            >
              收起
            </button>
          </div>
          <div
            style="display:grid;grid-template-columns:minmax(0,1fr);gap:8px;"
          >
            <label
              *ngFor="let option of serviceItemOptions"
              style="display:flex;align-items:flex-start;gap:6px;font-size:12px;line-height:1.4;font-weight:400;"
              (click)="$event.stopPropagation()"
            >
              <input
                type="checkbox"
                [ngModel]="isServiceItemSelectedForStudent(serviceItemsPanelStudent, option)"
                (ngModelChange)="onServiceItemSelectionChange(serviceItemsPanelStudent, option, $event)"
                [disabled]="
                  !resolveStudentId(serviceItemsPanelStudent) ||
                  isServiceItemsLoading(serviceItemsPanelStudent) ||
                  isServiceItemsSaving(serviceItemsPanelStudent)
                "
              />
              <span>{{ option }}</span>
            </label>
          </div>
        </div>
      </ng-container>

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

      .student-list-table-wrap {
        margin-top: 12px;
        border: 1px solid #e5e5e5;
        border-radius: 10px;
        overflow-x: auto;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
      }

      .student-list-table {
        width: max-content;
        min-width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        table-layout: auto;
      }

      .student-list-table th,
      .student-list-table td {
        white-space: nowrap;
      }

      .student-list-table th.draggable-column-header.draggable-enabled {
        cursor: move;
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
  readonly serviceItemOptions: readonly string[] = SERVICE_ITEM_OPTIONS;
  readonly studentListColumns: readonly StudentListColumnConfig[] = STUDENT_LIST_COLUMNS;
  private readonly studentListColumnConfigByKey = new Map<StudentListColumnKey, StudentListColumnConfig>(
    this.studentListColumns.map((column) => [column.key, column])
  );
  readonly languageScoreStatusOptions: readonly IeltsTrackingStatus[] = [
    'GREEN_STRICT_PASS',
    'GREEN_COMMON_PASS_WITH_WARNING',
    'YELLOW_NEEDS_PREPARATION',
  ];
  readonly languageScoreTrackingStatusOptions: readonly LanguageTrackingStatus[] = [
    'TEACHER_REVIEW_APPROVED',
    'AUTO_PASS_ALL_SCHOOLS',
    'AUTO_PASS_PARTIAL_SCHOOLS',
    'NEEDS_TRACKING',
  ];
  readonly languageCourseStatusOptions: readonly LanguageCourseStatus[] = [
    'NOT_RECEIVED_TRAINING',
    'ENROLLED_GLOBAL_IELTS',
    'ENROLLED_OTHER_IELTS',
    'COURSE_COMPLETED_NOT_EXAMINED',
    'EXAM_REGISTERED',
    'SCORE_RELEASED',
  ];
  readonly ossltResultStatusOptions: readonly OssltResult[] = ['PASS', 'FAIL', 'UNKNOWN'];
  readonly ossltTrackingStatusOptions: readonly OssltTrackingStatus[] = [
    'WAITING_UPDATE',
    'NEEDS_TRACKING',
    'PASSED',
  ];
  readonly studentManagementCommonFilterFields: readonly StudentSelectorFilterFieldKey[] = [
    'country',
    'province',
    'city',
    'schoolBoard',
    'graduationSeason',
    'volunteerCompleted',
    'keyword',
  ];
  students: StudentAccount[] = [];
  visibleStudents: StudentAccount[] = [];
  visibleColumnKeys = new Set<StudentListColumnKey>(
    this.studentListColumns
      .filter((column) => column.defaultVisible || !column.hideable)
      .map((column) => column.key)
  );
  columnOrderKeys: StudentListColumnKey[] = this.studentListColumns.map((column) => column.key);
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
  languageScoreFilter: IeltsTrackingStatus | '' = '';
  languageScoreTrackingFilter: LanguageTrackingStatus | '' = '';
  languageCourseStatusFilter: LanguageCourseStatus | '' = '';
  ossltResultFilter: OssltResult | '' = '';
  ossltTrackingFilter: OssltTrackingStatus | '' = '';
  volunteerCompletedFilter = false;
  volunteerCompletedFilterAvailable = true;
  volunteerCompletedFilterError = '';
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
  serviceItemsPanelStudentId: number | null = null;
  serviceItemsPanelTop: number | null = null;
  serviceItemsPanelBottom: number | null = null;
  serviceItemsPanelLeft = 12;
  private readonly studentContactCache = new Map<number, StudentListMetadata>();
  private readonly studentContactLoadInFlight = new Set<number>();
  private readonly teacherNoteCache = new Map<number, string>();
  private readonly serviceItemsCache = new Map<number, string[]>();
  private readonly studentProfileLoadInFlight = new Set<number>();
  private readonly ieltsStatusCache = new Map<number, IeltsTrackingStatus>();
  private readonly languageTrackingStatusCache = new Map<number, LanguageTrackingStatus>();
  private readonly languageCourseStatusCache = new Map<number, LanguageCourseStatus>();
  private readonly ieltsStatusColorTokenCache = new Map<number, string>();
  private readonly ieltsStatusLoadInFlight = new Set<number>();
  private readonly ieltsNoRequirement = new Set<number>();
  private readonly ieltsStatusUnavailable = new Set<number>();
  private readonly languageTrackingStatusSaveInFlight = new Set<number>();
  private readonly languageCourseStatusSaveInFlight = new Set<number>();
  private readonly ossltResultCache = new Map<number, OssltResult>();
  private readonly ossltTrackingStatusCache = new Map<number, OssltTrackingStatus>();
  private readonly ossltStatusLoadInFlight = new Set<number>();
  private readonly ossltStatusUnavailable = new Set<number>();
  private readonly ossltTrackingStatusSaveInFlight = new Set<number>();
  private readonly volunteerHoursCache = new Map<number, number>();
  private readonly volunteerCompletedCache = new Map<number, boolean>();
  private readonly volunteerHoursLoadInFlight = new Set<number>();
  private readonly volunteerHoursUnavailable = new Set<number>();
  private readonly serviceItemsSaveInFlight = new Set<number>();
  private readonly studentProfileCache = new Map<
    number,
    StudentProfilePayload | StudentProfileResponse
  >();
  private draggingColumnKey: StudentListColumnKey | null = null;
  private teacherNoteAutoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private statusFilterReapplyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private studentApi: StudentManagementService,
    private studentProfileApi: StudentProfileService,
    private inviteApi: StudentInviteService,
    private auth: AuthService,
    private router: Router,
    private ieltsApi: IeltsTrackingService,
    private ossltApi: OssltTrackingService,
    private volunteerApi: VolunteerTrackingService,
    private teacherPreferenceApi: TeacherPreferenceService,
    private cdr: ChangeDetectorRef = { detectChanges: () => {} } as ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeVisibleColumns();
    this.initializeListControlsFromPreference();
    this.loadVisibleColumnsPreferenceFromServer();
    this.loadStudents();
  }

  trackStudent = (_index: number, student: StudentAccount): string | number => {
    return this.resolveStudentId(student) ?? student.username;
  };

  trackColumn = (_index: number, column: StudentListColumnConfig): StudentListColumnKey => {
    return column.key;
  };

  canDragColumnHeaders(): boolean {
    return !this.loadingList && this.visibleColumns.length > 1;
  }

  onColumnHeaderDragStart(columnKey: StudentListColumnKey, event: DragEvent): void {
    if (!this.canDragColumnHeaders()) {
      event.preventDefault();
      return;
    }
    this.draggingColumnKey = columnKey;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', columnKey);
    }
  }

  onColumnHeaderDragOver(event: DragEvent): void {
    if (!this.draggingColumnKey) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onColumnHeaderDrop(targetColumnKey: StudentListColumnKey, event: DragEvent): void {
    event.preventDefault();
    const sourceColumnKey =
      this.draggingColumnKey || (event.dataTransfer?.getData('text/plain') as StudentListColumnKey);
    this.draggingColumnKey = null;
    if (!sourceColumnKey || sourceColumnKey === targetColumnKey) return;

    const orderedVisibleColumnKeys = this.visibleColumns.map((column) => column.key);
    const sourceIndex = orderedVisibleColumnKeys.indexOf(sourceColumnKey);
    const targetIndex = orderedVisibleColumnKeys.indexOf(targetColumnKey);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const [draggedKey] = orderedVisibleColumnKeys.splice(sourceIndex, 1);
    orderedVisibleColumnKeys.splice(targetIndex, 0, draggedKey);
    this.onColumnOrderChange(orderedVisibleColumnKeys);
  }

  onColumnHeaderDragEnd(): void {
    this.draggingColumnKey = null;
  }

  resolveStudentListColumnLabel(column: StudentListColumnConfig): string {
    return this.resolveUnifiedStudentListColumnLabel(column);
    const pageContext = this.resolvePageContext();
    if (pageContext === 'osslt' && column.key === 'ielts') {
      return 'OSSLT \u6210\u7ee9';
    }
    if (pageContext === 'osslt' && column.key === 'languageTracking') {
      return 'OSSLT \u8ddf\u8fdb\u72b6\u6001';
    }
    if (pageContext === 'ielts' && column.key === 'languageTracking') {
      return '\u8bed\u8a00\u6210\u7ee9\u8ddf\u8e2a';
    }
    if (pageContext === 'osslt' && column.key === 'ielts') {
      return 'OSSLT 成绩';
    }
    if (pageContext === 'osslt' && column.key === 'languageTracking') {
      return 'OSSLT 跟进状态';
    }
    if (pageContext === 'ielts' && column.key === 'languageTracking') {
      return '语言成绩跟踪';
    }
    if (pageContext === 'osslt') {
      if (column.key === 'ielts') return 'OSSLT 成绩';
      if (column.key === 'languageTracking') return 'OSSLT 跟进状态';
    }
    if (pageContext === 'ielts' && column.key === 'languageTracking') {
      return '语言成绩跟踪';
    }
    return column.label;
  }

  resolveUnifiedStudentListColumnLabel(column: StudentListColumnConfig): string {
    return STUDENT_LIST_COLUMN_LABEL_BY_KEY[column.key] || column.label;
  }

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

  resolveStudentServiceItems(student: StudentAccount): string {
    const selectedItems = this.resolveServiceItemsSelection(student);
    return selectedItems.length > 0 ? selectedItems.join('、') : '-';
  }

  resolveServiceItemsCountLabel(student: StudentAccount): string {
    if (this.isServiceItemsLoading(student)) {
      return '加载中...';
    }

    return `${this.resolveServiceItemsSelection(student).length}项`;
  }

  resolveServiceItemsPanelTitle(student: StudentAccount): string | null {
    const selectedItemsText = this.resolveStudentServiceItems(student);
    return selectedItemsText !== '-' ? selectedItemsText : '点击选择服务项目';
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

  resolveStudentMotherLanguage(student: StudentAccount): string {
    return this.resolveMotherLanguageValue(student) || '-';
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

  resolveStudentLanguageCourseStatus(student: StudentAccount): string {
    const status = this.resolveLanguageCourseStatusForFilter(student);
    return this.resolveLanguageCourseStatusLabel(status);
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
      case 'serviceItems':
        return this.resolveStudentServiceItems(student);
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
      case 'motherLanguage':
        return this.resolveStudentMotherLanguage(student);
      case 'schoolBoard':
        return this.resolveStudentSchoolBoard(student);
      case 'country':
        return this.resolveStudentCountry(student);
      case 'province':
        return this.resolveStudentProvince(student);
      case 'city':
        return this.resolveStudentCity(student);
      case 'languageCourseStatus':
        return this.resolveStudentLanguageCourseStatus(student);
      case 'status':
        return this.isArchived(student) ? '已归档' : '已启用';
      case 'selectable':
        return this.isArchived(student) ? '已锁定' : '可选';
      default:
        return '-';
    }
  }

  get pageTitle(): string {
    return PAGE_TITLE_BY_CONTEXT[this.resolvePageContext()];
  }

  get resolvedPageTitle(): string {
    return this.pageTitle;
  }

  get languageTrackingStatusOptions(): readonly TrackingManualStatusOption[] {
    if (this.resolvePageContext() === 'osslt') {
      return this.ossltTrackingStatusOptions;
    }
    return this.languageScoreTrackingStatusOptions;
  }

  private getOrderedColumnsForCurrentContext(): StudentListColumnConfig[] {
    const ordered: StudentListColumnConfig[] = [];
    const seen = new Set<StudentListColumnKey>();
    const normalizedOrder = this.normalizeColumnOrderKeys(this.columnOrderKeys);
    for (const key of normalizedOrder) {
      if (seen.has(key) || !this.isColumnAllowedForCurrentContext(key)) continue;
      const config = this.studentListColumnConfigByKey.get(key);
      if (!config) continue;
      seen.add(key);
      ordered.push(config);
    }
    return ordered;
  }

  private normalizeColumnOrderKeys(keys: readonly string[]): StudentListColumnKey[] {
    const normalized: StudentListColumnKey[] = [];
    const seen = new Set<StudentListColumnKey>();
    for (const key of keys) {
      const normalizedKey = String(key ?? '').trim();
      if (!normalizedKey) continue;
      const typedKey = normalizedKey as StudentListColumnKey;
      if (!this.studentListColumnConfigByKey.has(typedKey) || seen.has(typedKey)) continue;
      seen.add(typedKey);
      normalized.push(typedKey);
    }
    for (const column of this.studentListColumns) {
      if (seen.has(column.key)) continue;
      seen.add(column.key);
      normalized.push(column.key);
    }
    return normalized;
  }

  private normalizeVisibleColumnOrderKeys(keys: readonly string[]): StudentListColumnKey[] {
    const normalized: StudentListColumnKey[] = [];
    const seen = new Set<StudentListColumnKey>();
    for (const key of keys) {
      const normalizedKey = String(key ?? '').trim();
      if (!normalizedKey) continue;
      const typedKey = normalizedKey as StudentListColumnKey;
      if (!this.studentListColumnConfigByKey.has(typedKey) || seen.has(typedKey)) continue;
      seen.add(typedKey);
      normalized.push(typedKey);
    }
    return normalized;
  }

  onColumnOrderChange(orderedVisibleColumnKeys: readonly string[]): void {
    const normalizedVisibleOrder = this.normalizeVisibleColumnOrderKeys(orderedVisibleColumnKeys);
    if (normalizedVisibleOrder.length < 2) return;

    const visibleSet = new Set<StudentListColumnKey>(normalizedVisibleOrder);
    const normalizedOrder = this.normalizeColumnOrderKeys(this.columnOrderKeys);
    const currentVisibleOrder = normalizedOrder.filter((key) => visibleSet.has(key));
    if (
      currentVisibleOrder.length !== normalizedVisibleOrder.length ||
      currentVisibleOrder.some((key, index) => key !== normalizedVisibleOrder[index])
    ) {
      let visibleIndex = 0;
      this.columnOrderKeys = normalizedOrder.map((key) =>
        visibleSet.has(key) ? normalizedVisibleOrder[visibleIndex++] : key
      );
      this.persistVisibleColumnsPreference();
      this.syncVisibleColumnsPreferenceToServer();
    }
  }

  get visibleColumns(): readonly StudentListColumnConfig[] {
    return this.getOrderedColumnsForCurrentContext().filter(
      (column) => this.visibleColumnKeys.has(column.key) && this.isColumnAllowedForCurrentContext(column.key)
    );
  }

  get columnToggleOptions(): readonly StudentListColumnConfig[] {
    return this.getOrderedColumnsForCurrentContext().filter((column) =>
      this.isColumnAllowedForCurrentContext(column.key)
    );
  }

  isColumnVisible(columnKey: StudentListColumnKey): boolean {
    return this.isColumnAllowedForCurrentContext(columnKey) && this.visibleColumnKeys.has(columnKey);
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

  onSearchKeywordChange(value: string): void {
    this.searchKeyword = String(value ?? '');
    this.applyListView();
  }

  onVolunteerCompletedFilterChange(value: boolean): void {
    this.volunteerCompletedFilter = value === true;
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

  ossltRoute(student: StudentAccount): string[] {
    const studentId = this.resolveStudentId(student);
    if (!studentId) {
      return ['/teacher/students'];
    }
    return ['/teacher/students', String(studentId), 'osslt'];
  }

  volunteerRoute(student: StudentAccount): string[] {
    const studentId = this.resolveStudentId(student);
    if (!studentId) {
      return ['/teacher/volunteer'];
    }
    return ['/teacher/students', String(studentId), 'volunteer'];
  }

  resolveVolunteerHoursLabel(student: StudentAccount): string {
    const hours = this.resolveVolunteerHours(student);
    if (hours === null) return '--';
    if (Number.isInteger(hours)) return String(Math.trunc(hours));
    return String(hours.toFixed(1)).replace(/\.0$/, '');
  }

  resolveVolunteerHoursBadgeLabel(student: StudentAccount): string {
    const hoursLabel = this.resolveVolunteerHoursLabel(student);
    if (hoursLabel === '--') return hoursLabel;
    return `${hoursLabel} 小时`;
  }

  resolveVolunteerHoursBackground(student: StudentAccount): string {
    const hours = this.resolveVolunteerHours(student);
    if (hours === null) return '#f1f3f5';
    return hours < 40 ? '#fff2d8' : '#e7f6ec';
  }

  resolveVolunteerHoursTextColor(student: StudentAccount): string {
    const hours = this.resolveVolunteerHours(student);
    if (hours === null) return '#6a7385';
    return hours < 40 ? '#8a5a00' : '#2f6b43';
  }

  resolveVolunteerHoursBorderColor(student: StudentAccount): string {
    const hours = this.resolveVolunteerHours(student);
    if (hours === null) return '#c8cfda';
    return hours < 40 ? '#e3c77a' : '#8fc8a3';
  }

  resolveIeltsStatusLabel(student: StudentAccount): string {
    return this.resolveIeltsStatusDisplayModel(this.resolveStudentId(student)).label;
  }

  resolveIeltsStatusBackground(student: StudentAccount): string {
    return this.resolveIeltsStatusDisplayModel(this.resolveStudentId(student)).background;
  }

  resolveIeltsStatusTextColor(student: StudentAccount): string {
    return this.resolveIeltsStatusDisplayModel(this.resolveStudentId(student)).textColor;
  }

  resolveIeltsStatusBorderColor(student: StudentAccount): string {
    return this.resolveIeltsStatusDisplayModel(this.resolveStudentId(student)).borderColor;
  }

  resolveOssltResultStatusLabel(student: StudentAccount): string {
    return this.resolveOssltResultLabel(this.resolveStudentId(student));
  }

  resolveOssltResultStatusBackground(student: StudentAccount): string {
    return this.resolveOssltResultBackground(this.resolveStudentId(student));
  }

  resolveOssltResultStatusTextColor(student: StudentAccount): string {
    return this.resolveOssltResultTextColor(this.resolveStudentId(student));
  }

  resolveOssltResultStatusBorderColor(student: StudentAccount): string {
    return this.resolveOssltResultBorderColor(this.resolveStudentId(student));
  }

  resolveLanguageTrackingStatusLabel(student: StudentAccount): string {
    return this.resolveLanguageTrackingStatusDisplayModel(this.resolveStudentId(student)).label;
  }

  resolveLanguageTrackingStatusBackground(student: StudentAccount): string {
    return this.resolveLanguageTrackingStatusDisplayModel(this.resolveStudentId(student)).background;
  }

  resolveLanguageTrackingStatusTextColor(student: StudentAccount): string {
    return this.resolveLanguageTrackingStatusDisplayModel(this.resolveStudentId(student)).textColor;
  }

  resolveLanguageTrackingStatusBorderColor(student: StudentAccount): string {
    return this.resolveLanguageTrackingStatusDisplayModel(this.resolveStudentId(student)).borderColor;
  }

  resolveOssltTrackingStatusLabel(student: StudentAccount): string {
    return this.resolveOssltTrackingStatusDisplayModel(this.resolveStudentId(student)).label;
  }

  resolveOssltTrackingStatusBackground(student: StudentAccount): string {
    return this.resolveOssltTrackingStatusDisplayModel(this.resolveStudentId(student)).background;
  }

  resolveOssltTrackingStatusTextColor(student: StudentAccount): string {
    return this.resolveOssltTrackingStatusDisplayModel(this.resolveStudentId(student)).textColor;
  }

  resolveOssltTrackingStatusBorderColor(student: StudentAccount): string {
    return this.resolveOssltTrackingStatusDisplayModel(this.resolveStudentId(student)).borderColor;
  }

  resolveLanguageTrackingStatusOptionLabel(status: TrackingManualStatusOption): string {
    return resolveLanguageTrackingStatusDisplay({ status: status as LanguageTrackingStatus }).label;
  }

  resolveLanguageScoreFilterOptionLabel(status: IeltsTrackingStatus): string {
    return resolveIeltsStatusDisplay({
      trackingStatus: status,
      shouldShowModule: true,
    }).label;
  }

  resolveLanguageCourseStatusLabel(status: LanguageCourseStatus | null): string {
    if (status === 'NOT_RECEIVED_TRAINING') return '未接收培训';
    if (status === 'ENROLLED_GLOBAL_IELTS') return '已报名环球雅思课程';
    if (status === 'ENROLLED_OTHER_IELTS') return '已报名其他机构雅思课程';
    if (status === 'COURSE_COMPLETED_NOT_EXAMINED') return '已结课，未考试';
    if (status === 'EXAM_REGISTERED') return '已报名考试';
    if (status === 'SCORE_RELEASED') return '已出分';
    return '待更新';
  }

  resolveOssltResultFilterOptionLabel(result: OssltResult): string {
    if (result === 'PASS') return '\u5df2\u901a\u8fc7';
    if (result === 'FAIL') return '\u672a\u901a\u8fc7';
    return '\u5f85\u66f4\u65b0';
  }

  resolveLanguageTrackingStatusSelection(student: StudentAccount): TrackingManualStatusOption | '' {
    const studentId = this.resolveStudentId(student);
    if (!studentId) {
      return '';
    }
    return this.languageTrackingStatusCache.get(studentId) || '';
  }

  isLanguageTrackingStatusLoading(student: StudentAccount): boolean {
    const studentId = this.resolveStudentId(student);
    if (!studentId) {
      return false;
    }
    return !this.languageTrackingStatusCache.has(studentId) && this.ieltsStatusLoadInFlight.has(studentId);
  }

  isLanguageTrackingStatusUnavailable(student: StudentAccount): boolean {
    const studentId = this.resolveStudentId(student);
    if (!studentId) {
      return true;
    }
    return this.ieltsStatusUnavailable.has(studentId);
  }

  isLanguageTrackingStatusSaving(student: StudentAccount): boolean {
    const studentId = this.resolveStudentId(student);
    if (!studentId) {
      return false;
    }
    return this.languageTrackingStatusSaveInFlight.has(studentId);
  }

  onLanguageTrackingStatusSelectionChange(student: StudentAccount, rawValue: unknown): void {
    const studentId = this.resolveStudentId(student);
    if (!studentId) {
      return;
    }

    const nextStatus = this.normalizeLanguageTrackingStatusValue(rawValue);
    if (!nextStatus) {
      return;
    }

    const previousStatus = this.languageTrackingStatusCache.get(studentId) || null;
    if (previousStatus === nextStatus) {
      return;
    }
    if (this.languageTrackingStatusSaveInFlight.has(studentId)) {
      return;
    }

    this.languageTrackingStatusCache.set(studentId, nextStatus);
    this.languageTrackingStatusSaveInFlight.add(studentId);
    this.actionError = '';

    this.ieltsApi
      .updateTeacherStudentIeltsData(studentId, {
        languageTrackingManualStatus: nextStatus,
      })
      .pipe(
        catchError((err: HttpErrorResponse) => {
          if (!this.shouldRetryLanguageTrackingSave(err)) {
            return throwError(() => err);
          }

          return this.ieltsApi.getTeacherStudentIeltsModuleState(studentId).pipe(
            switchMap((state) =>
              this.ieltsApi.updateTeacherStudentIeltsData(
                studentId,
                this.buildLanguageTrackingRetryPayload(state, nextStatus)
              )
            )
          );
        }),
        finalize(() => {
          this.languageTrackingStatusSaveInFlight.delete(studentId);
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (moduleState) => {
          const summary = deriveStudentIeltsModuleState(moduleState).summary;
          const statusColorToken = String(summary.colorToken || '').trim();
          const languageCourseStatus = this.extractLanguageCourseStatusFromModuleState(moduleState);

          this.languageTrackingStatusCache.set(studentId, summary.languageTrackingStatus);
          if (languageCourseStatus) {
            this.languageCourseStatusCache.set(studentId, languageCourseStatus);
          } else {
            this.languageCourseStatusCache.delete(studentId);
          }
          if (summary.shouldShowModule === false) {
            this.ieltsNoRequirement.add(studentId);
            this.ieltsStatusCache.delete(studentId);
            this.ieltsStatusColorTokenCache.delete(studentId);
            this.ieltsStatusUnavailable.delete(studentId);
          } else {
            this.ieltsStatusCache.set(studentId, summary.trackingStatus);
            if (statusColorToken) {
              this.ieltsStatusColorTokenCache.set(studentId, statusColorToken);
            } else {
              this.ieltsStatusColorTokenCache.delete(studentId);
            }
            this.ieltsNoRequirement.delete(studentId);
            this.ieltsStatusUnavailable.delete(studentId);
          }
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          if (previousStatus) {
            this.languageTrackingStatusCache.set(studentId, previousStatus);
          } else {
            this.languageTrackingStatusCache.delete(studentId);
          }
          this.actionError = this.extractErrorMessage(err) || '保存语言跟踪状态失败。';
          this.cdr.detectChanges();
        },
      });
  }

  resolveLanguageCourseStatusSelection(student: StudentAccount): LanguageCourseStatus | '' {
    const studentId = this.resolveStudentId(student);
    if (!studentId) {
      return '';
    }

    if (this.languageCourseStatusCache.has(studentId)) {
      return this.languageCourseStatusCache.get(studentId) || '';
    }
    const extracted = this.extractLanguageCourseStatusFromStudent(student);
    if (extracted) {
      this.languageCourseStatusCache.set(studentId, extracted);
      return extracted;
    }
    return '';
  }

  isLanguageCourseStatusSaving(student: StudentAccount): boolean {
    const studentId = this.resolveStudentId(student);
    if (!studentId) {
      return false;
    }
    return this.languageCourseStatusSaveInFlight.has(studentId);
  }

  onLanguageCourseStatusSelectionChange(student: StudentAccount, rawValue: unknown): void {
    const studentId = this.resolveStudentId(student);
    if (!studentId) {
      return;
    }

    const nextStatus = this.normalizeLanguageCourseStatusValue(rawValue);
    if (!nextStatus) {
      return;
    }

    const previousStatus = this.resolveLanguageCourseStatusForFilter(student);
    if (previousStatus === nextStatus) {
      return;
    }
    if (this.languageCourseStatusSaveInFlight.has(studentId)) {
      return;
    }

    this.languageCourseStatusCache.set(studentId, nextStatus);
    this.languageCourseStatusSaveInFlight.add(studentId);
    this.actionError = '';
    this.cdr.detectChanges();

    this.ieltsApi
      .updateTeacherStudentIeltsData(studentId, {
        languageCourseStatus: nextStatus,
      })
      .pipe(
        catchError((err: HttpErrorResponse) => {
          if (!this.shouldRetryLanguageTrackingSave(err)) {
            return throwError(() => err);
          }

          return this.ieltsApi.getTeacherStudentIeltsModuleState(studentId).pipe(
            switchMap((state) =>
              this.ieltsApi.updateTeacherStudentIeltsData(
                studentId,
                this.buildLanguageCourseStatusRetryPayload(state, nextStatus)
              )
            )
          );
        }),
        finalize(() => {
          this.languageCourseStatusSaveInFlight.delete(studentId);
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (moduleState) => {
          const normalizedFromState = this.extractLanguageCourseStatusFromModuleState(moduleState);
          if (normalizedFromState) {
            this.languageCourseStatusCache.set(studentId, normalizedFromState);
          } else {
            this.languageCourseStatusCache.set(studentId, nextStatus);
          }
          const summary = deriveStudentIeltsModuleState(moduleState).summary;
          const statusColorToken = String(summary.colorToken || '').trim();
          this.languageTrackingStatusCache.set(studentId, summary.languageTrackingStatus);
          if (summary.shouldShowModule === false) {
            this.ieltsNoRequirement.add(studentId);
            this.ieltsStatusCache.delete(studentId);
            this.ieltsStatusColorTokenCache.delete(studentId);
            this.ieltsStatusUnavailable.delete(studentId);
          } else {
            this.ieltsStatusCache.set(studentId, summary.trackingStatus);
            if (statusColorToken) {
              this.ieltsStatusColorTokenCache.set(studentId, statusColorToken);
            } else {
              this.ieltsStatusColorTokenCache.delete(studentId);
            }
            this.ieltsNoRequirement.delete(studentId);
            this.ieltsStatusUnavailable.delete(studentId);
          }
          this.scheduleStatusFilterReapply();
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          if (previousStatus) {
            this.languageCourseStatusCache.set(studentId, previousStatus);
          } else {
            this.languageCourseStatusCache.delete(studentId);
          }
          this.actionError = this.extractErrorMessage(err) || '保存语言报课情况失败。';
          this.cdr.detectChanges();
        },
      });
  }

  resolveOssltTrackingStatusOptionLabel(status: TrackingManualStatusOption): string {
    return this.resolveOssltTrackingOptionLabel(status);
  }

  resolveOssltTrackingStatusSelection(student: StudentAccount): TrackingManualStatusOption | '' {
    const studentId = this.resolveStudentId(student);
    if (!studentId) {
      return '';
    }
    return this.ossltTrackingStatusCache.get(studentId) || '';
  }

  isOssltTrackingStatusLoading(student: StudentAccount): boolean {
    const studentId = this.resolveStudentId(student);
    if (!studentId) {
      return false;
    }
    return !this.ossltTrackingStatusCache.has(studentId) && this.ossltStatusLoadInFlight.has(studentId);
  }

  isOssltTrackingStatusUnavailable(student: StudentAccount): boolean {
    const studentId = this.resolveStudentId(student);
    if (!studentId) {
      return true;
    }
    return this.ossltStatusUnavailable.has(studentId);
  }

  isOssltTrackingStatusSaving(student: StudentAccount): boolean {
    const studentId = this.resolveStudentId(student);
    if (!studentId) {
      return false;
    }
    return this.ossltTrackingStatusSaveInFlight.has(studentId);
  }

  onOssltTrackingStatusSelectionChangePublic(student: StudentAccount, rawValue: unknown): void {
    this.onOssltTrackingStatusSelectionChange(student, rawValue);
  }

  private onOssltTrackingStatusSelectionChange(student: StudentAccount, rawValue: unknown): void {
    const studentId = this.resolveStudentId(student);
    if (!studentId) return;

    const nextStatus = this.normalizeOssltTrackingStatusValue(rawValue);
    if (!nextStatus) return;

    const previousStatus = this.ossltTrackingStatusCache.get(studentId) || null;
    if (previousStatus === nextStatus) return;
    if (this.ossltTrackingStatusSaveInFlight.has(studentId)) return;

    this.ossltTrackingStatusCache.set(studentId, nextStatus);
    this.ossltTrackingStatusSaveInFlight.add(studentId);
    this.actionError = '';
    this.cdr.detectChanges();

    this.ossltApi
      .updateTeacherStudentOssltData(studentId, {
        ossltTrackingManualStatus: nextStatus,
      })
      .pipe(
        finalize(() => {
          this.ossltTrackingStatusSaveInFlight.delete(studentId);
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (state) => {
          const summary = deriveStudentOssltSummary(state);
          this.ossltTrackingStatusCache.set(studentId, summary.trackingStatus);
          this.ossltResultCache.set(studentId, state.latestOssltResult);
          this.ossltStatusUnavailable.delete(studentId);
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          if (previousStatus) {
            this.ossltTrackingStatusCache.set(studentId, previousStatus);
          } else {
            this.ossltTrackingStatusCache.delete(studentId);
          }
          this.actionError = this.extractErrorMessage(err) || '保存 OSSLT 跟进状态失败。';
          this.cdr.detectChanges();
        },
      });
  }

  loadStudents(): void {
    this.loadingList = true;
    this.listError = '';
    this.ieltsStatusCache.clear();
    this.languageTrackingStatusCache.clear();
    this.languageCourseStatusCache.clear();
    this.ieltsStatusColorTokenCache.clear();
    this.ieltsStatusLoadInFlight.clear();
    this.ieltsNoRequirement.clear();
    this.ieltsStatusUnavailable.clear();
    this.languageTrackingStatusSaveInFlight.clear();
    this.languageCourseStatusSaveInFlight.clear();
    this.ossltResultCache.clear();
    this.ossltTrackingStatusCache.clear();
    this.ossltStatusLoadInFlight.clear();
    this.ossltStatusUnavailable.clear();
    this.ossltTrackingStatusSaveInFlight.clear();
    this.volunteerHoursCache.clear();
    this.volunteerCompletedCache.clear();
    this.volunteerHoursLoadInFlight.clear();
    this.volunteerHoursUnavailable.clear();
    this.volunteerCompletedFilterAvailable = true;
    this.volunteerCompletedFilterError = '';
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

    const cachedProfile = this.studentProfileCache.get(studentId);
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
          this.cacheStudentProfilePayload(studentId, payload);
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

    const cachedProfile = this.studentProfileCache.get(studentId);
    if (cachedProfile) {
      this.saveTeacherNoteWithProfile(studentId, cachedProfile, noteText);
      return;
    }

    this.studentProfileApi.getStudentProfileForTeacher(studentId).subscribe({
      next: (payload) => {
        this.cacheStudentProfilePayload(studentId, payload);
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
          this.cacheStudentProfilePayload(studentId, savedPayload);
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

  isServiceItemsLoading(student: StudentAccount): boolean {
    const studentId = this.resolveStudentId(student);
    return !!studentId && !this.serviceItemsCache.has(studentId) && this.studentProfileLoadInFlight.has(studentId);
  }

  isServiceItemsSaving(student: StudentAccount): boolean {
    const studentId = this.resolveStudentId(student);
    return !!studentId && this.serviceItemsSaveInFlight.has(studentId);
  }

  isServiceItemsPanelOpen(student: StudentAccount): boolean {
    const studentId = this.resolveStudentId(student);
    return !!studentId && this.serviceItemsPanelStudentId === studentId;
  }

  resolveServiceItemsPanelStudent(): StudentAccount | null {
    const studentId = this.serviceItemsPanelStudentId;
    if (!studentId) {
      return null;
    }

    const visibleMatch = this.visibleStudents.find(
      (student) => this.resolveStudentId(student) === studentId
    );
    if (visibleMatch) {
      return visibleMatch;
    }

    return (
      this.students.find((student) => this.resolveStudentId(student) === studentId) || null
    );
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.serviceItemsPanelStudentId === null) {
      return;
    }

    const targetElement = event.target as HTMLElement;
    const isInsideServiceItems = !!targetElement.closest('.service-items-container');

    // Also check if clicking on elements that might be logically part of the panel but physically outside
    // (e.g. some tooltips or dynamic elements if any).
    // For now, closest('.service-items-container') is the primary check.

    if (!isInsideServiceItems) {
      this.closeServiceItemsPanel();
      this.cdr.detectChanges();
    }
  }

  toggleServiceItemsPanel(student: StudentAccount, event?: MouseEvent): void {
    const studentId = this.resolveStudentId(student);
    if (!studentId) {
      return;
    }

    if (this.serviceItemsPanelStudentId === studentId) {
      this.closeServiceItemsPanel();
      this.cdr.detectChanges();
      return;
    }

    this.serviceItemsPanelStudentId = studentId;

    const triggerElement =
      event?.currentTarget instanceof HTMLElement
        ? event.currentTarget
        : this.findServiceItemsTriggerElement(studentId);
    this.updateServiceItemsPanelPosition(triggerElement);

    this.cdr.detectChanges();
  }

  private closeServiceItemsPanel(): void {
    this.serviceItemsPanelStudentId = null;
    this.serviceItemsPanelTop = null;
    this.serviceItemsPanelBottom = null;
  }

  private findServiceItemsTriggerElement(studentId: number): HTMLElement | null {
    if (typeof document === 'undefined') {
      return null;
    }

    return document.querySelector(`[data-service-items-trigger-id="${studentId}"]`) as HTMLElement | null;
  }

  private updateServiceItemsPanelPosition(triggerElement: HTMLElement | null): void {
    if (!triggerElement || typeof window === 'undefined') {
      this.serviceItemsPanelTop = null;
      this.serviceItemsPanelBottom = null;
      this.serviceItemsPanelLeft = 12;
      return;
    }

    const rect = triggerElement.getBoundingClientRect();
    const panelWidth = 156;
    const panelEstimatedHeight = 320;
    const gap = 6;
    const viewportPadding = 12;
    const viewportWidth = window.innerWidth || 0;
    const viewportHeight = window.innerHeight || 0;

    const maxLeft = Math.max(viewportPadding, viewportWidth - panelWidth - viewportPadding);
    this.serviceItemsPanelLeft = Math.round(Math.min(Math.max(rect.left, viewportPadding), maxLeft));

    const shouldOpenUpward =
      rect.bottom + gap + panelEstimatedHeight > viewportHeight &&
      rect.top - gap > panelEstimatedHeight;

    if (shouldOpenUpward) {
      this.serviceItemsPanelTop = null;
      this.serviceItemsPanelBottom = Math.round(
        Math.max(viewportPadding, viewportHeight - rect.top + gap)
      );
      return;
    }

    const maxTop = Math.max(viewportPadding, viewportHeight - viewportPadding - 40);
    this.serviceItemsPanelTop = Math.round(Math.min(Math.max(rect.bottom + gap, viewportPadding), maxTop));
    this.serviceItemsPanelBottom = null;
  }

  isServiceItemSelectedForStudent(student: StudentAccount, item: string): boolean {
    return this.resolveServiceItemsSelection(student).some(
      (selectedItem) => this.normalizeServiceItemKey(selectedItem) === this.normalizeServiceItemKey(item)
    );
  }

  onServiceItemSelectionChange(student: StudentAccount, item: string, checked: boolean): void {
    const studentId = this.resolveStudentId(student);
    if (!studentId || this.serviceItemsSaveInFlight.has(studentId)) {
      return;
    }

    this.actionError = '';
    const cachedProfile = this.studentProfileCache.get(studentId);
    const cachedSelection = this.serviceItemsCache.get(studentId);
    const inlineSelection = cachedSelection ?? this.extractServiceItemsFromStudent(student);

    if (!cachedProfile && !cachedSelection && inlineSelection.length === 0 && checked) {
      this.persistServiceItemsSelection(studentId, item, checked, null, null);
      return;
    }

    const nextSelection = this.toggleServiceItemsSelection(inlineSelection, item, checked);
    this.serviceItemsCache.set(studentId, nextSelection);
    this.persistServiceItemsSelection(studentId, item, checked, nextSelection, cachedProfile);
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
    if (!this.isColumnAllowedForCurrentContext(columnKey)) return;

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
    if (columnKey === 'serviceItems' && checked) {
      this.prefetchVisibleServiceItems();
      this.cdr.detectChanges();
    }

    if ((columnKey === 'ielts' || columnKey === 'languageTracking') && checked) {
      this.prefetchVisibleIeltsStatuses();
      this.cdr.detectChanges();
    }
    if ((columnKey === 'ossltResult' || columnKey === 'ossltTracking') && checked) {
      this.prefetchVisibleOssltStatuses();
      this.cdr.detectChanges();
    }
  }

  resetVisibleColumns(): void {
    this.columnOrderKeys = this.studentListColumns.map((column) => column.key);
    this.visibleColumnKeys = this.buildDefaultVisibleColumnKeys();
    this.persistIndependentColumnOverrides();
    this.persistVisibleColumnsPreference();
    this.syncVisibleColumnsPreferenceToServer();
    this.hydrateStudentMetadata(this.students);
    if (this.visibleColumnKeys.has('teacherNote')) {
      this.prefetchVisibleTeacherNotes();
      this.cdr.detectChanges();
    }
    if (this.visibleColumnKeys.has('serviceItems')) {
      this.prefetchVisibleServiceItems();
      this.cdr.detectChanges();
    }
    if (this.visibleColumnKeys.has('ielts') || this.visibleColumnKeys.has('languageTracking')) {
      this.prefetchVisibleIeltsStatuses();
      this.cdr.detectChanges();
    }
    if (this.visibleColumnKeys.has('ossltResult') || this.visibleColumnKeys.has('ossltTracking')) {
      this.prefetchVisibleOssltStatuses();
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
    const normalizedOrder = this.normalizeColumnOrderKeys(this.columnOrderKeys);
    return (
      normalizedOrder.length === this.studentListColumns.length &&
      normalizedOrder.every((key, index) => key === this.studentListColumns[index]?.key)
    );
  }

  private initializeVisibleColumns(): void {
    const defaults = this.buildDefaultVisibleColumnKeys();
    const defaultOrder = this.studentListColumns.map((column) => column.key);
    const persisted = this.readVisibleColumnsPreference();
    this.columnOrderKeys = defaultOrder;
    if (!persisted) {
      this.visibleColumnKeys = this.sanitizeVisibleColumnKeysForCurrentContext(
        this.applyIndependentColumnOverrides(defaults)
      );
      this.persistIndependentColumnOverrides();
      return;
    }

    if (Array.isArray(persisted.orderedColumnKeys) && persisted.orderedColumnKeys.length > 0) {
      this.columnOrderKeys = this.normalizeColumnOrderKeys(persisted.orderedColumnKeys);
    }

    const restored = this.normalizeVisibleColumnKeys(persisted.visibleColumnKeys || []);
    const base = restored.size > 0 ? restored : defaults;
    this.visibleColumnKeys = this.sanitizeVisibleColumnKeysForCurrentContext(
      this.applyIndependentColumnOverrides(base)
    );
    this.persistIndependentColumnOverrides();
  }

  private buildDefaultVisibleColumnKeys(): Set<StudentListColumnKey> {
    const contextualDefaults =
      STUDENT_LIST_DEFAULT_COLUMN_KEYS_BY_CONTEXT[this.resolvePageContext()];
    if (contextualDefaults.length > 0) {
      return this.sanitizeVisibleColumnKeysForCurrentContext(
        this.normalizeVisibleColumnKeys(contextualDefaults)
      );
    }
    return this.sanitizeVisibleColumnKeysForCurrentContext(
      buildVisibleColumnDefaults(this.studentListColumns)
    );
  }

  private persistVisibleColumnsPreference(): void {
    try {
      const storage = (globalThis as { localStorage?: Storage }).localStorage;
      if (!storage) return;
      const storageKey = this.resolveVisibleColumnsStorageKey();
      const payload: StudentListColumnPreferenceVm = {
        visibleColumnKeys: Array.from(this.visibleColumnKeys.values()),
        orderedColumnKeys: this.normalizeColumnOrderKeys(this.columnOrderKeys),
      };
      storage.setItem(
        storageKey,
        JSON.stringify(payload)
      );
    } catch {}
  }

  private readVisibleColumnsPreference(): StudentListColumnPreferenceVm | null {
    try {
      const storage = (globalThis as { localStorage?: Storage }).localStorage;
      if (!storage) return null;
      const storageKey = this.resolveVisibleColumnsStorageKey();
      const raw = storage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return {
          visibleColumnKeys: parsed.map((value) => String(value ?? '').trim()).filter(Boolean),
        };
      }
      if (!parsed || typeof parsed !== 'object') return null;
      const node = parsed as { visibleColumnKeys?: unknown; orderedColumnKeys?: unknown };
      return {
        visibleColumnKeys: Array.isArray(node.visibleColumnKeys)
          ? node.visibleColumnKeys.map((value) => String(value ?? '').trim()).filter(Boolean)
          : [],
        orderedColumnKeys: Array.isArray(node.orderedColumnKeys)
          ? node.orderedColumnKeys.map((value) => String(value ?? '').trim()).filter(Boolean)
          : [],
      };
    } catch {
      return null;
    }
  }

  private resolveVisibleColumnsStorageKey(): string {
    const pageContext = this.resolvePageContext();
    const pageScope = `page-${pageContext}`;
    const scope = this.resolvePreferenceStorageScope(pageScope);
    return `${STUDENT_LIST_COLUMN_PREFERENCE_STORAGE_KEY_PREFIX}.${scope}.${STUDENT_LIST_COLUMN_PREFERENCE_VERSION}`;
  }

  private resolveListControlsStorageKey(): string {
    const pageContext = this.resolvePageContext();
    const pageScope = `page-${pageContext}`;
    const scope = this.resolvePreferenceStorageScope(pageScope);
    return `${STUDENT_LIST_FILTER_PREFERENCE_STORAGE_KEY_PREFIX}.${scope}.${STUDENT_LIST_FILTER_PREFERENCE_VERSION}`;
  }

  private resolvePreferenceStorageScope(pageScope: string): string {
    const session = this.auth.getSession();
    const teacherId = Number(session?.teacherId);
    if (Number.isFinite(teacherId) && teacherId > 0) {
      return `${pageScope}.teacher-${Math.trunc(teacherId)}`;
    }

    const userId = this.auth.getCurrentUserId();
    if (userId && userId > 0) {
      return `${pageScope}.user-${Math.trunc(userId)}`;
    }

    return `${pageScope}.anonymous`;
  }

  private initializeListControlsFromPreference(): void {
    const persisted = this.readListControlsPreference();
    if (!persisted) return;

    this.listLimit = this.normalizeListLimitPreference(persisted.listLimit);
    this.showInactive = this.normalizePreferenceBoolean(persisted.showInactive);
    this.searchKeyword = String(persisted.searchKeyword ?? '').trim();

    const countrySource = String(
      persisted.countryFilterInput ?? persisted.countryFilter ?? ''
    ).trim();
    const resolvedCountry = this.resolveCountryFilterSelection(countrySource);
    this.countryFilter = resolvedCountry;
    this.countryFilterInput = resolvedCountry === 'ALL' ? '' : resolvedCountry;

    const provinceSource = String(
      persisted.provinceFilterInput ?? persisted.provinceFilter ?? ''
    ).trim();
    const resolvedProvince = provinceSource
      ? this.resolveProvinceFilterSelection(provinceSource, this.provinceFilterCountry)
      : '';
    this.provinceFilter = resolvedProvince;
    this.provinceFilterInput = resolvedProvince;

    const citySource = String(persisted.cityFilterInput ?? persisted.cityFilter ?? '').trim();
    const resolvedCity = citySource
      ? this.resolveCityFilterSelection(citySource, this.cityFilterCountry)
      : '';
    this.cityFilter = resolvedCity;
    this.cityFilterInput = resolvedCity;

    const schoolBoardSource = String(
      persisted.schoolBoardFilterInput ?? persisted.schoolBoardFilter ?? ''
    ).trim();
    const resolvedSchoolBoard = schoolBoardSource
      ? this.resolveSchoolBoardFilterSelection(schoolBoardSource)
      : '';
    this.schoolBoardFilter = resolvedSchoolBoard;
    this.schoolBoardFilterInput = resolvedSchoolBoard;

    const graduationSeasonSource = String(
      persisted.graduationSeasonFilterInput ?? persisted.graduationSeasonFilter ?? ''
    ).trim();
    const resolvedGraduationSeason = graduationSeasonSource
      ? this.resolveGraduationSeasonFilterSelection(graduationSeasonSource)
      : '';
    this.graduationSeasonFilter = resolvedGraduationSeason;
    this.graduationSeasonFilterInput = resolvedGraduationSeason;

    this.languageScoreFilter =
      this.normalizeIeltsTrackingStatusValue(persisted.languageScoreFilter) ?? '';
    this.languageScoreTrackingFilter =
      this.normalizeLanguageTrackingStatusValue(persisted.languageScoreTrackingFilter) ?? '';
    this.languageCourseStatusFilter =
      this.normalizeLanguageCourseStatusValue(persisted.languageCourseStatusFilter) ?? '';
    this.ossltResultFilter = this.normalizeOssltResultValue(persisted.ossltResultFilter) ?? '';
    this.ossltTrackingFilter =
      this.normalizeOssltTrackingStatusValue(persisted.ossltTrackingFilter) ?? '';
    this.volunteerCompletedFilter = this.normalizePreferenceBoolean(
      persisted.volunteerCompletedFilter
    );
  }

  private persistListControlsPreference(): void {
    try {
      const storage = (globalThis as { localStorage?: Storage }).localStorage;
      if (!storage) return;
      const payload: StudentListFilterPreferenceVm = {
        listLimit: this.listLimit,
        showInactive: this.showInactive,
        searchKeyword: this.searchKeyword,
        countryFilterInput: this.countryFilterInput,
        countryFilter: this.countryFilter,
        provinceFilterInput: this.provinceFilterInput,
        provinceFilter: this.provinceFilter,
        cityFilterInput: this.cityFilterInput,
        cityFilter: this.cityFilter,
        schoolBoardFilterInput: this.schoolBoardFilterInput,
        schoolBoardFilter: this.schoolBoardFilter,
        graduationSeasonFilterInput: this.graduationSeasonFilterInput,
        graduationSeasonFilter: this.graduationSeasonFilter,
        languageScoreFilter: this.languageScoreFilter,
        languageScoreTrackingFilter: this.languageScoreTrackingFilter,
        languageCourseStatusFilter: this.languageCourseStatusFilter,
        ossltResultFilter: this.ossltResultFilter,
        ossltTrackingFilter: this.ossltTrackingFilter,
        volunteerCompletedFilter: this.volunteerCompletedFilter,
      };
      storage.setItem(this.resolveListControlsStorageKey(), JSON.stringify(payload));
    } catch {}
  }

  private readListControlsPreference(): StudentListFilterPreferenceVm | null {
    try {
      const storage = (globalThis as { localStorage?: Storage }).localStorage;
      if (!storage) return null;
      const raw = storage.getItem(this.resolveListControlsStorageKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed as StudentListFilterPreferenceVm;
    } catch {
      return null;
    }
  }

  private normalizeListLimitPreference(value: unknown): number {
    const numeric = Math.trunc(Number(value));
    if (!Number.isFinite(numeric)) {
      return 20;
    }
    return this.limitOptions.includes(numeric) ? numeric : 20;
  }

  private normalizePreferenceBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) && value > 0;
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase();
    if (!normalized) return false;
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }

  private resolvePageContext(): StudentManagementPageContext {
    const url = String(this.router.url || (globalThis as { location?: Location }).location?.pathname || '')
      .trim()
      .toLowerCase();
    if (url.startsWith('/teacher/ielts')) {
      return 'ielts';
    }
    if (url.startsWith('/teacher/osslt')) {
      return 'osslt';
    }
    if (url.startsWith('/teacher/volunteer')) {
      return 'volunteer';
    }
    return 'students';
  }

  private resolveVisibleColumnsPreferencePageKey(): string {
    return STUDENT_LIST_COLUMN_PREFERENCE_PAGE_KEY_BY_CONTEXT[this.resolvePageContext()];
  }

  private isColumnAllowedForCurrentContext(columnKey: StudentListColumnKey): boolean {
    void columnKey;
    return true;
  }

  private sanitizeVisibleColumnKeysForCurrentContext(
    keys: Set<StudentListColumnKey>
  ): Set<StudentListColumnKey> {
    const sanitized = new Set<StudentListColumnKey>();
    for (const key of keys.values()) {
      if (this.isColumnAllowedForCurrentContext(key)) {
        sanitized.add(key);
      }
    }
    return sanitized;
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
        const remoteVersion = String(payload?.version ?? '').trim();
        if (remoteVersion !== STUDENT_LIST_COLUMN_PREFERENCE_VERSION) {
          this.syncVisibleColumnsPreferenceToServer();
          return;
        }

        const remoteOrderedKeys = Array.isArray(payload?.orderedColumnKeys)
          ? payload.orderedColumnKeys.map((key) => String(key ?? '').trim()).filter(Boolean)
          : [];
        const remoteKeys = Array.isArray(payload?.visibleColumnKeys)
          ? payload.visibleColumnKeys.map((key) => String(key ?? '').trim())
          : [];
        if (remoteOrderedKeys.length > 0) {
          this.columnOrderKeys = this.normalizeColumnOrderKeys(remoteOrderedKeys);
        }

        if (remoteKeys.length > 0) {
          const normalized = this.normalizeVisibleColumnKeys(remoteKeys);
          if (normalized.size > 0) {
            this.visibleColumnKeys = this.sanitizeVisibleColumnKeysForCurrentContext(
              this.applyIndependentColumnOverrides(normalized)
            );
          }
        }
        this.persistIndependentColumnOverrides();
        this.persistVisibleColumnsPreference();
        this.hydrateStudentMetadata(this.students);
        if (this.visibleColumnKeys.has('teacherNote')) {
          this.prefetchVisibleTeacherNotes();
        }
        if (this.visibleColumnKeys.has('serviceItems')) {
          this.prefetchVisibleServiceItems();
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
      orderedColumnKeys: this.normalizeColumnOrderKeys(this.columnOrderKeys),
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
      !this.graduationSeasonFilterInput.trim() &&
      !this.languageScoreFilter &&
      !this.languageScoreTrackingFilter &&
      !this.languageCourseStatusFilter &&
      !this.ossltResultFilter &&
      !this.ossltTrackingFilter &&
      !this.volunteerCompletedFilter
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
    this.languageScoreFilter = '';
    this.languageScoreTrackingFilter = '';
    this.languageCourseStatusFilter = '';
    this.ossltResultFilter = '';
    this.ossltTrackingFilter = '';
    this.volunteerCompletedFilter = false;
    this.applyListView();
  }

  toggleInactiveVisibility(): void {
    this.showInactive = !this.showInactive;
    this.applyListView();
  }

  applyListView(): void {
    this.prefetchStatusDataForActiveFilters();
    const filtered = this.students.filter((student) => this.matchesListFilters(student));

    this.filteredCount = filtered.length;
    this.visibleStudents = filtered.slice(0, this.listLimit);
    this.persistListControlsPreference();
    if (this.visibleColumnKeys.has('teacherNote')) {
      this.prefetchVisibleTeacherNotes();
    }
    if (this.visibleColumnKeys.has('serviceItems')) {
      this.prefetchVisibleServiceItems();
    }
    if (this.visibleColumnKeys.has('ielts') || this.visibleColumnKeys.has('languageTracking')) {
      this.prefetchVisibleIeltsStatuses();
    }
    if (this.visibleColumnKeys.has('ossltResult') || this.visibleColumnKeys.has('ossltTracking')) {
      this.prefetchVisibleOssltStatuses();
    }
    if (this.visibleColumnKeys.has('volunteerTracking')) {
      this.prefetchVisibleVolunteerHours();
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

    if (this.languageScoreFilter) {
      const studentLanguageScoreStatus = this.resolveIeltsTrackingStatusForFilter(student);
      if (studentLanguageScoreStatus !== this.languageScoreFilter) {
        return false;
      }
    }

    if (this.languageScoreTrackingFilter) {
      const studentLanguageTrackingStatus = this.resolveLanguageTrackingStatusForFilter(student);
      if (studentLanguageTrackingStatus !== this.languageScoreTrackingFilter) {
        return false;
      }
    }

    if (this.languageCourseStatusFilter) {
      const studentLanguageCourseStatus = this.resolveLanguageCourseStatusForFilter(student);
      if (studentLanguageCourseStatus !== this.languageCourseStatusFilter) {
        return false;
      }
    }

    if (this.ossltResultFilter) {
      const studentOssltResult = this.resolveOssltResultForFilter(student);
      if (studentOssltResult !== this.ossltResultFilter) {
        return false;
      }
    }

    if (this.ossltTrackingFilter) {
      const studentOssltTrackingStatus = this.resolveOssltTrackingStatusForFilter(student);
      if (studentOssltTrackingStatus !== this.ossltTrackingFilter) {
        return false;
      }
    }

    if (this.volunteerCompletedFilter) {
      const volunteerCompleted = this.resolveVolunteerCompletedForFilter(student);
      if (volunteerCompleted === false) {
        return false;
      }
      if (volunteerCompleted === null) {
        const volunteerHours = this.resolveVolunteerHours(student);
        if (volunteerHours === null || volunteerHours < 40) {
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
      this.resolveMotherLanguageValue(student),
      this.resolveCurrentSchoolBoardValue(student),
      this.resolveCurrentSchoolCountryValue(student),
      this.resolveCurrentSchoolProvinceValue(student),
      this.resolveCurrentSchoolCityValue(student),
      this.resolveStudentLanguageCourseStatus(student),
    ];

    return searchFields.some((field) => field.toLowerCase().includes(keyword));
  }

  private prefetchStatusDataForActiveFilters(): void {
    if (
      this.languageScoreFilter ||
      this.languageScoreTrackingFilter ||
      this.languageCourseStatusFilter
    ) {
      this.prefetchIeltsStatusesForStudents(this.students, true);
    }
    if (this.ossltResultFilter || this.ossltTrackingFilter) {
      this.prefetchOssltStatusesForStudents(this.students, true);
    }
    if (this.volunteerCompletedFilter && this.volunteerCompletedFilterAvailable) {
      if (!this.hasVolunteerSummaryForAllStudents()) {
        this.prefetchVolunteerHoursForStudents(this.students, true);
      }
    }
  }

  private hasVolunteerSummaryForAllStudents(): boolean {
    if (this.students.length <= 0) {
      return false;
    }
    for (const student of this.students) {
      const studentId = this.resolveStudentId(student);
      if (studentId && this.volunteerCompletedCache.has(studentId)) {
        continue;
      }
      if (this.resolveVolunteerHours(student) !== null) {
        continue;
      }
      if (this.extractVolunteerCompletedFromStudent(student) !== null) {
        continue;
      }
      return false;
    }
    return true;
  }

  private resolveIeltsTrackingStatusForFilter(student: StudentAccount): IeltsTrackingStatus | null {
    const studentId = this.resolveStudentId(student);
    if (studentId) {
      const cached = this.ieltsStatusCache.get(studentId);
      if (cached) return cached;
    }

    const statusFromRow = this.extractIeltsTrackingStatusFromStudent(student);
    if (studentId && statusFromRow) {
      this.ieltsStatusCache.set(studentId, statusFromRow);
      this.ieltsStatusUnavailable.delete(studentId);
    }
    return statusFromRow;
  }

  private resolveLanguageTrackingStatusForFilter(student: StudentAccount): LanguageTrackingStatus | null {
    const studentId = this.resolveStudentId(student);
    if (studentId) {
      const cached = this.languageTrackingStatusCache.get(studentId);
      if (cached) return cached;
    }

    const statusFromRow = this.extractLanguageTrackingStatusFromStudent(student);
    if (studentId && statusFromRow) {
      this.languageTrackingStatusCache.set(studentId, statusFromRow);
      this.ieltsStatusUnavailable.delete(studentId);
    }
    return statusFromRow;
  }

  private resolveLanguageCourseStatusForFilter(student: StudentAccount): LanguageCourseStatus | null {
    const studentId = this.resolveStudentId(student);
    if (studentId) {
      const cached = this.languageCourseStatusCache.get(studentId);
      if (cached) return cached;
    }

    const statusFromRow = this.extractLanguageCourseStatusFromStudent(student);
    if (studentId && statusFromRow) {
      this.languageCourseStatusCache.set(studentId, statusFromRow);
      this.ieltsStatusUnavailable.delete(studentId);
    }
    return statusFromRow;
  }

  private resolveOssltResultForFilter(student: StudentAccount): OssltResult | null {
    const studentId = this.resolveStudentId(student);
    if (studentId) {
      const cached = this.ossltResultCache.get(studentId);
      if (cached) return cached;
    }

    const resultFromRow = this.extractOssltResultFromStudent(student);
    if (studentId && resultFromRow) {
      this.ossltResultCache.set(studentId, resultFromRow);
      this.ossltStatusUnavailable.delete(studentId);
    }
    return resultFromRow;
  }

  private resolveOssltTrackingStatusForFilter(student: StudentAccount): OssltTrackingStatus | null {
    const studentId = this.resolveStudentId(student);
    if (studentId) {
      const cached = this.ossltTrackingStatusCache.get(studentId);
      if (cached) return cached;
    }

    const statusFromRow = this.extractOssltTrackingStatusFromStudent(student);
    if (studentId && statusFromRow) {
      this.ossltTrackingStatusCache.set(studentId, statusFromRow);
      this.ossltStatusUnavailable.delete(studentId);
    }
    return statusFromRow;
  }

  private resolveVolunteerHours(student: StudentAccount): number | null {
    const studentId = this.resolveStudentId(student);
    if (studentId && this.volunteerHoursCache.has(studentId)) {
      return this.volunteerHoursCache.get(studentId) ?? null;
    }

    const hours = this.extractVolunteerHoursFromStudent(student);
    if (hours === null) return null;

    const normalizedHours = Math.round(hours * 100) / 100;
    if (studentId) {
      this.volunteerHoursCache.set(studentId, normalizedHours);
      this.volunteerHoursUnavailable.delete(studentId);
    }
    return normalizedHours;
  }

  private resolveVolunteerCompletedForFilter(student: StudentAccount): boolean | null {
    const studentId = this.resolveStudentId(student);
    if (studentId && this.volunteerCompletedCache.has(studentId)) {
      return this.volunteerCompletedCache.get(studentId) ?? null;
    }

    const completed = this.extractVolunteerCompletedFromStudent(student);
    if (completed !== null) {
      if (studentId) {
        this.volunteerCompletedCache.set(studentId, completed);
      }
      return completed;
    }

    const hours = this.resolveVolunteerHours(student);
    if (hours === null) {
      return null;
    }
    const derived = hours >= 40;
    if (studentId) {
      this.volunteerCompletedCache.set(studentId, derived);
    }
    return derived;
  }

  private extractVolunteerCompletedFromStudent(student: StudentAccount): boolean | null {
    const row = (student ?? {}) as Record<string, unknown>;
    const volunteerNode =
      this.asObjectRecord(row['volunteerTracking']) ||
      this.asObjectRecord(row['volunteer']) ||
      this.asObjectRecord(row['volunteerModule']) ||
      this.asObjectRecord(row['volunteerSummary']);
    const summaryNode =
      this.asObjectRecord(volunteerNode?.['summary']) || this.asObjectRecord(row['summary']);

    const candidates: unknown[] = [
      row['volunteerCompleted'],
      row['volunteer_completed'],
      volunteerNode?.['volunteerCompleted'],
      volunteerNode?.['volunteer_completed'],
      summaryNode?.['volunteerCompleted'],
      summaryNode?.['volunteer_completed'],
    ];

    for (const candidate of candidates) {
      const parsed = this.parseVolunteerCompletedCandidate(candidate);
      if (parsed !== null) {
        return parsed;
      }
    }
    return null;
  }

  private parseVolunteerCompletedCandidate(value: unknown): boolean | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return null;
      return value > 0;
    }

    const normalized = String(value ?? '')
      .trim()
      .toLowerCase();
    if (!normalized) return null;
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
    return null;
  }

  private extractVolunteerHoursFromStudent(student: StudentAccount): number | null {
    const row = (student ?? {}) as Record<string, unknown>;
    const volunteerNode =
      this.asObjectRecord(row['volunteerTracking']) ||
      this.asObjectRecord(row['volunteer']) ||
      this.asObjectRecord(row['volunteerModule']) ||
      this.asObjectRecord(row['volunteerSummary']);
    const summaryNode =
      this.asObjectRecord(volunteerNode?.['summary']) || this.asObjectRecord(row['summary']);

    const candidates: unknown[] = [
      row['volunteerHours'],
      row['volunteer_hours'],
      row['totalVolunteerHours'],
      row['total_volunteer_hours'],
      row['volunteerDurationHours'],
      row['volunteer_duration_hours'],
      row['volunteerTotalHours'],
      row['volunteer_total_hours'],
      row['volunteerTrackingHours'],
      row['volunteer_tracking_hours'],
      row['hours'],
      row['totalHours'],
      row['total_hours'],
      volunteerNode?.['volunteerHours'],
      volunteerNode?.['volunteer_hours'],
      volunteerNode?.['totalVolunteerHours'],
      volunteerNode?.['total_volunteer_hours'],
      volunteerNode?.['totalHours'],
      volunteerNode?.['total_hours'],
      volunteerNode?.['hours'],
      summaryNode?.['volunteerHours'],
      summaryNode?.['volunteer_hours'],
      summaryNode?.['totalVolunteerHours'],
      summaryNode?.['total_volunteer_hours'],
      summaryNode?.['totalHours'],
      summaryNode?.['total_hours'],
      summaryNode?.['hours'],
    ];

    for (const candidate of candidates) {
      const parsed = this.parseVolunteerHoursCandidate(candidate);
      if (parsed !== null) return parsed;
    }
    return null;
  }

  private parseVolunteerHoursCandidate(value: unknown): number | null {
    if (value === null || value === undefined) return null;

    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value < 0) return null;
      return value;
    }

    if (typeof value === 'string') {
      const rawText = value.trim();
      if (!rawText) return null;
      const matched = rawText.match(/-?\d+(?:\.\d+)?/);
      if (!matched) return null;
      const parsed = Number(matched[0]);
      if (!Number.isFinite(parsed) || parsed < 0) return null;
      return parsed;
    }

    const node = this.asObjectRecord(value);
    if (!node) return null;

    const objectCandidates: unknown[] = [
      node['value'],
      node['hours'],
      node['totalHours'],
      node['total_hours'],
      node['volunteerHours'],
      node['volunteer_hours'],
      node['totalVolunteerHours'],
      node['total_volunteer_hours'],
      node['durationHours'],
      node['duration_hours'],
    ];
    for (const candidate of objectCandidates) {
      const parsed = this.parseVolunteerHoursCandidate(candidate);
      if (parsed !== null) return parsed;
    }
    return null;
  }

  private extractIeltsTrackingStatusFromStudent(student: StudentAccount): IeltsTrackingStatus | null {
    const row = (student ?? {}) as Record<string, unknown>;
    const ieltsNode =
      this.asObjectRecord(row['ieltsModule']) ||
      this.asObjectRecord(row['ielts']) ||
      this.asObjectRecord(row['ieltsData']);
    const summaryNode =
      this.asObjectRecord(row['ieltsSummary']) ||
      this.asObjectRecord(ieltsNode?.['summary']) ||
      this.asObjectRecord(row['summary']);

    const candidates: unknown[] = [
      row['ieltsTrackingStatus'],
      row['ielts_tracking_status'],
      row['trackingStatus'],
      row['tracking_status'],
      ieltsNode?.['trackingStatus'],
      ieltsNode?.['tracking_status'],
      summaryNode?.['trackingStatus'],
      summaryNode?.['tracking_status'],
    ];

    for (const candidate of candidates) {
      const normalized = this.normalizeIeltsTrackingStatusValue(candidate);
      if (normalized) return normalized;
    }
    return null;
  }

  private extractLanguageTrackingStatusFromStudent(
    student: StudentAccount
  ): LanguageTrackingStatus | null {
    const row = (student ?? {}) as Record<string, unknown>;
    const ieltsNode =
      this.asObjectRecord(row['ieltsModule']) ||
      this.asObjectRecord(row['ielts']) ||
      this.asObjectRecord(row['ieltsData']);
    const summaryNode =
      this.asObjectRecord(row['ieltsSummary']) ||
      this.asObjectRecord(ieltsNode?.['summary']) ||
      this.asObjectRecord(row['summary']);

    const candidates: unknown[] = [
      row['languageScoreTrackingStatus'],
      row['language_score_tracking_status'],
      row['languageTrackingStatus'],
      row['language_tracking_status'],
      row['languageScoreTrackingManualStatus'],
      row['language_score_tracking_manual_status'],
      row['languageTrackingManualStatus'],
      row['language_tracking_manual_status'],
      ieltsNode?.['languageScoreTrackingStatus'],
      ieltsNode?.['language_score_tracking_status'],
      ieltsNode?.['languageTrackingStatus'],
      ieltsNode?.['language_tracking_status'],
      ieltsNode?.['languageScoreTrackingManualStatus'],
      ieltsNode?.['language_score_tracking_manual_status'],
      ieltsNode?.['languageTrackingManualStatus'],
      ieltsNode?.['language_tracking_manual_status'],
      summaryNode?.['languageScoreTrackingStatus'],
      summaryNode?.['language_score_tracking_status'],
      summaryNode?.['languageTrackingStatus'],
      summaryNode?.['language_tracking_status'],
    ];

    for (const candidate of candidates) {
      const normalized = this.normalizeLanguageTrackingStatusValue(candidate);
      if (normalized) return normalized;
    }
    return null;
  }

  private extractLanguageCourseStatusFromStudent(
    student: StudentAccount
  ): LanguageCourseStatus | null {
    const row = (student ?? {}) as Record<string, unknown>;
    const ieltsNode =
      this.asObjectRecord(row['ieltsModule']) ||
      this.asObjectRecord(row['ielts']) ||
      this.asObjectRecord(row['ieltsData']);
    const summaryNode =
      this.asObjectRecord(row['ieltsSummary']) ||
      this.asObjectRecord(ieltsNode?.['summary']) ||
      this.asObjectRecord(row['summary']);

    const candidates: unknown[] = [
      row['languageCourseStatus'],
      row['language_course_status'],
      row['languageCourseEnrollmentStatus'],
      row['language_course_enrollment_status'],
      ieltsNode?.['languageCourseStatus'],
      ieltsNode?.['language_course_status'],
      ieltsNode?.['languageCourseEnrollmentStatus'],
      ieltsNode?.['language_course_enrollment_status'],
      summaryNode?.['languageCourseStatus'],
      summaryNode?.['language_course_status'],
      summaryNode?.['languageCourseEnrollmentStatus'],
      summaryNode?.['language_course_enrollment_status'],
    ];

    for (const candidate of candidates) {
      const normalized = this.normalizeLanguageCourseStatusValue(candidate);
      if (normalized) return normalized;
    }
    return null;
  }

  private extractLanguageCourseStatusFromModuleState(
    moduleState: StudentIeltsModuleState
  ): LanguageCourseStatus | null {
    const state = (moduleState ?? {}) as unknown as Record<string, unknown>;
    return this.normalizeLanguageCourseStatusValue(
      state['languageCourseStatus'] ?? state['languageCourseEnrollmentStatus']
    );
  }

  private extractOssltResultFromStudent(student: StudentAccount): OssltResult | null {
    const row = (student ?? {}) as Record<string, unknown>;
    const ossltNode =
      this.asObjectRecord(row['ossltModule']) ||
      this.asObjectRecord(row['osslt']) ||
      this.asObjectRecord(row['ossltData']);
    const summaryNode =
      this.asObjectRecord(row['ossltSummary']) ||
      this.asObjectRecord(ossltNode?.['summary']) ||
      this.asObjectRecord(row['summary']);

    const candidates: unknown[] = [
      row['latestOssltResult'],
      row['latest_osslt_result'],
      row['ossltResult'],
      row['osslt_result'],
      row['result'],
      ossltNode?.['latestOssltResult'],
      ossltNode?.['latest_osslt_result'],
      ossltNode?.['ossltResult'],
      ossltNode?.['osslt_result'],
      summaryNode?.['latestOssltResult'],
      summaryNode?.['latest_osslt_result'],
      summaryNode?.['latestOssltResultStatus'],
      summaryNode?.['latest_osslt_result_status'],
    ];

    for (const candidate of candidates) {
      const normalized = this.normalizeOssltResultValue(candidate);
      if (normalized) return normalized;
    }
    return null;
  }

  private extractOssltTrackingStatusFromStudent(student: StudentAccount): OssltTrackingStatus | null {
    const row = (student ?? {}) as Record<string, unknown>;
    const ossltNode =
      this.asObjectRecord(row['ossltModule']) ||
      this.asObjectRecord(row['osslt']) ||
      this.asObjectRecord(row['ossltData']);
    const summaryNode =
      this.asObjectRecord(row['ossltSummary']) ||
      this.asObjectRecord(ossltNode?.['summary']) ||
      this.asObjectRecord(row['summary']);

    const candidates: unknown[] = [
      row['ossltTrackingStatus'],
      row['osslt_tracking_status'],
      row['ossltTrackingManualStatus'],
      row['osslt_tracking_manual_status'],
      row['trackingStatus'],
      row['tracking_status'],
      ossltNode?.['ossltTrackingStatus'],
      ossltNode?.['osslt_tracking_status'],
      ossltNode?.['ossltTrackingManualStatus'],
      ossltNode?.['osslt_tracking_manual_status'],
      ossltNode?.['trackingStatus'],
      ossltNode?.['tracking_status'],
      summaryNode?.['ossltTrackingStatus'],
      summaryNode?.['osslt_tracking_status'],
      summaryNode?.['trackingStatus'],
      summaryNode?.['tracking_status'],
    ];

    for (const candidate of candidates) {
      const normalized = this.normalizeOssltTrackingStatusValue(candidate);
      if (normalized) return normalized;
    }
    return null;
  }

  private asObjectRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
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
      const motherLanguage = this.resolveMotherLanguageValue(student);
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
        motherLanguage: motherLanguage || undefined,
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
      this.visibleColumnKeys.has('firstLanguage') ||
      this.visibleColumnKeys.has('motherLanguage');

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
            cached.firstLanguage &&
            cached.motherLanguage
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
      const motherLanguage = this.resolveMotherLanguageValue(student);
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
          firstLanguage &&
          motherLanguage
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
          motherLanguage,
          currentSchoolCountry,
          currentSchoolProvince,
          currentSchoolCity,
          currentSchoolBoard,
          currentSchoolExpectedGraduation,
        });
        continue;
      }

      const cachedProfile = this.studentProfileCache.get(studentId);
      if (cachedProfile) {
        this.cacheStudentProfilePayload(studentId, cachedProfile);
        const metadata = this.extractStudentMetadataFromProfile(cachedProfile);
        if (
          metadata.email ||
          metadata.phone ||
          metadata.schoolName ||
          metadata.canadaIdentity ||
          metadata.gender ||
          metadata.nationality ||
          metadata.firstLanguage ||
          metadata.motherLanguage ||
          metadata.currentSchoolCountry ||
          metadata.currentSchoolProvince ||
          metadata.currentSchoolCity ||
          metadata.currentSchoolBoard ||
          metadata.currentSchoolExpectedGraduation
        ) {
          this.studentContactCache.set(studentId, metadata);
          this.applyStudentMetadata(student, metadata);
        }
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
            this.cacheStudentProfilePayload(studentId, payload);
            if (
              !metadata.email &&
              !metadata.phone &&
              !metadata.schoolName &&
              !metadata.canadaIdentity &&
              !metadata.gender &&
              !metadata.nationality &&
              !metadata.firstLanguage &&
              !metadata.motherLanguage &&
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

  private resolveIeltsStatusDisplayModel(studentId: number | null): IeltsStatusDisplayModel {
    if (!studentId) {
      return resolveIeltsStatusDisplay({ isUnavailable: true });
    }

    if (this.ieltsNoRequirement.has(studentId)) {
      return resolveIeltsStatusDisplay({ shouldShowModule: false });
    }

    const trackingStatus = this.ieltsStatusCache.get(studentId);
    if (trackingStatus) {
      return resolveIeltsStatusDisplay({
        trackingStatus,
        shouldShowModule: true,
        colorToken: this.ieltsStatusColorTokenCache.get(studentId) || null,
      });
    }

    if (this.ieltsStatusLoadInFlight.has(studentId)) {
      return resolveIeltsStatusDisplay({ isLoading: true });
    }

    if (this.ieltsStatusUnavailable.has(studentId)) {
      return resolveIeltsStatusDisplay({ isUnavailable: true });
    }

    return resolveIeltsStatusDisplay({ isLoading: true });
  }

  private resolveOssltTrackingOptionLabel(status: TrackingManualStatusOption): string {
    const normalized = String(status || '').trim().toUpperCase();
    if (normalized === 'PASSED') return '已通过';
    if (normalized === 'WAITING_UPDATE') return '等待更新';
    if (normalized === 'NEEDS_TRACKING') return '需要跟进';
    return '未设置';
  }

  private resolveOssltResultLabel(studentId: number | null): string {
    return this.resolveOssltResultDisplayModel(studentId).label;
  }

  private resolveOssltResultBackground(studentId: number | null): string {
    return this.resolveOssltResultDisplayModel(studentId).background;
  }

  private resolveOssltResultTextColor(studentId: number | null): string {
    return this.resolveOssltResultDisplayModel(studentId).textColor;
  }

  private resolveOssltResultBorderColor(studentId: number | null): string {
    return this.resolveOssltResultDisplayModel(studentId).borderColor;
  }

  private resolveOssltResultDisplayModel(studentId: number | null): {
    label: string;
    background: string;
    textColor: string;
    borderColor: string;
  } {
    if (!studentId) {
      return {
        label: '不可用',
        background: '#f1f3f5',
        textColor: '#6a7385',
        borderColor: '#c8cfda',
      };
    }

    const result = this.ossltResultCache.get(studentId);
    if (result === 'PASS') {
      return {
        label: '已通过',
        background: '#e7f6ec',
        textColor: '#2f6b43',
        borderColor: '#8fc8a3',
      };
    }
    if (result === 'FAIL') {
      return {
        label: '未通过',
        background: '#fff2d8',
        textColor: '#8a5a00',
        borderColor: '#e3c77a',
      };
    }

    const trackingStatus = this.ossltTrackingStatusCache.get(studentId);
    if (trackingStatus) {
      const trackingDisplay = resolveOssltStatusDisplay({ status: trackingStatus });
      return {
        label: trackingDisplay.label,
        background: trackingDisplay.background,
        textColor: trackingDisplay.textColor,
        borderColor: trackingDisplay.borderColor,
      };
    }

    if (this.ossltStatusLoadInFlight.has(studentId)) {
      return {
        label: '加载中...',
        background: '#edf2fb',
        textColor: '#4a5f82',
        borderColor: '#9fb4d8',
      };
    }

    if (this.ossltStatusUnavailable.has(studentId)) {
      return {
        label: '不可用',
        background: '#f1f3f5',
        textColor: '#6a7385',
        borderColor: '#c8cfda',
      };
    }

    return {
      label: '待更新',
      background: '#edf2fb',
      textColor: '#4a5f82',
      borderColor: '#9fb4d8',
    };
  }

  private resolveLanguageTrackingStatusDisplayModel(
    studentId: number | null
  ): LanguageTrackingStatusDisplay {
    if (!studentId) {
      return resolveLanguageTrackingStatusDisplay({ isUnavailable: true });
    }

    const status = this.languageTrackingStatusCache.get(studentId);
    if (status) {
      return resolveLanguageTrackingStatusDisplay({ status });
    }

    if (this.ieltsStatusLoadInFlight.has(studentId)) {
      return resolveLanguageTrackingStatusDisplay({ isLoading: true });
    }

    if (this.ieltsStatusUnavailable.has(studentId)) {
      return resolveLanguageTrackingStatusDisplay({ isUnavailable: true });
    }

    return resolveLanguageTrackingStatusDisplay({ isLoading: true });
  }

  private resolveOssltTrackingStatusDisplayModel(studentId: number | null): LanguageTrackingStatusDisplay {
    if (!studentId) {
      return resolveOssltStatusDisplay({ isUnavailable: true }) as unknown as LanguageTrackingStatusDisplay;
    }

    const status = this.ossltTrackingStatusCache.get(studentId);
    if (status) {
      return resolveOssltStatusDisplay({ status }) as unknown as LanguageTrackingStatusDisplay;
    }

    if (this.ossltStatusLoadInFlight.has(studentId)) {
      return resolveOssltStatusDisplay({ isLoading: true }) as unknown as LanguageTrackingStatusDisplay;
    }

    if (this.ossltStatusUnavailable.has(studentId)) {
      return resolveOssltStatusDisplay({ isUnavailable: true }) as unknown as LanguageTrackingStatusDisplay;
    }

    return resolveOssltStatusDisplay({ isLoading: true }) as unknown as LanguageTrackingStatusDisplay;
  }

  private normalizeIeltsTrackingStatusValue(value: unknown): IeltsTrackingStatus | null {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'GREEN_STRICT_PASS') return 'GREEN_STRICT_PASS';
    if (normalized === 'GREEN_COMMON_PASS_WITH_WARNING') return 'GREEN_COMMON_PASS_WITH_WARNING';
    if (normalized === 'YELLOW_NEEDS_PREPARATION') return 'YELLOW_NEEDS_PREPARATION';
    return null;
  }

  private normalizeLanguageTrackingStatusValue(value: unknown): LanguageTrackingStatus | null {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'TEACHER_REVIEW_APPROVED') return 'TEACHER_REVIEW_APPROVED';
    if (normalized === 'AUTO_PASS_ALL_SCHOOLS') return 'AUTO_PASS_ALL_SCHOOLS';
    if (normalized === 'AUTO_PASS_PARTIAL_SCHOOLS') return 'AUTO_PASS_PARTIAL_SCHOOLS';
    if (normalized === 'NEEDS_TRACKING') return 'NEEDS_TRACKING';
    return null;
  }

  private normalizeLanguageCourseStatusValue(value: unknown): LanguageCourseStatus | null {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'NOT_RECEIVED_TRAINING' || normalized === '1') {
      return 'NOT_RECEIVED_TRAINING';
    }
    if (normalized === 'ENROLLED_GLOBAL_IELTS' || normalized === '2') {
      return 'ENROLLED_GLOBAL_IELTS';
    }
    if (normalized === 'ENROLLED_OTHER_IELTS' || normalized === '3') {
      return 'ENROLLED_OTHER_IELTS';
    }
    if (normalized === 'COURSE_COMPLETED_NOT_EXAMINED' || normalized === '4') {
      return 'COURSE_COMPLETED_NOT_EXAMINED';
    }
    if (normalized === 'EXAM_REGISTERED' || normalized === '5') {
      return 'EXAM_REGISTERED';
    }
    if (normalized === 'SCORE_RELEASED' || normalized === '6') {
      return 'SCORE_RELEASED';
    }
    return null;
  }

  private normalizeOssltResultValue(value: unknown): OssltResult | null {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'PASS') return 'PASS';
    if (normalized === 'FAIL') return 'FAIL';
    if (normalized === 'UNKNOWN') return 'UNKNOWN';
    return null;
  }

  private normalizeOssltTrackingStatusValue(value: unknown): OssltTrackingStatus | null {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'WAITING_UPDATE') return 'WAITING_UPDATE';
    if (normalized === 'NEEDS_TRACKING') return 'NEEDS_TRACKING';
    if (normalized === 'PASSED') return 'PASSED';
    return null;
  }

  private scheduleStatusFilterReapply(): void {
    if (
      !this.languageScoreFilter &&
      !this.languageScoreTrackingFilter &&
      !this.languageCourseStatusFilter &&
      !this.ossltResultFilter &&
      !this.ossltTrackingFilter &&
      !this.volunteerCompletedFilter
    ) {
      return;
    }

    if (this.statusFilterReapplyTimer) {
      return;
    }

    this.statusFilterReapplyTimer = setTimeout(() => {
      this.statusFilterReapplyTimer = null;
      this.applyListView();
      this.cdr.detectChanges();
    }, 0);
  }

  private shouldRetryLanguageTrackingSave(err: HttpErrorResponse): boolean {
    const status = Number(err?.status);
    if (status === 403) {
      return false;
    }

    const message = this.extractErrorMessage(err).toLowerCase();
    const isValidationLike =
      message.includes('validation') || message.includes('invalid') || message.includes('failed');
    if (!isValidationLike) {
      return false;
    }

    return status === 400 || status === 422;
  }

  private buildLanguageTrackingRetryPayload(
    state: StudentIeltsModuleState,
    nextStatus: LanguageTrackingStatus
  ): UpdateStudentIeltsPayload {
    const hasTaken = state.hasTakenIeltsAcademic;
    const languageScoreTypeText = String(state.languageScoreType ?? '')
      .trim()
      .toUpperCase();
    const languageScoreType =
      languageScoreTypeText === 'TOEFL'
        ? 'TOEFL'
        : languageScoreTypeText === 'DUOLINGO'
          ? 'DUOLINGO'
          : languageScoreTypeText === 'OTHER'
            ? 'OTHER'
            : 'IELTS';
    const records: IeltsRecordFormValue[] = Array.isArray(state.records) ? state.records : [];
    const prepText = String(state.preparationIntent ?? '').trim().toUpperCase();
    const preparationIntent: 'PREPARING' | 'NOT_PREPARING' | 'UNSET' =
      prepText === 'PREPARING' || prepText === 'NOT_PREPARING'
        ? (prepText as 'PREPARING' | 'NOT_PREPARING')
        : 'UNSET';

    if (hasTaken === true) {
      const payload: UpdateStudentIeltsPayload = {
        languageScoreType,
        hasTakenIeltsAcademic: true,
        languageTrackingManualStatus: nextStatus,
      };
      if (records.length > 0) {
        payload.records = records;
      }
      return payload;
    }

    if (hasTaken === false) {
      return {
        languageScoreType,
        hasTakenIeltsAcademic: false,
        preparationIntent: preparationIntent === 'UNSET' ? 'PREPARING' : preparationIntent,
        languageTrackingManualStatus: nextStatus,
      };
    }

    return {
      languageScoreType,
      languageTrackingManualStatus: nextStatus,
    };
  }

  private buildLanguageCourseStatusRetryPayload(
    state: StudentIeltsModuleState,
    nextStatus: LanguageCourseStatus
  ): UpdateStudentIeltsPayload {
    const hasTaken = state.hasTakenIeltsAcademic;
    const languageScoreTypeText = String(state.languageScoreType ?? '')
      .trim()
      .toUpperCase();
    const languageScoreType =
      languageScoreTypeText === 'TOEFL'
        ? 'TOEFL'
        : languageScoreTypeText === 'DUOLINGO'
          ? 'DUOLINGO'
          : languageScoreTypeText === 'OTHER'
            ? 'OTHER'
            : 'IELTS';
    const records: IeltsRecordFormValue[] = Array.isArray(state.records) ? state.records : [];
    const prepText = String(state.preparationIntent ?? '').trim().toUpperCase();
    const preparationIntent: 'PREPARING' | 'NOT_PREPARING' | 'UNSET' =
      prepText === 'PREPARING' || prepText === 'NOT_PREPARING'
        ? (prepText as 'PREPARING' | 'NOT_PREPARING')
        : 'UNSET';
    const fallbackTrackingStatus = this.normalizeLanguageTrackingStatusValue(
      state.languageScoreTrackingManualStatus ?? state.languageTrackingManualStatus
    );

    if (hasTaken === true) {
      const payload: UpdateStudentIeltsPayload = {
        languageScoreType,
        hasTakenIeltsAcademic: true,
        languageCourseStatus: nextStatus,
      };
      if (fallbackTrackingStatus) {
        payload.languageTrackingManualStatus = fallbackTrackingStatus;
      }
      if (records.length > 0) {
        payload.records = records;
      }
      return payload;
    }

    if (hasTaken === false) {
      const payload: UpdateStudentIeltsPayload = {
        languageScoreType,
        hasTakenIeltsAcademic: false,
        preparationIntent: preparationIntent === 'UNSET' ? 'PREPARING' : preparationIntent,
        languageCourseStatus: nextStatus,
      };
      if (fallbackTrackingStatus) {
        payload.languageTrackingManualStatus = fallbackTrackingStatus;
      }
      return payload;
    }

    const payload: UpdateStudentIeltsPayload = {
      languageScoreType,
      languageCourseStatus: nextStatus,
    };
    if (fallbackTrackingStatus) {
      payload.languageTrackingManualStatus = fallbackTrackingStatus;
    }
    return payload;
  }

  private prefetchVisibleIeltsStatuses(): void {
    this.prefetchIeltsStatusesForStudents(this.visibleStudents);
  }

  private prefetchVisibleOssltStatuses(): void {
    this.prefetchOssltStatusesForStudents(this.visibleStudents);
  }

  private prefetchVisibleVolunteerHours(): void {
    this.prefetchVolunteerHoursForStudents(this.visibleStudents);
  }

  private prefetchVolunteerHoursForStudents(
    students: readonly StudentAccount[],
    reapplyOnUpdate = false
  ): void {
    if (!this.volunteerCompletedFilterAvailable) {
      return;
    }

    const missingStudentIds: number[] = [];
    for (const student of students) {
      const studentId = this.resolveStudentId(student);
      if (!studentId) continue;

      const rowHours = this.extractVolunteerHoursFromStudent(student);
      if (rowHours !== null) {
        this.volunteerHoursCache.set(studentId, Math.round(rowHours * 100) / 100);
        this.volunteerHoursUnavailable.delete(studentId);
      }

      const rowCompleted = this.extractVolunteerCompletedFromStudent(student);
      if (rowCompleted !== null) {
        this.volunteerCompletedCache.set(studentId, rowCompleted);
        this.volunteerHoursUnavailable.delete(studentId);
      }

      const hasSummaryData =
        rowHours !== null ||
        rowCompleted !== null ||
        this.volunteerHoursCache.has(studentId) ||
        this.volunteerCompletedCache.has(studentId);
      if (hasSummaryData) {
        continue;
      }

      if (this.volunteerHoursUnavailable.has(studentId)) {
        continue;
      }

      if (this.volunteerHoursLoadInFlight.has(studentId)) {
        continue;
      }

      this.volunteerHoursLoadInFlight.add(studentId);
      missingStudentIds.push(studentId);
    }

    if (missingStudentIds.length <= 0) {
      return;
    }

    const batches = this.chunkStudentIds(missingStudentIds, 100);
    for (const batchStudentIds of batches) {
      this.volunteerApi
        .getTeacherStudentsVolunteerBatchSummary(batchStudentIds)
        .pipe(
          finalize(() => {
            for (const studentId of batchStudentIds) {
              this.volunteerHoursLoadInFlight.delete(studentId);
            }
          })
        )
        .subscribe({
          next: (summaries) => {
            this.applyVolunteerBatchSummaryToCache(batchStudentIds, summaries);
            this.cdr.detectChanges();
            if (reapplyOnUpdate) {
              this.scheduleStatusFilterReapply();
            }
          },
          error: (error: unknown) => {
            for (const studentId of batchStudentIds) {
              this.volunteerHoursCache.delete(studentId);
              this.volunteerCompletedCache.delete(studentId);
              this.volunteerHoursUnavailable.add(studentId);
            }
            this.degradeVolunteerCompletedFilter(error, reapplyOnUpdate);
          },
        });
    }
  }

  private applyVolunteerBatchSummaryToCache(
    studentIds: readonly number[],
    summaries: readonly VolunteerTrackingBatchSummaryItemVm[]
  ): void {
    const byStudentId = new Map<number, VolunteerTrackingBatchSummaryItemVm>();
    for (const summary of summaries) {
      const studentId = Math.trunc(Number(summary?.studentId ?? 0));
      if (!Number.isFinite(studentId) || studentId <= 0) continue;
      byStudentId.set(studentId, summary);
    }

    for (const studentId of studentIds) {
      const summary = byStudentId.get(studentId);
      if (!summary) {
        this.volunteerHoursCache.delete(studentId);
        this.volunteerCompletedCache.delete(studentId);
        this.volunteerHoursUnavailable.add(studentId);
        continue;
      }

      const totalHours = Math.round(Number(summary.totalVolunteerHours || 0) * 100) / 100;
      this.volunteerHoursCache.set(studentId, totalHours >= 0 ? totalHours : 0);
      this.volunteerCompletedCache.set(studentId, Boolean(summary.volunteerCompleted));
      this.volunteerHoursUnavailable.delete(studentId);
    }
  }

  private degradeVolunteerCompletedFilter(error: unknown, reapplyOnUpdate: boolean): void {
    this.volunteerCompletedFilterAvailable = false;
    this.volunteerCompletedFilterError = this.resolveVolunteerBatchSummaryErrorMessage(error);
    const wasEnabled = this.volunteerCompletedFilter;
    if (wasEnabled) {
      this.volunteerCompletedFilter = false;
    }
    this.cdr.detectChanges();
    if (reapplyOnUpdate || wasEnabled) {
      this.scheduleStatusFilterReapply();
    }
  }

  private resolveVolunteerBatchSummaryErrorMessage(error: unknown): string {
    const statusFromHttp = error instanceof HttpErrorResponse ? error.status : 0;
    const fallbackStatus = Number(this.asObjectRecord(error)?.['status']);
    const status =
      Number.isFinite(statusFromHttp) && statusFromHttp > 0
        ? statusFromHttp
        : Number.isFinite(fallbackStatus) && fallbackStatus > 0
          ? Math.trunc(fallbackStatus)
          : 0;

    if (status === 400) {
      return '\u4e49\u5de5\u5b8c\u6210\u6570\u636e\u83b7\u53d6\u5931\u8d25\uff1a\u5b66\u751f ID \u53c2\u6570\u65e0\u6548\u3002';
    }
    if (status === 403) {
      return '\u4e49\u5de5\u5b8c\u6210\u6570\u636e\u83b7\u53d6\u5931\u8d25\uff1a\u65e0\u6743\u9650\u8bbf\u95ee\u90e8\u5206\u5b66\u751f\u3002';
    }
    return '\u4e49\u5de5\u5b8c\u6210\u6570\u636e\u83b7\u53d6\u5931\u8d25\uff0c\u8be5\u7b5b\u9009\u5df2\u7981\u7528\u3002';
  }

  private chunkStudentIds(studentIds: readonly number[], size: number): number[][] {
    const chunkSize = Math.max(1, Math.trunc(Number(size) || 1));
    const chunks: number[][] = [];
    for (let start = 0; start < studentIds.length; start += chunkSize) {
      chunks.push(studentIds.slice(start, start + chunkSize));
    }
    return chunks;
  }

  private prefetchIeltsStatusesForStudents(
    students: readonly StudentAccount[],
    reapplyOnUpdate = false
  ): void {
    for (const student of students) {
      const studentId = this.resolveStudentId(student);
      if (!studentId) continue;

      const hasIeltsStatus = !!this.resolveIeltsTrackingStatusForFilter(student);
      const hasLanguageTrackingStatus = !!this.resolveLanguageTrackingStatusForFilter(student);
      const hasUnavailableOrNoRequirement =
        this.ieltsNoRequirement.has(studentId) || this.ieltsStatusUnavailable.has(studentId);

      if (reapplyOnUpdate) {
        const hasNeededIeltsStatus = !this.languageScoreFilter || hasIeltsStatus || hasUnavailableOrNoRequirement;
        const hasNeededLanguageTrackingStatus =
          !this.languageScoreTrackingFilter || hasLanguageTrackingStatus || hasUnavailableOrNoRequirement;
        const hasLanguageCourseStatus = !!this.resolveLanguageCourseStatusForFilter(student);
        const hasNeededLanguageCourseStatus =
          !this.languageCourseStatusFilter || hasLanguageCourseStatus || hasUnavailableOrNoRequirement;
        if (
          hasNeededIeltsStatus &&
          hasNeededLanguageTrackingStatus &&
          hasNeededLanguageCourseStatus
        ) {
          continue;
        }
      } else if (hasUnavailableOrNoRequirement || this.ieltsStatusCache.has(studentId)) {
        continue;
      }

      if (this.ieltsStatusLoadInFlight.has(studentId)) continue;

      this.ieltsStatusLoadInFlight.add(studentId);
      this.ieltsApi
        .getTeacherStudentIeltsModuleState(studentId)
        .pipe(
          finalize(() => {
            this.ieltsStatusLoadInFlight.delete(studentId);
          })
        )
        .subscribe({
          next: (moduleState) => {
            const summary = deriveStudentIeltsModuleState(moduleState).summary;
            const trackingStatus = summary.trackingStatus;
            const languageTrackingStatus = summary.languageTrackingStatus;
            const statusColorToken = String(summary.colorToken || '').trim();
            const languageCourseStatus = this.extractLanguageCourseStatusFromModuleState(moduleState);
            this.languageTrackingStatusCache.set(studentId, languageTrackingStatus);
            if (languageCourseStatus) {
              this.languageCourseStatusCache.set(studentId, languageCourseStatus);
            } else {
              this.languageCourseStatusCache.delete(studentId);
            }

            if (summary.shouldShowModule === false) {
              this.ieltsNoRequirement.add(studentId);
              this.ieltsStatusCache.delete(studentId);
              this.ieltsStatusColorTokenCache.delete(studentId);
              this.ieltsStatusUnavailable.delete(studentId);
            } else {
              this.ieltsStatusCache.set(studentId, trackingStatus);
              if (statusColorToken) {
                this.ieltsStatusColorTokenCache.set(studentId, statusColorToken);
              } else {
                this.ieltsStatusColorTokenCache.delete(studentId);
              }
              this.ieltsNoRequirement.delete(studentId);
              this.ieltsStatusUnavailable.delete(studentId);
            }
            this.cdr.detectChanges();
            if (reapplyOnUpdate) {
              this.scheduleStatusFilterReapply();
            }
          },
          error: () => {
            this.ieltsStatusCache.delete(studentId);
            this.languageTrackingStatusCache.delete(studentId);
            this.languageCourseStatusCache.delete(studentId);
            this.ieltsStatusColorTokenCache.delete(studentId);
            this.ieltsStatusUnavailable.add(studentId);
            this.cdr.detectChanges();
            if (reapplyOnUpdate) {
              this.scheduleStatusFilterReapply();
            }
          },
        });
    }
  }

  private prefetchOssltStatusesForStudents(
    students: readonly StudentAccount[],
    reapplyOnUpdate = false
  ): void {
    for (const student of students) {
      const studentId = this.resolveStudentId(student);
      if (!studentId) continue;

      const hasOssltResult = !!this.resolveOssltResultForFilter(student);
      const hasOssltTrackingStatus = !!this.resolveOssltTrackingStatusForFilter(student);

      if (reapplyOnUpdate) {
        const hasNeededResult =
          !this.ossltResultFilter || hasOssltResult || this.ossltStatusUnavailable.has(studentId);
        const hasNeededTracking =
          !this.ossltTrackingFilter || hasOssltTrackingStatus || this.ossltStatusUnavailable.has(studentId);
        if (hasNeededResult && hasNeededTracking) {
          continue;
        }
      } else if (this.ossltTrackingStatusCache.has(studentId) || this.ossltStatusUnavailable.has(studentId)) {
        continue;
      }

      if (this.ossltStatusLoadInFlight.has(studentId)) continue;

      this.ossltStatusLoadInFlight.add(studentId);
      this.ossltApi
        .getTeacherStudentOssltModuleState(studentId)
        .pipe(
          finalize(() => {
            this.ossltStatusLoadInFlight.delete(studentId);
          })
        )
        .subscribe({
          next: (moduleState: StudentOssltModuleState) => {
            const summary = deriveStudentOssltSummary(moduleState);
            this.ossltTrackingStatusCache.set(studentId, summary.trackingStatus);
            this.ossltResultCache.set(studentId, moduleState.latestOssltResult);
            this.ossltStatusUnavailable.delete(studentId);
            this.cdr.detectChanges();
            if (reapplyOnUpdate) {
              this.scheduleStatusFilterReapply();
            }
          },
          error: () => {
            this.ossltTrackingStatusCache.delete(studentId);
            this.ossltResultCache.delete(studentId);
            this.ossltStatusUnavailable.add(studentId);
            this.cdr.detectChanges();
            if (reapplyOnUpdate) {
              this.scheduleStatusFilterReapply();
            }
          },
        });
    }
  }

  private prefetchVisibleTeacherNotes(): void {
    for (const student of this.visibleStudents) {
      const studentId = this.resolveStudentId(student);
      if (!studentId || this.teacherNoteCache.has(studentId)) {
        continue;
      }

      const cachedProfile = this.studentProfileCache.get(studentId);
      if (cachedProfile) {
        this.cacheStudentProfilePayload(studentId, cachedProfile);
        continue;
      }

      if (this.studentProfileLoadInFlight.has(studentId)) {
        continue;
      }

      this.studentProfileLoadInFlight.add(studentId);
      this.studentProfileApi
        .getStudentProfileForTeacher(studentId)
        .pipe(
          finalize(() => {
            this.studentProfileLoadInFlight.delete(studentId);
          })
        )
        .subscribe({
          next: (payload) => {
            this.cacheStudentProfilePayload(studentId, payload);
            this.cdr.detectChanges();
          },
          error: () => {},
        });
    }
  }

  private prefetchVisibleServiceItems(): void {
    for (const student of this.visibleStudents) {
      const studentId = this.resolveStudentId(student);
      if (!studentId || this.serviceItemsCache.has(studentId)) {
        continue;
      }

      const inlineSelection = this.extractServiceItemsFromStudent(student);
      if (inlineSelection.length > 0) {
        this.serviceItemsCache.set(studentId, inlineSelection);
        continue;
      }

      const cachedProfile = this.studentProfileCache.get(studentId);
      if (cachedProfile) {
        this.cacheStudentProfilePayload(studentId, cachedProfile);
        continue;
      }

      if (this.studentProfileLoadInFlight.has(studentId)) {
        continue;
      }

      this.studentProfileLoadInFlight.add(studentId);
      this.studentProfileApi
        .getStudentProfileForTeacher(studentId)
        .pipe(
          finalize(() => {
            this.studentProfileLoadInFlight.delete(studentId);
          })
        )
        .subscribe({
          next: (payload) => {
            this.cacheStudentProfilePayload(studentId, payload);
            this.cdr.detectChanges();
          },
          error: () => {},
        });
    }
  }

  private cacheStudentProfilePayload(
    studentId: number,
    payload: StudentProfilePayload | StudentProfileResponse | null | undefined
  ): void {
    if (!payload) {
      return;
    }

    this.studentProfileCache.set(studentId, payload);
    this.teacherNoteCache.set(studentId, this.extractTeacherNoteFromProfile(payload));
    this.serviceItemsCache.set(studentId, this.extractServiceItemsFromProfile(payload));
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
      motherLanguage: this.pickFirstText([
        profileNode['motherLanguage'],
        profileNode['motherTongue'],
        profileNode['nativeLanguage'],
        root['motherLanguage'],
        root['motherTongue'],
        root['nativeLanguage'],
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
    const normalizedNote = String(noteText ?? '').trim();

    return {
      ...this.buildTeacherProfileQuickUpdatePayload(payload),
      teacherNote: normalizedNote,
    };
  }

  private buildTeacherProfileQuickUpdatePayload(
    payload: StudentProfilePayload | StudentProfileResponse | null | undefined
  ): StudentProfilePayload {
    const root =
      payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const profileNode =
      root['profile'] && typeof root['profile'] === 'object'
        ? (root['profile'] as Record<string, unknown>)
        : root;
    const requestPayload: StudentProfilePayload = {
      ...(profileNode as StudentProfilePayload),
    };

    this.removeProfileChildCollectionsForQuickUpdate(requestPayload);
    return requestPayload;
  }

  private removeProfileChildCollectionsForQuickUpdate(payload: StudentProfilePayload): void {
    // Omitting these collections tells the profile PUT to retain existing rows.
    delete payload.schools;
    delete payload.schoolRecords;
    delete payload.identityFiles;
    delete payload['highSchools'];
    delete payload['schoolsOrEmpty'];
    delete payload['schoolRecordsOrEmpty'];
    delete payload['identityFilesOrEmpty'];
    delete payload['serviceItemsOrEmpty'];
    delete payload['serviceProjectsOrEmpty'];
    delete payload['otherCoursesOrEmpty'];
    delete payload['externalCoursesOrEmpty'];
  }

  private extractServiceItemsFromProfile(
    payload: StudentProfilePayload | StudentProfileResponse | null | undefined
  ): string[] {
    const root =
      payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const profileNode =
      root['profile'] && typeof root['profile'] === 'object'
        ? (root['profile'] as Record<string, unknown>)
        : root;

    return this.normalizeServiceItems(
      profileNode['serviceItems'] ??
        profileNode['serviceProjects'] ??
        profileNode['services'] ??
        profileNode['serviceOptions'] ??
        profileNode['selectedServices'] ??
        root['serviceItems'] ??
        root['serviceProjects'] ??
        root['services'] ??
        root['serviceOptions'] ??
        root['selectedServices']
    );
  }

  private buildTeacherProfilePayloadWithServiceItems(
    payload: StudentProfilePayload | StudentProfileResponse | null | undefined,
    serviceItems: string[]
  ): StudentProfilePayload {
    const normalizedServiceItems = this.normalizeServiceItems(serviceItems);

    return {
      ...this.buildTeacherProfileQuickUpdatePayload(payload),
      serviceItems: normalizedServiceItems,
      serviceProjects: normalizedServiceItems,
    };
  }

  private resolveServiceItemsSelection(student: StudentAccount): string[] {
    const studentId = this.resolveStudentId(student);
    if (studentId && this.serviceItemsCache.has(studentId)) {
      return this.serviceItemsCache.get(studentId) ?? [];
    }

    const inlineSelection = this.extractServiceItemsFromStudent(student);
    if (studentId && inlineSelection.length > 0) {
      this.serviceItemsCache.set(studentId, inlineSelection);
    }
    return inlineSelection;
  }

  private extractServiceItemsFromStudent(student: StudentAccount): string[] {
    const profile =
      student?.['profile'] && typeof student['profile'] === 'object'
        ? (student['profile'] as Record<string, unknown>)
        : {};

    return this.normalizeServiceItems(
      student?.['serviceItems'] ??
        student?.['serviceProjects'] ??
        student?.['services'] ??
        student?.['serviceOptions'] ??
        student?.['selectedServices'] ??
        profile['serviceItems'] ??
        profile['serviceProjects'] ??
        profile['services'] ??
        profile['serviceOptions'] ??
        profile['selectedServices']
    );
  }

  private toggleServiceItemsSelection(
    currentItems: readonly string[],
    item: string,
    checked: boolean
  ): string[] {
    const nextItems = checked
      ? [...currentItems, item]
      : currentItems.filter(
          (currentItem) =>
            this.normalizeServiceItemKey(currentItem) !== this.normalizeServiceItemKey(item)
        );
    return this.normalizeServiceItems(nextItems);
  }

  private persistServiceItemsSelection(
    studentId: number,
    item: string,
    checked: boolean,
    nextSelection: string[] | null,
    profilePayload: StudentProfilePayload | StudentProfileResponse | null | undefined
  ): void {
    this.serviceItemsSaveInFlight.add(studentId);
    this.actionError = '';
    this.cdr.detectChanges();

    if (profilePayload) {
      const resolvedSelection =
        nextSelection ?? this.toggleServiceItemsSelection(this.extractServiceItemsFromProfile(profilePayload), item, checked);
      this.saveServiceItemsWithProfile(studentId, profilePayload, resolvedSelection);
      return;
    }

    this.studentProfileApi.getStudentProfileForTeacher(studentId).subscribe({
      next: (payload) => {
        this.cacheStudentProfilePayload(studentId, payload);
        const resolvedSelection =
          nextSelection ?? this.toggleServiceItemsSelection(this.extractServiceItemsFromProfile(payload), item, checked);
        this.serviceItemsCache.set(studentId, resolvedSelection);
        this.saveServiceItemsWithProfile(studentId, payload, resolvedSelection);
      },
      error: (err: HttpErrorResponse) => {
        this.serviceItemsSaveInFlight.delete(studentId);
        this.actionError = this.extractErrorMessage(err) || '保存服务项目失败。';
        this.cdr.detectChanges();
      },
    });
  }

  private saveServiceItemsWithProfile(
    studentId: number,
    profilePayload: StudentProfilePayload | StudentProfileResponse | null | undefined,
    serviceItems: string[]
  ): void {
    const requestPayload = this.buildTeacherProfilePayloadWithServiceItems(profilePayload, serviceItems);
    this.studentProfileApi
      .saveStudentProfileForTeacher(studentId, requestPayload)
      .pipe(
        finalize(() => {
          this.serviceItemsSaveInFlight.delete(studentId);
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (savedPayload) => {
          const normalizedServiceItems = this.normalizeServiceItems(serviceItems);
          // Keep the profile cache in sync with the confirmed local selection so later
          // metadata hydration cannot restore stale serviceItems from a stale response.
          this.cacheStudentProfilePayload(
            studentId,
            this.withServiceItemsInProfilePayload(savedPayload ?? profilePayload, normalizedServiceItems)
          );
          this.serviceItemsCache.set(studentId, normalizedServiceItems);
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.actionError = this.extractErrorMessage(err) || '保存服务项目失败。';
          this.cdr.detectChanges();
        },
      });
  }

  private withServiceItemsInProfilePayload(
    payload: StudentProfilePayload | StudentProfileResponse | null | undefined,
    serviceItems: string[]
  ): StudentProfilePayload | StudentProfileResponse {
    const normalizedServiceItems = this.normalizeServiceItems(serviceItems);
    const root =
      payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};

    if (root['profile'] && typeof root['profile'] === 'object') {
      return {
        ...root,
        profile: {
          ...(root['profile'] as Record<string, unknown>),
          serviceItems: normalizedServiceItems,
          serviceProjects: normalizedServiceItems,
        },
      } as StudentProfileResponse;
    }

    return {
      ...(root as StudentProfilePayload),
      serviceItems: normalizedServiceItems,
      serviceProjects: normalizedServiceItems,
    };
  }

  private normalizeServiceItems(value: unknown): string[] {
    const knownOptions = [...this.serviceItemOptions];
    const optionByKey = new Map<string, string>(
      knownOptions.map((option) => [this.normalizeServiceItemKey(option), option])
    );
    const selected: string[] = [];
    const seen = new Set<string>();

    const append = (candidate: unknown): void => {
      const raw = this.toServiceItemText(candidate);
      if (!raw) {
        return;
      }

      const normalizedRaw = this.normalizeServiceItemKey(raw);
      const strippedRaw = raw.replace(/^[A-Za-z]\s*[:：]\s*/, '');
      const normalizedStripped = this.normalizeServiceItemKey(strippedRaw);
      const matched =
        optionByKey.get(normalizedRaw) ??
        optionByKey.get(normalizedStripped) ??
        raw;
      const key = this.normalizeServiceItemKey(matched);
      if (!key || seen.has(key)) {
        return;
      }

      seen.add(key);
      selected.push(matched);
    };

    if (Array.isArray(value)) {
      value.forEach(append);
    } else if (value && typeof value === 'object') {
      const node = value as Record<string, unknown>;
      const nestedArrayCandidate = [node['items'], node['data'], node['values'], node['selected']].find(
        Array.isArray
      );

      if (Array.isArray(nestedArrayCandidate)) {
        nestedArrayCandidate.forEach(append);
      } else {
        Object.entries(node).forEach(([key, raw]) => {
          if (this.isTruthyServiceItemValue(raw)) {
            append(key);
          }
        });
      }
    } else {
      const rawText = this.toServiceItemText(value);
      if (!rawText) {
        return [];
      }
      rawText.split(/[\n,;；、|]+/).forEach(append);
    }

    const orderedKnownOptions = knownOptions.filter((option) =>
      seen.has(this.normalizeServiceItemKey(option))
    );
    const extraOptions = selected.filter(
      (option) =>
        !orderedKnownOptions.some(
          (knownOption) =>
            this.normalizeServiceItemKey(knownOption) === this.normalizeServiceItemKey(option)
        )
    );

    return [...orderedKnownOptions, ...extraOptions];
  }

  private normalizeServiceItemKey(value: unknown): string {
    return String(value ?? '').trim().toLocaleLowerCase().replace(/\s+/g, '');
  }

  private toServiceItemText(value: unknown): string {
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value).trim();
    }

    if (!value || typeof value !== 'object') {
      return '';
    }

    const node = value as Record<string, unknown>;
    return this.pickFirstText([node['label'], node['name'], node['value'], node['title']]);
  }

  private isTruthyServiceItemValue(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    const normalized = String(value ?? '').trim().toLocaleLowerCase();
    return (
      normalized === '1' ||
      normalized === 'true' ||
      normalized === 'yes' ||
      normalized === 'y' ||
      normalized === 'selected' ||
      normalized === 'checked'
    );
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
    if (!this.resolveMotherLanguageValue(student) && metadata.motherLanguage) {
      student['motherLanguage'] = metadata.motherLanguage;
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

  private resolveMotherLanguageValue(student: StudentAccount): string {
    const profile = student?.['profile'] as Record<string, unknown> | undefined;
    return this.pickFirstText([
      student?.['motherLanguage'],
      student?.['motherTongue'],
      student?.['nativeLanguage'],
      profile?.['motherLanguage'],
      profile?.['motherTongue'],
      profile?.['nativeLanguage'],
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
