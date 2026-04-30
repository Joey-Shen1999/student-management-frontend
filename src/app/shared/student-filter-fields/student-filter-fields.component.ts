import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import type {
  StudentSelectorFilterFieldKey,
  VolunteerCompletedFilterValue,
} from '../student-fields/student-field-presets';
import { TranslatePipe } from '../i18n/translate.pipe';
import { LocalizedText, uiText } from '../i18n/ui-translations';

@Component({
  selector: 'app-student-filter-fields',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './student-filter-fields.component.html',
  styleUrl: './student-filter-fields.component.scss',
})
export class StudentFilterFieldsComponent {
  readonly ui = {
    country: uiText('国家', 'Country'),
    province: uiText('省份', 'Province'),
    city: uiText('城市', 'City'),
    schoolBoard: uiText('所属教育局', 'School Board'),
    all: uiText('全部', 'All'),
    any: uiText('全部', 'Any'),
    languageScore: uiText('语言成绩', 'Language Scores'),
    languageTracking: uiText('语言成绩跟踪', 'Language Score Tracking'),
    languageCourseStatus: uiText('语言报课情况', 'Language Course Status'),
    ossltResult: uiText('OSSLT 成绩', 'OSSLT Result'),
    ossltTracking: uiText('OSSLT 跟进状态', 'OSSLT Tracking Status'),
    courseCode: uiText('课程代码', 'Course Code'),
    status: uiText('状态', 'Status'),
    volunteerCompleted: uiText('义工完成', 'Volunteer Completed'),
    completed: uiText('已完成', 'Completed'),
    notCompleted: uiText('未完成', 'Not Completed'),
  };
  readonly allFilterFields: readonly StudentSelectorFilterFieldKey[] = [
    'country',
    'province',
    'city',
    'schoolBoard',
    'graduationSeason',
    'languageScore',
    'languageTracking',
    'languageCourseStatus',
    'ossltResult',
    'ossltTracking',
    'coursePlan',
    'volunteerCompleted',
    'keyword',
  ];
  readonly defaultLanguageScoreFilterOptions: readonly string[] = [
    'GREEN_STRICT_PASS',
    'GREEN_COMMON_PASS_WITH_WARNING',
    'YELLOW_NEEDS_PREPARATION',
    'NO_REQUIREMENT',
  ];
  readonly defaultLanguageTrackingFilterOptions: readonly string[] = [
    'TEACHER_REVIEW_APPROVED',
    'AUTO_PASS_ALL_SCHOOLS',
    'AUTO_PASS_PARTIAL_SCHOOLS',
    'NEEDS_TRACKING',
  ];
  readonly defaultLanguageCourseStatusFilterOptions: readonly string[] = [
    'NOT_RECEIVED_TRAINING',
    'ENROLLED_GLOBAL_IELTS',
    'ENROLLED_OTHER_IELTS',
    'COURSE_COMPLETED_NOT_EXAMINED',
    'EXAM_REGISTERED',
    'SCORE_RELEASED',
  ];
  readonly defaultOssltResultFilterOptions: readonly string[] = ['PASS', 'FAIL', 'UNKNOWN'];
  readonly defaultOssltTrackingFilterOptions: readonly string[] = [
    'WAITING_UPDATE',
    'NEEDS_TRACKING',
    'PASSED',
  ];
  readonly defaultCourseStatusFilterOptions: readonly string[] = [
    'COMPLETED',
    'IN_PROGRESS',
    'PLANNED',
  ];

  @Input() idPrefix = `student-filter-fields-${Math.trunc(Math.random() * 1_000_000_000)}`;
  @Input() disabled = false;
  @Input() filterFields: readonly StudentSelectorFilterFieldKey[] = this.allFilterFields;

  @Input() countryFilterOptions: readonly string[] = [];
  @Input() provinceFilterOptions: readonly string[] = [];
  @Input() cityFilterOptions: readonly string[] = [];
  @Input() schoolBoardFilterOptions: readonly string[] = [];
  @Input() graduationSeasonFilterOptions: readonly string[] = [];

