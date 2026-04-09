import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import type { StudentSelectorFilterFieldKey } from '../student-fields/student-field-presets';

@Component({
  selector: 'app-student-filter-fields',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './student-filter-fields.component.html',
  styleUrl: './student-filter-fields.component.scss',
})
export class StudentFilterFieldsComponent {
  readonly allFilterFields: readonly StudentSelectorFilterFieldKey[] = [
    'country',
    'province',
    'city',
    'schoolBoard',
    'graduationSeason',
    'languageScore',
    'languageTracking',
    'ossltResult',
    'ossltTracking',
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
  readonly defaultOssltResultFilterOptions: readonly string[] = ['PASS', 'FAIL', 'UNKNOWN'];
  readonly defaultOssltTrackingFilterOptions: readonly string[] = [
    'WAITING_UPDATE',
    'NEEDS_TRACKING',
    'PASSED',
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
  @Input() languageScoreFilter = '';
  @Input() languageTrackingFilter = '';
  @Input() ossltResultFilter = '';
  @Input() ossltTrackingFilter = '';
  @Input() languageScoreFilterOptions: readonly string[] = this.defaultLanguageScoreFilterOptions;
  @Input() languageTrackingFilterOptions: readonly string[] =
    this.defaultLanguageTrackingFilterOptions;
  @Input() ossltResultFilterOptions: readonly string[] = this.defaultOssltResultFilterOptions;
  @Input() ossltTrackingFilterOptions: readonly string[] = this.defaultOssltTrackingFilterOptions;
  @Input() volunteerCompletedFilter = false;
  @Input() volunteerCompletedDisabled = false;
  @Input() volunteerCompletedTitle: string | null = null;
  @Input() studentKeyword = '';
  @Input() keywordPlaceholder = 'Search by ID, name, email, phone, school';

  @Output() countryFilterInputChange = new EventEmitter<string>();
  @Output() provinceFilterInputChange = new EventEmitter<string>();
  @Output() cityFilterInputChange = new EventEmitter<string>();
  @Output() schoolBoardFilterInputChange = new EventEmitter<string>();
  @Output() graduationSeasonFilterInputChange = new EventEmitter<string>();
  @Output() languageScoreFilterChange = new EventEmitter<string>();
  @Output() languageTrackingFilterChange = new EventEmitter<string>();
  @Output() ossltResultFilterChange = new EventEmitter<string>();
  @Output() ossltTrackingFilterChange = new EventEmitter<string>();
  @Output() volunteerCompletedFilterChange = new EventEmitter<boolean>();
  @Output() studentKeywordChange = new EventEmitter<string>();

  shouldShowFilterField(field: StudentSelectorFilterFieldKey): boolean {
    return this.filterFields.includes(field);
  }

  onVolunteerCompletedFilterToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement | null)?.checked === true;
    this.volunteerCompletedFilterChange.emit(checked);
  }

  onLanguageScoreFilterSelect(value: unknown): void {
    this.languageScoreFilterChange.emit(String(value ?? '').trim());
  }

  onLanguageTrackingFilterSelect(value: unknown): void {
    this.languageTrackingFilterChange.emit(String(value ?? '').trim());
  }

  onOssltResultFilterSelect(value: unknown): void {
    this.ossltResultFilterChange.emit(String(value ?? '').trim());
  }

  onOssltTrackingFilterSelect(value: unknown): void {
    this.ossltTrackingFilterChange.emit(String(value ?? '').trim());
  }

  resolveLanguageScoreFilterOptionLabel(value: string): string {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'GREEN_STRICT_PASS') return '\u5df2\u8fbe\u6807';
    if (normalized === 'GREEN_COMMON_PASS_WITH_WARNING') return '\u57fa\u672c\u8fbe\u6807';
    if (normalized === 'YELLOW_NEEDS_PREPARATION') return '\u9700\u63d0\u5347';
    if (normalized === 'NO_REQUIREMENT') return '\u65e0\u9700\u8981\u6c42';
    return String(value ?? '').trim() || '-';
  }

  resolveLanguageTrackingFilterOptionLabel(value: string): string {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'TEACHER_REVIEW_APPROVED') return '\u6559\u5e08\u5df2\u786e\u8ba4';
    if (normalized === 'AUTO_PASS_ALL_SCHOOLS') return '\u5168\u90e8\u5b66\u6821\u8fbe\u6807';
    if (normalized === 'AUTO_PASS_PARTIAL_SCHOOLS') return '\u90e8\u5206\u5b66\u6821\u8fbe\u6807';
    if (normalized === 'NEEDS_TRACKING') return '\u9700\u8981\u8ddf\u8fdb';
    return String(value ?? '').trim() || '-';
  }

  resolveOssltResultFilterOptionLabel(value: string): string {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'PASS') return '\u5df2\u901a\u8fc7';
    if (normalized === 'FAIL') return '\u672a\u901a\u8fc7';
    if (normalized === 'UNKNOWN') return '\u5f85\u66f4\u65b0';
    return String(value ?? '').trim() || '-';
  }

  resolveOssltTrackingFilterOptionLabel(value: string): string {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'PASSED') return '\u5df2\u901a\u8fc7';
    if (normalized === 'NEEDS_TRACKING') return '\u9700\u8981\u8ddf\u8fdb';
    if (normalized === 'WAITING_UPDATE') return '\u7b49\u5f85\u66f4\u65b0';
    return String(value ?? '').trim() || '-';
  }
}
