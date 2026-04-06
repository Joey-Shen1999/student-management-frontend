import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import type { AssignableStudentOptionVm } from '../../services/task-center.service';
import type { StudentSelectorFilterFieldKey } from '../student-fields/student-field-presets';
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

@Component({
  selector: 'app-student-selector-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  @Output() studentKeywordChange = new EventEmitter<string>();

  @Output() selectAllToggle = new EventEmitter<boolean>();
  @Output() studentSelectionChange = new EventEmitter<StudentSelectionChangeEvent>();
  @Output() columnVisibilityChange = new EventEmitter<StudentColumnVisibilityChangeEvent>();

  @Output() teacherNoteFocus = new EventEmitter<number>();
  @Output() teacherNoteChange = new EventEmitter<StudentTeacherNoteChangeEvent>();
  @Output() teacherNoteBlur = new EventEmitter<number>();

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
}
