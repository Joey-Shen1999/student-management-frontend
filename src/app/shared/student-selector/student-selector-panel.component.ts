import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import type { AssignableStudentOptionVm } from '../../services/task-center.service';
import type {
  StudentSelectorFilterFieldKey,
  VolunteerCompletedFilterValue,
} from '../student-fields/student-field-presets';
import { StudentFilterFieldsComponent } from '../student-filter-fields/student-filter-fields.component';
import type { StudentSelectorColumnConfig } from './student-selector.types';
import { TranslatePipe } from '../i18n/translate.pipe';
import { LocalizedText, uiText } from '../i18n/ui-translations';

export interface StudentSelectionChangeEvent {
  studentId: number;
  checked: boolean;
}

export interface StudentColumnVisibilityChangeEvent {
  key: string;
  checked: boolean;
}

export interface StudentTeacherNoteChangeEvent {
  studentId: number;
  value: string;
}

export interface StudentColumnOrderChangeEvent {
  orderedVisibleColumnKeys: string[];
}

@Component({
  selector: 'app-student-selector-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, StudentFilterFieldsComponent, TranslatePipe],
  templateUrl: './student-selector-panel.component.html',
  styleUrl: './student-selector-panel.component.scss',
})
export class StudentSelectorPanelComponent {
  readonly ui = {
    selectStudents: uiText('选择学生', 'Select Students'),
    collapseFilters: uiText('收起筛选', 'Collapse Filters'),
    expandFilters: uiText('展开筛选', 'Expand Filters'),
    loadingStudents: uiText('加载学生中...', 'Loading students...'),
    refreshStudents: uiText('刷新学生列表', 'Refresh Student List'),
    studentSearchPlaceholder: uiText(
      '按 ID、姓名、邮箱、电话、学校等搜索',
      'Search by ID, name, email, phone, school'
    ),
    resetFilters: uiText('重置筛选', 'Reset Filters'),
    selectAll: uiText('全选', 'Select All'),
    collapseColumns: uiText('收起字段', 'Collapse Columns'),
    columnDisplay: uiText('字段显示', 'Column Display'),
    restoreDefaultColumns: uiText('恢复默认字段', 'Restore Default Columns'),
    backendDependentTitle: uiText(
      '可能依赖学生详情接口字段',
      'May depend on student profile fields'
    ),
    required: uiText('必选', 'Required'),
    selectedStudents: uiText('已选学生', 'Selected Students'),
    clearSelected: uiText('清空已选', 'Clear Selected'),
    select: uiText('选择', 'Select'),
    outOfCurrentFilter: uiText('未命中当前筛选', 'Outside current filters'),
    teacherNotePlaceholder: uiText('输入教师内部备注', 'Enter internal teacher note'),
    loadingSelectableStudents: uiText('正在加载可选学生...', 'Loading selectable students...'),
    noMatchingStudents: uiText('没有符合筛选条件的学生。', 'No students match the current filters.'),
  };
  readonly columnLabelByKey: Record<string, LocalizedText> = {
    name: uiText('姓名', 'Name'),
    email: uiText('邮箱', 'Email'),
    phone: uiText('电话', 'Phone'),
    graduation: uiText('毕业时间', 'Graduation Date'),
    schoolName: uiText('学校名', 'School Name'),
    canadaIdentity: uiText('在加拿大的身份', 'Status in Canada'),
    gender: uiText('性别', 'Gender'),
    nationality: uiText('国籍', 'Nationality'),
    firstLanguage: uiText('第一语言', 'First Language'),
    motherLanguage: uiText('母语', 'Mother Tongue'),
    schoolBoard: uiText('所属教育局（在读学校）', 'School Board (Current School)'),
    country: uiText('国家', 'Country'),
    province: uiText('省份', 'Province'),
    city: uiText('城市（在读学校）', 'City (Current School)'),
    teacherNote: uiText('老师备注（学生不可见）', 'Teacher Notes (Hidden from students)'),
    ielts: uiText('语言成绩', 'Language Scores'),
    languageTracking: uiText('跟进状态', 'Tracking Status'),
    languageCourseStatus: uiText('语言报课情况', 'Language Course Status'),
    ossltResult: uiText('OSSLT 成绩', 'OSSLT Result'),
    ossltTracking: uiText('OSSLT 跟进状态', 'OSSLT Tracking Status'),
    osslcCourseLocation: uiText('OSSLC 在哪里上', 'OSSLC Course Location'),
    status: uiText('归档状态', 'Archive Status'),
    selectable: uiText('可选择', 'Selectable'),
  };
  readonly idPrefix = `student-selector-${Math.trunc(Math.random() * 1_000_000_000)}`;
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
    'volunteerCompleted',
    'keyword',
  ];

  @Input() disabled = false;
  @Input() panelExpanded = false;
  @Input() filterExpanded = false;
  @Input() columnPanelExpanded = false;

  @Input() studentsLoading = false;
  @Input() studentsError: string | LocalizedText = '';

  @Input() selectedCount = 0;
  @Input() filteredStudents: AssignableStudentOptionVm[] = [];
  @Input() selectedStudents: AssignableStudentOptionVm[] = [];

  @Input() countryFilterOptions: string[] = [];
  @Input() provinceFilterOptions: string[] = [];
  @Input() cityFilterOptions: string[] = [];
  @Input() schoolBoardFilterOptions: string[] = [];
  @Input() graduationSeasonFilterOptions: string[] = [];

  @Input() countryFilterInput = '';
  @Input() provinceFilterInput = '';
  @Input() cityFilterInput = '';
  @Input() schoolBoardFilterInput = '';
  @Input() graduationSeasonFilterInput = '';
  @Input() languageScoreFilter = '';
  @Input() languageTrackingFilter = '';
  @Input() languageCourseStatusFilter = '';
  @Input() ossltResultFilter = '';
  @Input() ossltTrackingFilter = '';
  @Input() languageScoreFilterOptions: readonly string[] = [];
  @Input() languageTrackingFilterOptions: readonly string[] = [];
  @Input() languageCourseStatusFilterOptions: readonly string[] = [];
  @Input() ossltResultFilterOptions: readonly string[] = [];
  @Input() ossltTrackingFilterOptions: readonly string[] = [];
  @Input() volunteerCompletedFilter: VolunteerCompletedFilterValue = '';
  @Input() studentKeyword = '';
  @Input() filterFields: readonly StudentSelectorFilterFieldKey[] = this.allFilterFields;

  @Input() visibleColumns: readonly StudentSelectorColumnConfig[] = [];
  @Input() columnToggleOptions: readonly StudentSelectorColumnConfig[] = [];

  @Input() isAllVisibleSelected = false;
  @Input() isVisibleSelectionPartial = false;
  @Input() isColumnSelectionAtDefault = true;

  @Input() isStudentSelected: (studentId: number) => boolean = () => false;
  @Input() isStudentOutOfCurrentFilter: (student: AssignableStudentOptionVm) => boolean = () => false;
  @Input() isStudentSelectable: (student: AssignableStudentOptionVm) => boolean = () => true;
  @Input() isColumnVisible: (columnKey: string) => boolean = () => false;
  @Input() resolveColumnValue: (
    student: AssignableStudentOptionVm,
    columnKey: string
  ) => string = () => '-';
  @Input() detailTeacherNote: (studentId: number) => string = () => '';
  @Input() isTeacherNoteSaving: (studentId: number) => boolean = () => false;

  @Output() panelToggle = new EventEmitter<void>();
  @Output() filterPanelToggle = new EventEmitter<void>();
  @Output() columnPanelToggle = new EventEmitter<void>();

  @Output() refreshStudents = new EventEmitter<void>();
  @Output() resetFilters = new EventEmitter<void>();
  @Output() resetColumns = new EventEmitter<void>();
  @Output() clearSelected = new EventEmitter<void>();

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
  @Output() volunteerCompletedFilterChange = new EventEmitter<VolunteerCompletedFilterValue>();
  @Output() studentKeywordChange = new EventEmitter<string>();

  @Output() selectAllToggle = new EventEmitter<boolean>();
  @Output() studentSelectionChange = new EventEmitter<StudentSelectionChangeEvent>();
  @Output() columnVisibilityChange = new EventEmitter<StudentColumnVisibilityChangeEvent>();
  @Output() columnOrderChange = new EventEmitter<StudentColumnOrderChangeEvent>();

  @Output() teacherNoteFocus = new EventEmitter<number>();
  @Output() teacherNoteChange = new EventEmitter<StudentTeacherNoteChangeEvent>();
  @Output() teacherNoteBlur = new EventEmitter<number>();

  private draggingColumnKey: string | null = null;

  trackStudent = (_index: number, student: AssignableStudentOptionVm): number => student.studentId;
  trackColumn = (
    _index: number,
    column: StudentSelectorColumnConfig
  ): string => column.key;

  shouldShowFilterField(field: StudentSelectorFilterFieldKey): boolean {
    return this.filterFields.includes(field);
  }

  selectStudentsTitle(count: number): LocalizedText {
    return uiText(`选择学生（已选 ${count} 人）`, `Select Students (${count} selected)`);
  }

  selectedCountText(count: number): LocalizedText {
    return uiText(`已选 ${count} 人`, `${count} selected`);
  }

  selectedStudentsText(count: number): LocalizedText {
    return uiText(`已选学生（${count}）`, `Selected Students (${count})`);
  }

  filterResultsText(count: number): LocalizedText {
    return uiText(`筛选结果（${count}）`, `Filter Results (${count})`);
  }

  columnLabel(column: StudentSelectorColumnConfig): string | LocalizedText {
    return this.columnLabelByKey[column.key] || column.label;
  }

  onSelectAllChange(event: Event): void {
    const checked = (event.target as HTMLInputElement | null)?.checked === true;
    this.selectAllToggle.emit(checked);
  }

  onStudentSelectionChange(studentId: number, event: Event): void {
    event.stopPropagation();
    const checked = (event.target as HTMLInputElement | null)?.checked === true;
    this.studentSelectionChange.emit({ studentId, checked });
  }

  onColumnVisibilityChange(columnKey: string, event: Event): void {
    const checked = (event.target as HTMLInputElement | null)?.checked === true;
    this.columnVisibilityChange.emit({ key: columnKey, checked });
  }

  onVolunteerCompletedFilterChange(value: VolunteerCompletedFilterValue): void {
    this.volunteerCompletedFilterChange.emit(value);
  }

  canDragColumnHeaders(): boolean {
    return !this.disabled && !this.studentsLoading && this.visibleColumns.length > 1;
  }

  onColumnHeaderDragStart(columnKey: string, event: DragEvent): void {
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

  onColumnHeaderDrop(targetColumnKey: string, event: DragEvent): void {
    event.preventDefault();

    const sourceColumnKey =
      this.draggingColumnKey || event.dataTransfer?.getData('text/plain') || null;
    this.draggingColumnKey = null;
    if (!sourceColumnKey || sourceColumnKey === targetColumnKey) return;

    const orderedVisibleColumnKeys = this.visibleColumns.map((column) => column.key);
    const sourceIndex = orderedVisibleColumnKeys.indexOf(sourceColumnKey);
    const targetIndex = orderedVisibleColumnKeys.indexOf(targetColumnKey);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const [draggedKey] = orderedVisibleColumnKeys.splice(sourceIndex, 1);
    orderedVisibleColumnKeys.splice(targetIndex, 0, draggedKey);
    this.columnOrderChange.emit({ orderedVisibleColumnKeys });
  }

  onColumnHeaderDragEnd(): void {
    this.draggingColumnKey = null;
  }
}
