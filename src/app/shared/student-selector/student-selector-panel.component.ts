import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import type { AssignableStudentOptionVm } from '../../services/task-center.service';
import type { StudentSelectorFilterFieldKey } from '../student-fields/student-field-presets';
import { StudentFilterFieldsComponent } from '../student-filter-fields/student-filter-fields.component';
import type { StudentSelectorColumnConfig } from './student-selector.types';

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
  imports: [CommonModule, FormsModule, StudentFilterFieldsComponent],
  templateUrl: './student-selector-panel.component.html',
  styleUrl: './student-selector-panel.component.scss',
})
export class StudentSelectorPanelComponent {
  readonly idPrefix = `student-selector-${Math.trunc(Math.random() * 1_000_000_000)}`;
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

  @Input() disabled = false;
  @Input() panelExpanded = false;
  @Input() filterExpanded = false;
  @Input() columnPanelExpanded = false;

  @Input() studentsLoading = false;
  @Input() studentsError = '';

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
  @Input() ossltResultFilter = '';
  @Input() ossltTrackingFilter = '';
  @Input() languageScoreFilterOptions: readonly string[] = [];
  @Input() languageTrackingFilterOptions: readonly string[] = [];
  @Input() ossltResultFilterOptions: readonly string[] = [];
  @Input() ossltTrackingFilterOptions: readonly string[] = [];
  @Input() volunteerCompletedFilter = false;
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
  @Output() ossltResultFilterChange = new EventEmitter<string>();
  @Output() ossltTrackingFilterChange = new EventEmitter<string>();
  @Output() volunteerCompletedFilterChange = new EventEmitter<boolean>();
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

  onVolunteerCompletedFilterChange(event: Event): void {
    const checked = (event.target as HTMLInputElement | null)?.checked === true;
    this.volunteerCompletedFilterChange.emit(checked);
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