  @Input() countryFilterInput = '';
  @Input() provinceFilterInput = '';
  @Input() cityFilterInput = '';
  @Input() schoolBoardFilterInput = '';
  @Input() graduationSeasonFilterInput = '';
  @Input() graduationSeasonLabel: string | LocalizedText = uiText('毕业季', 'Graduation Season');
  @Input() languageScoreFilter = '';
  @Input() languageTrackingFilter = '';
  @Input() languageCourseStatusFilter = '';
  @Input() ossltResultFilter = '';
  @Input() ossltTrackingFilter = '';
  @Input() courseCodeFilterInput = '';
  @Input() courseStatusFilter = '';
  @Input() courseCodeFilterOptions: readonly string[] = [];
  @Input() languageScoreFilterOptions: readonly string[] = this.defaultLanguageScoreFilterOptions;
  @Input() languageTrackingFilterOptions: readonly string[] =
    this.defaultLanguageTrackingFilterOptions;
  @Input() languageCourseStatusFilterOptions: readonly string[] =
    this.defaultLanguageCourseStatusFilterOptions;
  @Input() ossltResultFilterOptions: readonly string[] = this.defaultOssltResultFilterOptions;
  @Input() ossltTrackingFilterOptions: readonly string[] = this.defaultOssltTrackingFilterOptions;
  @Input() courseStatusFilterOptions: readonly string[] = this.defaultCourseStatusFilterOptions;
  @Input() volunteerCompletedFilter: VolunteerCompletedFilterValue = '';
  @Input() volunteerCompletedDisabled = false;
  @Input() volunteerCompletedTitle: string | LocalizedText | null = null;
  @Input() studentKeyword = '';
  @Input() keywordPlaceholder: string | LocalizedText = uiText(
    '按 ID、姓名、邮箱、电话、学校搜索',
    'Search by ID, name, email, phone, school'
  );

  @Output() countryFilterInputChange = new EventEmitter<string>();
  @Output() provinceFilterInputChange = new EventEmitter<string>();
  @Output() cityFilterInputChange = new EventEmitter<string>();
  @Output() schoolBoardFilterInputChange = new EventEmitter<string>();
  @Output() graduationSeasonFilterInputChange = new EventEmitter<string>();
  @Output() languageScoreFilterChange = new EventEmitter<string>();
  @Output() languageTrackingFilterChange = new EventEmitter<string>();
  @Output() languageCourseStatusFilterChange = new EventEmitter<string>();
  @Output() ossltResultFilterChange = new EventEmitter<string>();
  @Output() ossltTrackingFilterChange = new EventEmitter<string>();
  @Output() courseCodeFilterInputChange = new EventEmitter<string>();
  @Output() courseStatusFilterChange = new EventEmitter<string>();
  @Output() volunteerCompletedFilterChange = new EventEmitter<VolunteerCompletedFilterValue>();
  @Output() studentKeywordChange = new EventEmitter<string>();

  shouldShowFilterField(field: StudentSelectorFilterFieldKey): boolean {
    return this.filterFields.includes(field);
  }

  onVolunteerCompletedFilterSelect(value: unknown): void {
    this.volunteerCompletedFilterChange.emit(this.normalizeVolunteerCompletedFilterValue(value));
  }

  onLanguageScoreFilterSelect(value: unknown): void {
    this.languageScoreFilterChange.emit(String(value ?? '').trim());
  }

  onLanguageTrackingFilterSelect(value: unknown): void {
    this.languageTrackingFilterChange.emit(String(value ?? '').trim());
  }

  onLanguageCourseStatusFilterSelect(value: unknown): void {
    this.languageCourseStatusFilterChange.emit(String(value ?? '').trim());
  }

  onOssltResultFilterSelect(value: unknown): void {
    this.ossltResultFilterChange.emit(String(value ?? '').trim());
  }

  onOssltTrackingFilterSelect(value: unknown): void {
    this.ossltTrackingFilterChange.emit(String(value ?? '').trim());
  }

  onCourseStatusFilterSelect(value: unknown): void {
    this.courseStatusFilterChange.emit(String(value ?? '').trim());
  }

  resolveLanguageScoreFilterOptionLabel(value: string): string | LocalizedText {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'GREEN_STRICT_PASS') return uiText('已达标', 'Meets Requirement');
    if (normalized === 'GREEN_COMMON_PASS_WITH_WARNING') return uiText('基本达标', 'Mostly Meets Requirement');
    if (normalized === 'YELLOW_NEEDS_PREPARATION') return uiText('需提升', 'Needs Improvement');
    if (normalized === 'NO_REQUIREMENT') return uiText('无需要求', 'No Requirement');
    return String(value ?? '').trim() || '-';
  }

  resolveLanguageTrackingFilterOptionLabel(value: string): string | LocalizedText {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'TEACHER_REVIEW_APPROVED') return uiText('教师已确认', 'Teacher Confirmed');
    if (normalized === 'AUTO_PASS_ALL_SCHOOLS') return uiText('全部学校达标', 'Meets All School Requirements');
    if (normalized === 'AUTO_PASS_PARTIAL_SCHOOLS') return uiText('部分学校达标', 'Meets Some School Requirements');
    if (normalized === 'NEEDS_TRACKING') return uiText('需要跟进', 'Needs Tracking');
    return String(value ?? '').trim() || '-';
  }

  resolveLanguageCourseStatusFilterOptionLabel(value: string): string | LocalizedText {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'NOT_RECEIVED_TRAINING') return uiText('未接受培训', 'No Training Yet');
    if (normalized === 'ENROLLED_GLOBAL_IELTS') return uiText('已报名环球雅思课程', 'Enrolled in Global IELTS');
    if (normalized === 'ENROLLED_OTHER_IELTS') return uiText('已报名其他机构雅思课程', 'Enrolled in Other IELTS Course');
    if (normalized === 'COURSE_COMPLETED_NOT_EXAMINED') return uiText('已结课，未考试', 'Course Complete, Exam Pending');
    if (normalized === 'EXAM_REGISTERED') return uiText('已报名考试', 'Exam Registered');
    if (normalized === 'SCORE_RELEASED') return uiText('已出分', 'Score Released');
    return String(value ?? '').trim() || '-';
  }

  resolveOssltResultFilterOptionLabel(value: string): string | LocalizedText {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'PASS') return uiText('已通过', 'Passed');
    if (normalized === 'FAIL') return uiText('未通过', 'Failed');
    if (normalized === 'UNKNOWN') return uiText('待更新', 'Pending Update');
    return String(value ?? '').trim() || '-';
  }

  resolveOssltTrackingFilterOptionLabel(value: string): string | LocalizedText {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'PASSED') return uiText('已通过', 'Passed');
    if (normalized === 'NEEDS_TRACKING') return uiText('需要跟进', 'Needs Tracking');
    if (normalized === 'WAITING_UPDATE') return uiText('等待更新', 'Waiting for Update');
    return String(value ?? '').trim() || '-';
  }

  resolveCourseStatusFilterOptionLabel(value: string): string | LocalizedText {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'COMPLETED') return uiText('已完成', 'Done');
    if (normalized === 'IN_PROGRESS') return uiText('在读', 'Taking');
    if (normalized === 'PLANNED') return uiText('计划中', 'Planning');
    return String(value ?? '').trim() || '-';
  }

  private normalizeVolunteerCompletedFilterValue(value: unknown): VolunteerCompletedFilterValue {
    if (value === true) return 'COMPLETED';
    if (value === false || value === null || value === undefined) return '';

    const normalized = String(value ?? '')
      .trim()
      .toUpperCase();
    if (!normalized || normalized === 'ALL') return '';
    if (normalized === 'COMPLETED') return 'COMPLETED';
    if (normalized === 'NOT_COMPLETED') return 'NOT_COMPLETED';
    return '';
  }
}
