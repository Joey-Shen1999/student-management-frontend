import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import {
  type AssignableStudentOptionVm,
  type CreateInfoRequestVm,
  type InfoTaskCategory,
  type InfoTaskVm,
  TaskCenterService,
} from '../../services/task-center.service';
import {
  type StudentAccount,
  StudentManagementService,
} from '../../services/student-management.service';
import { EDUCATION_BOARD_LIBRARY_OPTIONS } from '../../services/student-profile.service';
import {
  buildGoalStudentSelectorColumns,
  type GoalStudentSelectorColumnConfig,
  type GoalStudentSelectorColumnKey,
} from '../../shared/student-columns/goal-student-selector-columns';
import { buildPresetVisibleColumnKeys } from '../../shared/student-columns/student-column-visibility.util';
import {
  STUDENT_SELECTOR_AVAILABLE_COLUMN_KEYS_BY_CONTEXT,
  STUDENT_SELECTOR_DEFAULT_COLUMN_KEYS_BY_CONTEXT,
  STUDENT_SELECTOR_FILTER_FIELDS_BY_CONTEXT,
  type StudentSelectorFilterFieldKey,
} from '../../shared/student-fields/student-field-presets';
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
import { StudentSelectorPanelComponent } from '../../shared/student-selector/student-selector-panel.component';

interface StudentDetailVm {
  email: string;
  phone: string;
  province: string;
  city: string;
  graduation: string;
  schoolName: string;
  canadaIdentity: string;
  gender: string;
  nationality: string;
  firstLanguage: string;
  motherLanguage: string;
  teacherNote: string;
  country: string;
  schoolBoard: string;
  graduationSeason: string;
  status: 'ACTIVE' | 'ARCHIVED' | '';
}

const PROVINCE_FILTER_ALIASES_BY_COUNTRY: Partial<
  Record<ProvinceFilterCountry, Record<string, string>>
> = {
  Canada: {
    on: 'Ontario',
    'o n': 'Ontario',
    ontario: 'Ontario',
    bc: 'British Columbia',
    'b c': 'British Columbia',
    'british columbia': 'British Columbia',
    ab: 'Alberta',
    'a b': 'Alberta',
    alberta: 'Alberta',
    qc: 'Quebec',
    'q c': 'Quebec',
    quebec: 'Quebec',
  },
};

@Component({
  selector: 'app-info-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, StudentSelectorPanelComponent],
  templateUrl: './info-management.component.html',
  styleUrl: './info-management.component.scss',
})
export class InfoManagementComponent implements OnInit {
  private readonly selectorContext = 'info-create' as const;
  readonly createStudentColumns: readonly GoalStudentSelectorColumnConfig[] =
    buildGoalStudentSelectorColumns(
      STUDENT_SELECTOR_AVAILABLE_COLUMN_KEYS_BY_CONTEXT[this.selectorContext]
    );
  private readonly createStudentColumnConfigByKey = new Map<
    GoalStudentSelectorColumnKey,
    GoalStudentSelectorColumnConfig
  >(this.createStudentColumns.map((column) => [column.key, column]));
  readonly createStudentFilterFields: readonly StudentSelectorFilterFieldKey[] =
    STUDENT_SELECTOR_FILTER_FIELDS_BY_CONTEXT[this.selectorContext];
  studentOptions: AssignableStudentOptionVm[] = [];
  studentsLoading = false;
  studentsError = '';
  private readonly studentDetails = new Map<number, StudentDetailVm>();
  private readonly studentOptionStatus = new Map<number, 'ACTIVE' | 'ARCHIVED' | ''>();

  countryFilterOptions: string[] = this.buildCountryFilterOptions();
  schoolBoardFilterOptions: string[] = this.buildSchoolBoardFilterBaseOptions();
  graduationSeasonFilterOptions: string[] = [COUNTRY_FILTER_ALL_OPTION];
  createCountryFilterInput = '';
  createCountryFilter = COUNTRY_FILTER_ALL_OPTION;
  createProvinceFilterInput = '';
  createProvinceFilter = '';
  createCityFilterInput = '';
  createCityFilter = '';
  createSchoolBoardFilterInput = '';
  createSchoolBoardFilter = COUNTRY_FILTER_ALL_OPTION;
  createGraduationSeasonFilterInput = '';
  createGraduationSeasonFilter = COUNTRY_FILTER_ALL_OPTION;

  studentPanelExpanded = false;
  studentFilterExpanded = false;
  createStudentColumnPanelExpanded = false;
  createStudentKeyword = '';
  selectedCreateStudentIds = new Set<number>();
  createStudentColumnOrderKeys: GoalStudentSelectorColumnKey[] =
    this.createStudentColumns.map((column) => column.key);
  visibleCreateStudentColumnKeys: Set<GoalStudentSelectorColumnKey> =
    this.buildCreateStudentDefaultVisibleColumnKeys();

  infos: InfoTaskVm[] = [];
  infosLoading = false;
  infosError = '';
  infoFilterCategory: InfoTaskCategory | 'ALL' = 'ALL';
  infoFilterTag = '';
  infoFilterKeyword = '';

  createPanelExpanded = false;
  createInfoCategory: InfoTaskCategory = 'ACTIVITY';
  createInfoTitle = '';
  createInfoContent = '';
  createInfoTags = '';
  creatingInfo = false;
  createInfoError = '';
  createInfoSuccess = '';
  editingInfoId: number | null = null;
  editingInfoTaskGroupId: string | null = null;

  private infosLoadWatchdog: number | null = null;
  private readonly infoTaskGroupIdByInfoId = new Map<number, string>();
  private readonly selectedStudentIdsByInfoId = new Map<number, number[]>();

  readonly isCreateStudentSelectedRef = (studentId: number): boolean =>
    this.isCreateStudentSelected(studentId);
  readonly isSelectedStudentOutOfCurrentFilterRef = (
    student: AssignableStudentOptionVm
  ): boolean => this.isSelectedStudentOutOfCurrentFilter(student);
  readonly isCreateStudentSelectableRowRef = (student: AssignableStudentOptionVm): boolean =>
    this.isCreateStudentSelectableRow(student);
  readonly isCreateStudentColumnVisibleRef = (columnKey: string): boolean => {
    const normalizedKey = this.asCreateStudentColumnKey(columnKey);
    return normalizedKey ? this.isCreateStudentColumnVisible(normalizedKey) : false;
  };
  readonly resolveCreateStudentColumnValueRef = (
    student: AssignableStudentOptionVm,
    columnKey: string
  ): string => {
    const normalizedKey = this.asCreateStudentColumnKey(columnKey);
    return normalizedKey ? this.resolveCreateStudentColumnValue(student, normalizedKey) : '-';
  };
  readonly detailTeacherNoteRef = (studentId: number): string => this.detailTeacherNote(studentId);
  readonly isTeacherNoteSavingRef = (_studentId: number): boolean => false;

  constructor(
    private taskCenter: TaskCenterService,
    private studentManagement: StudentManagementService,
    private router: Router,
    private cdr: ChangeDetectorRef = { detectChanges: () => {} } as ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAssignableStudents();
    this.loadInfos();
  }

  get filteredCreateStudentOptions(): AssignableStudentOptionVm[] {
    const keyword = this.createStudentKeyword.trim().toLowerCase();
    return this.studentOptions.filter((student) =>
      this.matchesCreateStudentFilters(student, keyword)
    );
  }

  get selectedCreateStudentOptions(): AssignableStudentOptionVm[] {
    const byId = new Map<number, AssignableStudentOptionVm>(
      this.studentOptions.map((student) => [student.studentId, student])
    );
    const selected: AssignableStudentOptionVm[] = [];
    for (const studentId of this.selectedCreateStudentIds.values()) {
      const row = byId.get(studentId);
      if (row) selected.push(row);
    }
    return selected;
  }

  get selectedCreateStudentCount(): number {
    return this.selectedCreateStudentIds.size;
  }

  get visibleCreateStudentColumns(): readonly GoalStudentSelectorColumnConfig[] {
    return this.getOrderedCreateStudentColumns().filter((column) =>
      this.visibleCreateStudentColumnKeys.has(column.key)
    );
  }

  get createStudentColumnToggleOptions(): readonly GoalStudentSelectorColumnConfig[] {
    return this.getOrderedCreateStudentColumns();
  }

  get provinceFilterCountry(): ProvinceFilterCountry | '' {
    return this.resolveProvinceFilterCountry(this.createCountryFilter);
  }

  get provinceFilterOptions(): string[] {
    return this.collectProvinceFilterOptions(this.provinceFilterCountry);
  }

  get cityFilterCountry(): ProvinceFilterCountry | '' {
    return this.provinceFilterCountry;
  }

  get cityFilterOptions(): string[] {
    return this.collectCityFilterOptions(this.cityFilterCountry);
  }

  get isEditMode(): boolean {
    return this.editingInfoId !== null && !!this.editingInfoTaskGroupId;
  }

  goDashboard(): void {
    this.router.navigate(['/teacher/dashboard']);
  }

  openCreatePanel(): void {
    if (this.creatingInfo) return;
    this.editingInfoId = null;
    this.editingInfoTaskGroupId = null;
    this.resetCreateInfoForm();
    this.createPanelExpanded = true;
  }

  openEditPanel(info: InfoTaskVm): void {
    if (this.creatingInfo) return;

    const taskGroupId = this.resolveInfoTaskGroupId(info);
    if (!taskGroupId) {
      this.createInfoError = '当前通知缺少 taskGroupId，暂不支持覆盖编辑。';
      this.createInfoSuccess = '';
      this.cdr.detectChanges();
      return;
    }

    this.editingInfoId = info.id;
    this.editingInfoTaskGroupId = taskGroupId;
    this.createPanelExpanded = true;
    this.studentPanelExpanded = true;
    this.studentFilterExpanded = false;
    this.createStudentColumnPanelExpanded = false;
    this.createInfoCategory = info.category;
    this.createInfoTitle = info.title;
    this.createInfoContent = info.content;
    this.createInfoTags = (info.tags || []).join(',');
    const selectedIds = this.resolveInfoRecipientStudentIds(info.id);
    this.selectedCreateStudentIds = new Set<number>(selectedIds);
    this.createInfoError =
      selectedIds.length > 0 ? '' : '请重新选择通知接收学生，然后保存。';
    this.createInfoSuccess = '';
    this.cdr.detectChanges();
  }

  closeCreatePanel(): void {
    if (this.creatingInfo) return;
    this.createPanelExpanded = false;
    this.studentPanelExpanded = false;
    this.studentFilterExpanded = false;
    this.createStudentColumnPanelExpanded = false;
    this.editingInfoId = null;
    this.editingInfoTaskGroupId = null;
  }

  onCreatePanelBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeCreatePanel();
  }

  toggleStudentPanel(): void {
    this.studentPanelExpanded = !this.studentPanelExpanded;
    if (!this.studentPanelExpanded) {
      this.studentFilterExpanded = false;
      this.createStudentColumnPanelExpanded = false;
    }
  }

  toggleStudentFilterPanel(): void {
    this.studentFilterExpanded = !this.studentFilterExpanded;
  }

  toggleCreateStudentColumnPanel(): void {
    this.createStudentColumnPanelExpanded = !this.createStudentColumnPanelExpanded;
  }

  refreshInfos(): void {
    this.loadInfos();
  }

  refreshAssignableStudents(): void {
    this.loadAssignableStudents();
  }

  applyInfoFilters(): void {
    this.loadInfos();
  }

  clearInfoFilters(): void {
    this.infoFilterCategory = 'ALL';
    this.infoFilterTag = '';
    this.infoFilterKeyword = '';
    this.loadInfos();
  }

  onStudentKeywordChange(value?: string): void {
    if (typeof value === 'string') {
      this.createStudentKeyword = value;
    }
  }

  onCountryFilterInputChange(value: string): void {
    const input = String(value ?? '').trim();
    this.createCountryFilterInput = input;
    this.createCountryFilter = input
      ? this.resolveCountryFilterInputSelection(input)
      : COUNTRY_FILTER_ALL_OPTION;
    this.syncProvinceFilterSelection();
    this.syncCityFilterSelection();
    this.syncSchoolBoardFilterSelection();
    this.syncGraduationSeasonFilterSelection();
  }

  onProvinceFilterInputChange(value: string): void {
    const input = String(value ?? '').trim();
    this.createProvinceFilterInput = input;
    const country = this.provinceFilterCountry;
    this.createProvinceFilter = input ? this.resolveProvinceFilterSelection(input, country) : '';
  }

  onCityFilterInputChange(value: string): void {
    const input = String(value ?? '').trim();
    this.createCityFilterInput = input;
    const country = this.cityFilterCountry;
    this.createCityFilter = input ? this.resolveCityFilterSelection(input, country) : '';
  }

  onSchoolBoardFilterInputChange(value: string): void {
    const input = String(value ?? '').trim();
    this.createSchoolBoardFilterInput = input;
    this.createSchoolBoardFilter = input
      ? this.resolveSchoolBoardFilterSelection(input)
      : COUNTRY_FILTER_ALL_OPTION;
    this.syncGraduationSeasonFilterSelection();
  }

  onGraduationSeasonFilterInputChange(value: string): void {
    const input = String(value ?? '').trim();
    this.createGraduationSeasonFilterInput = input;
    this.createGraduationSeasonFilter = input
      ? this.resolveGraduationSeasonFilterSelection(input)
      : COUNTRY_FILTER_ALL_OPTION;
  }

  resetStudentMetaFilters(): void {
    this.createCountryFilterInput = '';
    this.createCountryFilter = COUNTRY_FILTER_ALL_OPTION;
    this.createProvinceFilterInput = '';
    this.createProvinceFilter = '';
    this.createCityFilterInput = '';
    this.createCityFilter = '';
    this.createSchoolBoardFilterInput = '';
    this.createSchoolBoardFilter = COUNTRY_FILTER_ALL_OPTION;
    this.createGraduationSeasonFilterInput = '';
    this.createGraduationSeasonFilter = COUNTRY_FILTER_ALL_OPTION;
    this.createStudentKeyword = '';
  }

  resetCreateInfoForm(): void {
    this.createInfoCategory = 'ACTIVITY';
    this.createInfoTitle = '';
    this.createInfoContent = '';
    this.createInfoTags = '';
    this.resetStudentMetaFilters();
    this.selectedCreateStudentIds.clear();
    this.createInfoError = '';
    this.createInfoSuccess = '';
  }

  private getOrderedCreateStudentColumns(): GoalStudentSelectorColumnConfig[] {
    const ordered: GoalStudentSelectorColumnConfig[] = [];
    const seen = new Set<GoalStudentSelectorColumnKey>();
    const normalizedOrder = this.normalizeCreateStudentColumnOrderKeys(this.createStudentColumnOrderKeys);
    for (const key of normalizedOrder) {
      const config = this.createStudentColumnConfigByKey.get(key);
      if (!config || seen.has(key)) continue;
      seen.add(key);
      ordered.push(config);
    }
    for (const column of this.createStudentColumns) {
      if (seen.has(column.key)) continue;
      seen.add(column.key);
      ordered.push(column);
    }
    return ordered;
  }

  private findCreateStudentColumnConfig(columnKey: string): GoalStudentSelectorColumnConfig | null {
    const key = this.asCreateStudentColumnKey(columnKey);
    return key ? this.createStudentColumnConfigByKey.get(key) ?? null : null;
  }

  private asCreateStudentColumnKey(columnKey: string): GoalStudentSelectorColumnKey | null {
    const normalized = String(columnKey ?? '').trim();
    if (!normalized) return null;
    return this.createStudentColumnConfigByKey.has(normalized as GoalStudentSelectorColumnKey)
      ? (normalized as GoalStudentSelectorColumnKey)
      : null;
  }

  private normalizeCreateStudentColumnOrderKeys(
    keys: readonly string[]
  ): GoalStudentSelectorColumnKey[] {
    const normalized: GoalStudentSelectorColumnKey[] = [];
    const seen = new Set<GoalStudentSelectorColumnKey>();
    for (const key of keys) {
      const normalizedKey = this.asCreateStudentColumnKey(key);
      if (!normalizedKey || seen.has(normalizedKey)) continue;
      seen.add(normalizedKey);
      normalized.push(normalizedKey);
    }

    for (const column of this.createStudentColumns) {
      if (seen.has(column.key)) continue;
      seen.add(column.key);
      normalized.push(column.key);
    }

    return normalized;
  }

  private normalizeCreateStudentVisibleColumnOrderKeys(
    keys: readonly string[]
  ): GoalStudentSelectorColumnKey[] {
    const normalized: GoalStudentSelectorColumnKey[] = [];
    const seen = new Set<GoalStudentSelectorColumnKey>();
    for (const key of keys) {
      const normalizedKey = this.asCreateStudentColumnKey(key);
      if (!normalizedKey || seen.has(normalizedKey)) continue;
      seen.add(normalizedKey);
      normalized.push(normalizedKey);
    }
    return normalized;
  }

  onCreateStudentColumnOrderChange(orderedVisibleColumnKeys: readonly string[]): void {
    const normalizedVisibleOrder =
      this.normalizeCreateStudentVisibleColumnOrderKeys(orderedVisibleColumnKeys);
    if (normalizedVisibleOrder.length < 2) return;

    const visibleSet = new Set<GoalStudentSelectorColumnKey>(normalizedVisibleOrder);
    const normalizedOrder = this.normalizeCreateStudentColumnOrderKeys(this.createStudentColumnOrderKeys);
    const currentVisibleOrder = normalizedOrder.filter((key) => visibleSet.has(key));
    if (
      currentVisibleOrder.length !== normalizedVisibleOrder.length ||
      currentVisibleOrder.some((key, index) => key !== normalizedVisibleOrder[index])
    ) {
      let visibleIndex = 0;
      this.createStudentColumnOrderKeys = normalizedOrder.map((key) =>
        visibleSet.has(key) ? normalizedVisibleOrder[visibleIndex++] : key
      );
    }
  }

  isCreateStudentColumnVisible(columnKey: GoalStudentSelectorColumnKey): boolean {
    return this.visibleCreateStudentColumnKeys.has(columnKey);
  }

  onCreateStudentColumnVisibilityChange(columnKey: string, event: Event | boolean): void {
    const config = this.findCreateStudentColumnConfig(columnKey);
    if (!config || !config.hideable) return;

    const checked =
      typeof event === 'boolean'
        ? event
        : (event.target as HTMLInputElement | null)?.checked === true;
    const next = new Set(this.visibleCreateStudentColumnKeys);
    if (checked) next.add(config.key);
    else next.delete(config.key);

    for (const requiredColumn of this.createStudentColumns) {
      if (!requiredColumn.hideable) {
        next.add(requiredColumn.key);
      }
    }

    this.visibleCreateStudentColumnKeys = next;
  }

  resetCreateStudentVisibleColumns(): void {
    this.createStudentColumnOrderKeys = this.createStudentColumns.map((column) => column.key);
    this.visibleCreateStudentColumnKeys = this.buildCreateStudentDefaultVisibleColumnKeys();
  }

  isCreateStudentColumnSelectionAtDefault(): boolean {
    const defaultSet = this.buildCreateStudentDefaultVisibleColumnKeys();
    if (defaultSet.size !== this.visibleCreateStudentColumnKeys.size) {
      return false;
    }
    for (const key of defaultSet.values()) {
      if (!this.visibleCreateStudentColumnKeys.has(key)) {
        return false;
      }
    }
    const normalizedOrder = this.normalizeCreateStudentColumnOrderKeys(this.createStudentColumnOrderKeys);
    return (
      normalizedOrder.length === this.createStudentColumns.length &&
      normalizedOrder.every((key, index) => key === this.createStudentColumns[index]?.key)
    );
  }

  private buildCreateStudentDefaultVisibleColumnKeys(): Set<GoalStudentSelectorColumnKey> {
    const presetKeys = STUDENT_SELECTOR_DEFAULT_COLUMN_KEYS_BY_CONTEXT[this.selectorContext];
    return buildPresetVisibleColumnKeys(this.createStudentColumns, presetKeys);
  }

  onCreateStudentCheckboxChange(studentId: number, event: Event | boolean): void {
    if (typeof event !== 'boolean') {
      event.stopPropagation();
    }
    if (this.creatingInfo) return;
    const checked =
      typeof event === 'boolean'
        ? event
        : (event.target as HTMLInputElement | null)?.checked === true;
    if (checked && !this.isCreateStudentSelectable(studentId)) {
      return;
    }
    if (checked) {
      this.selectedCreateStudentIds.add(studentId);
    } else {
      this.selectedCreateStudentIds.delete(studentId);
    }
  }

  onCreateStudentToggle(studentId: number, event: Event | boolean): void {
    this.onCreateStudentCheckboxChange(studentId, event);
  }

  clearSelectedStudents(): void {
    if (this.creatingInfo) return;
    this.selectedCreateStudentIds.clear();
  }

  onToggleSelectAll(event: Event | boolean): void {
    if (this.creatingInfo) return;
    const checked =
      typeof event === 'boolean'
        ? event
        : (event.target as HTMLInputElement | null)?.checked === true;
    for (const row of this.filteredCreateStudentOptions) {
      if (!this.isCreateStudentSelectable(row.studentId)) {
        this.selectedCreateStudentIds.delete(row.studentId);
        continue;
      }
      if (checked) {
        this.selectedCreateStudentIds.add(row.studentId);
      } else {
        this.selectedCreateStudentIds.delete(row.studentId);
      }
    }
  }

  isCreateStudentSelected(studentId: number): boolean {
    return this.selectedCreateStudentIds.has(studentId);
  }

  areAllVisibleStudentsSelected(): boolean {
    const rows = this.filteredCreateStudentOptions.filter((row) =>
      this.isCreateStudentSelectable(row.studentId)
    );
    return rows.length > 0 && rows.every((row) => this.selectedCreateStudentIds.has(row.studentId));
  }

  isVisibleStudentSelectionPartial(): boolean {
    const rows = this.filteredCreateStudentOptions.filter((row) =>
      this.isCreateStudentSelectable(row.studentId)
    );
    if (rows.length === 0) return false;
    const selectedCount = rows.filter((row) => this.selectedCreateStudentIds.has(row.studentId)).length;
    return selectedCount > 0 && selectedCount < rows.length;
  }

  isSelectedStudentOutOfCurrentFilter(student: AssignableStudentOptionVm): boolean {
    return !this.matchesCreateStudentFilters(student, this.createStudentKeyword.trim().toLowerCase());
  }

  detailEmail(studentId: number): string {
    return this.studentDetails.get(studentId)?.email || '-';
  }

  detailPhone(studentId: number): string {
    return this.studentDetails.get(studentId)?.phone || '-';
  }

  detailGraduation(studentId: number): string {
    return this.studentDetails.get(studentId)?.graduation || '-';
  }

  detailSchoolName(studentId: number): string {
    return this.studentDetails.get(studentId)?.schoolName || '-';
  }

  detailCanadaIdentity(studentId: number): string {
    return this.studentDetails.get(studentId)?.canadaIdentity || '-';
  }

  detailGender(studentId: number): string {
    return this.studentDetails.get(studentId)?.gender || '-';
  }

  detailNationality(studentId: number): string {
    return this.studentDetails.get(studentId)?.nationality || '-';
  }

  detailFirstLanguage(studentId: number): string {
    return this.studentDetails.get(studentId)?.firstLanguage || '-';
  }

  detailMotherLanguage(studentId: number): string {
    return this.studentDetails.get(studentId)?.motherLanguage || '-';
  }

  detailSchoolBoard(studentId: number): string {
    return this.studentDetails.get(studentId)?.schoolBoard || '-';
  }

  detailCountry(studentId: number): string {
    return this.studentDetails.get(studentId)?.country || '-';
  }

  detailProvince(studentId: number): string {
    return this.studentDetails.get(studentId)?.province || '-';
  }

  detailCity(studentId: number): string {
    return this.studentDetails.get(studentId)?.city || '-';
  }

  detailStatus(studentId: number): string {
    return this.resolveArchiveStatusLabel(this.studentDetails.get(studentId)?.status || '');
  }

  detailSelectable(studentId: number): string {
    return this.isCreateStudentSelectable(studentId) ? '可选' : '已锁定';
  }

  detailTeacherNote(studentId: number): string {
    return this.studentDetails.get(studentId)?.teacherNote || '';
  }

  resolveCreateStudentColumnValue(
    student: AssignableStudentOptionVm,
    columnKey: GoalStudentSelectorColumnKey
  ): string {
    switch (columnKey) {
      case 'name':
        return student.studentName || '-';
      case 'email':
        return this.detailEmail(student.studentId);
      case 'phone':
        return this.detailPhone(student.studentId);
      case 'graduation':
        return this.detailGraduation(student.studentId);
      case 'schoolName':
        return this.detailSchoolName(student.studentId);
      case 'canadaIdentity':
        return this.detailCanadaIdentity(student.studentId);
      case 'gender':
        return this.detailGender(student.studentId);
      case 'nationality':
        return this.detailNationality(student.studentId);
      case 'firstLanguage':
        return this.detailFirstLanguage(student.studentId);
      case 'motherLanguage':
        return this.detailMotherLanguage(student.studentId);
      case 'schoolBoard':
        return this.detailSchoolBoard(student.studentId);
      case 'country':
        return this.detailCountry(student.studentId);
      case 'province':
        return this.detailProvince(student.studentId);
      case 'city':
        return this.detailCity(student.studentId);
      case 'teacherNote':
        return this.detailTeacherNote(student.studentId) || '-';
      case 'status':
        return this.detailStatus(student.studentId);
      case 'selectable':
        return this.detailSelectable(student.studentId);
      default:
        return '-';
    }
  }

  isCreateStudentSelectable(studentId: number): boolean {
    const detailStatus = this.studentDetails.get(studentId)?.status || '';
    if (detailStatus === 'ARCHIVED') return false;
    return this.studentOptionStatus.get(studentId) !== 'ARCHIVED';
  }

  isCreateStudentSelectableById(studentId: number): boolean {
    return this.isCreateStudentSelectable(studentId);
  }

  isCreateStudentSelectableRow(student: AssignableStudentOptionVm): boolean {
    const detail = this.studentDetails.get(student.studentId);
    return this.resolveCreateStudentStatus(student, detail) !== 'ARCHIVED';
  }

  onTeacherNoteCellFocus(_studentId: number): void {}

  onTeacherNoteCellChange(studentId: number, value: unknown): void {
    this.setTeacherNote(studentId, String(value ?? ''));
    this.cdr.detectChanges();
  }

  onTeacherNoteCellBlur(_studentId: number): void {}

  createInfo(): void {
    if (this.creatingInfo) return;

    const selectedStudentIds = Array.from(this.selectedCreateStudentIds.values())
      .filter((studentId) => this.isCreateStudentSelectable(studentId))
      .sort((a, b) => a - b);
    if (selectedStudentIds.length === 0) {
      this.studentPanelExpanded = true;
      this.createInfoError = '请至少选择 1 位学生。';
      this.createInfoSuccess = '';
      return;
    }

    const title = this.createInfoTitle.trim();
    if (!title) {
      this.createInfoError = '请填写通知标题。';
      this.createInfoSuccess = '';
      return;
    }

    const content = this.createInfoContent.trim();
    if (!content) {
      this.createInfoError = '请填写通知内容。';
      this.createInfoSuccess = '';
      return;
    }

    if (this.isEditMode) {
      this.saveEditedInfo(selectedStudentIds, title, content);
      return;
    }

    this.createNewInfo(selectedStudentIds, title, content);
  }

  private createNewInfo(selectedStudentIds: number[], title: string, content: string): void {
    const taskGroupId = this.generateInfoTaskGroupId();
    const request: CreateInfoRequestVm = {
      category: this.createInfoCategory,
      title,
      content,
      tags: this.parseTags(this.createInfoTags),
      studentIds: selectedStudentIds,
      taskGroupId,
    };

    this.creatingInfo = true;
    this.createInfoError = '';
    this.createInfoSuccess = '';
    this.cdr.detectChanges();

    this.taskCenter
      .createInfo(request)
      .pipe(
        finalize(() => {
          this.creatingInfo = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (info) => {
          this.rememberInfoMappings(info.id, taskGroupId, selectedStudentIds);
          this.createInfoSuccess = `通知已发布（${selectedStudentIds.length} 人）：#${info.id} ${info.title}`;
          this.createInfoTitle = '';
          this.createInfoContent = '';
          this.createInfoTags = '';
          this.resetStudentMetaFilters();
          this.selectedCreateStudentIds.clear();
          this.loadInfos();
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.createInfoError = this.extractErrorMessage(error) || '发布通知失败。';
          this.cdr.detectChanges();
        },
      });
  }

  private saveEditedInfo(selectedStudentIds: number[], title: string, content: string): void {
    const taskGroupId = this.normalizeTaskGroupId(this.editingInfoTaskGroupId);
    const editingInfoId = this.editingInfoId;
    if (!taskGroupId || !editingInfoId) {
      this.createInfoError = '当前通知缺少 taskGroupId，无法覆盖更新。';
      this.createInfoSuccess = '';
      this.cdr.detectChanges();
      return;
    }

    const request: CreateInfoRequestVm = {
      category: this.createInfoCategory,
      title,
      content,
      tags: this.parseTags(this.createInfoTags),
      studentIds: selectedStudentIds,
      taskGroupId,
    };

    this.creatingInfo = true;
    this.createInfoError = '';
    this.createInfoSuccess = '';
    this.cdr.detectChanges();

    this.taskCenter
      .createInfo(request)
      .pipe(
        finalize(() => {
          this.creatingInfo = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (info) => {
          this.rememberInfoMappings(info.id, taskGroupId, selectedStudentIds);
          this.rememberInfoMappings(editingInfoId, taskGroupId, selectedStudentIds);
          this.createInfoSuccess = `通知已更新（覆盖 ${selectedStudentIds.length} 人）：#${info.id} ${info.title}`;
          this.createInfoError = '';
          this.loadInfos();
        },
        error: (error: unknown) => {
          this.createInfoError = this.extractErrorMessage(error) || '更新通知失败。';
          this.cdr.detectChanges();
        },
      });
  }

  trackInfo = (_index: number, info: InfoTaskVm): number => info.id;
  trackStudent = (_index: number, student: AssignableStudentOptionVm): number => student.studentId;

  canEditInfo(info: InfoTaskVm): boolean {
    return !!this.resolveInfoTaskGroupId(info);
  }

  infoEditDisabledReason(info: InfoTaskVm): string {
    return this.canEditInfo(info) ? '' : '该通知缺少 taskGroupId，暂不支持覆盖编辑。';
  }

  infoCategoryLabel(category: InfoTaskCategory): string {
    return category === 'VOLUNTEER' ? '义工' : '活动';
  }

  private loadAssignableStudents(): void {
    this.studentsLoading = true;
    this.studentsError = '';
    this.taskCenter
      .listAssignableStudents()
      .pipe(
        finalize(() => {
          this.studentsLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (rows) => {
          this.studentOptions = [...rows].sort((a, b) => a.studentId - b.studentId);
          this.rebuildStudentOptionStatusMap();
          this.syncSelectedStudents();
          this.pruneStudentDetails();
          this.hydrateStudentDetailsFromAccounts();
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.studentsError = this.extractErrorMessage(error) || '加载学生列表失败。';
          this.studentOptions = [];
          this.studentOptionStatus.clear();
          this.selectedCreateStudentIds.clear();
          this.studentDetails.clear();
          this.rebuildMetaFilterOptions();
          this.cdr.detectChanges();
        },
      });
  }

  private hydrateStudentDetailsFromAccounts(): void {
    const validIds = new Set(this.studentOptions.map((row) => row.studentId));
    this.studentManagement
      .listStudents()
      .pipe(catchError(() => of([] as StudentAccount[])))
      .subscribe((resp) => {
        const accounts = this.normalizeAccounts(resp);
        for (const account of accounts) {
          const studentId = this.resolveStudentId(account);
          if (studentId === null || !validIds.has(studentId)) continue;
          this.upsertDetail(studentId, this.buildFromAccount(account));
        }
        this.pruneUnselectableSelectedStudents();
        this.rebuildMetaFilterOptions();
        this.cdr.detectChanges();
      });
  }

  private loadInfos(): void {
    this.infosLoading = true;
    this.infosError = '';
    this.startInfosLoadWatchdog();
    this.cdr.detectChanges();

    this.taskCenter
      .listTeacherInfos({
        category: this.infoFilterCategory,
        tag: this.infoFilterTag,
        keyword: this.infoFilterKeyword,
        page: 1,
        size: 100,
      })
      .pipe(
        finalize(() => {
          this.infosLoading = false;
          this.clearInfosLoadWatchdog();
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (resp) => {
          this.infos = (resp.items || []).map((info) => {
            const taskGroupId =
              this.normalizeTaskGroupId(info.taskGroupId) ||
              this.infoTaskGroupIdByInfoId.get(info.id) ||
              null;
            if (taskGroupId) {
              this.infoTaskGroupIdByInfoId.set(info.id, taskGroupId);
            }
            return {
              ...info,
              taskGroupId,
            };
          });
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.infosError = this.extractErrorMessage(error) || '加载通知失败。';
          this.infos = [];
          this.cdr.detectChanges();
        },
      });
  }

  private matchesCreateStudentFilters(student: AssignableStudentOptionVm, keyword: string): boolean {
    const detail = this.studentDetails.get(student.studentId);
    if (this.resolveCreateStudentStatus(student, detail) === 'ARCHIVED') return false;
    if (!this.matchesCountryFilter(detail)) return false;
    if (!this.matchesProvinceFilter(detail)) return false;
    if (!this.matchesCityFilter(detail)) return false;
    if (!this.matchesSchoolBoardFilter(detail)) return false;
    if (!this.matchesGraduationSeasonFilter(detail)) return false;
    if (!keyword) return true;

    return this.buildCreateStudentSearchText(student, detail).includes(keyword);
  }

  private buildCreateStudentSearchText(
    student: AssignableStudentOptionVm,
    detail: StudentDetailVm | undefined
  ): string {
    const status = this.resolveCreateStudentStatus(student, detail);
    return [
      String(student.studentId),
      student.studentName,
      student.username || '',
      detail?.email || '',
      detail?.phone || '',
      detail?.schoolName || '',
      detail?.canadaIdentity || '',
      detail?.gender || '',
      detail?.nationality || '',
      detail?.firstLanguage || '',
      detail?.motherLanguage || '',
      detail?.province || '',
      detail?.city || '',
      detail?.graduation || '',
      detail?.teacherNote || '',
      detail?.country || '',
      detail?.schoolBoard || '',
      detail?.graduationSeason || '',
      this.resolveArchiveStatusLabel(status),
      status,
      this.isCreateStudentSelectable(student.studentId) ? '可选 selectable' : '不可选 not selectable',
    ]
      .join(' ')
      .toLowerCase();
  }

  private matchesCountryFilter(detail: StudentDetailVm | undefined): boolean {
    const selected = this.resolveCountryFilterSelection(this.createCountryFilter);
    if (selected === 'ALL') {
      return true;
    }

    const studentCountry = this.normalizeCountryFilterValue(detail?.country) || 'N/A';
    if (selected === 'N/A') {
      return studentCountry === 'N/A';
    }
    if (selected === 'Canada') {
      return studentCountry === 'Canada' || studentCountry === 'N/A';
    }
    return studentCountry === selected;
  }

  private matchesProvinceFilter(detail: StudentDetailVm | undefined): boolean {
    const selectedKey = this.normalizeCountryKey(this.createProvinceFilter);
    if (!selectedKey) {
      return true;
    }

    const detailCountry = this.resolveProvinceFilterCountry(detail?.country);
    const studentProvince = this.normalizeProvinceValueForDetail(detail?.province, detailCountry);
    const studentKey = this.normalizeCountryKey(studentProvince);
    return !!studentKey && studentKey === selectedKey;
  }

  private matchesCityFilter(detail: StudentDetailVm | undefined): boolean {
    const selectedKey = this.normalizeCountryKey(this.createCityFilter);
    if (!selectedKey) {
      return true;
    }

    const detailCountry = this.resolveProvinceFilterCountry(detail?.country);
    const studentCity = this.normalizeCityValueForDetail(detail?.city, detailCountry);
    const studentKey = this.normalizeCountryKey(studentCity);
    return !!studentKey && studentKey === selectedKey;
  }

  private matchesSchoolBoardFilter(detail: StudentDetailVm | undefined): boolean {
    if (this.createSchoolBoardFilter === COUNTRY_FILTER_ALL_OPTION) {
      return true;
    }

    const selectedKey = this.normalizeCountryKey(this.createSchoolBoardFilter);
    const studentKey = this.normalizeCountryKey(detail?.schoolBoard);
    return !!selectedKey && selectedKey === studentKey;
  }

  private matchesGraduationSeasonFilter(detail: StudentDetailVm | undefined): boolean {
    if (this.createGraduationSeasonFilter === COUNTRY_FILTER_ALL_OPTION) {
      return true;
    }

    const selected = this.normalizeGraduationSeasonFilterValue(this.createGraduationSeasonFilter);
    const student = this.normalizeGraduationSeasonFilterValue(detail?.graduationSeason);
    return !!selected && selected === student;
  }

  private syncSelectedStudents(): void {
    const validIds = new Set(this.studentOptions.map((row) => row.studentId));
    this.selectedCreateStudentIds = new Set(
      Array.from(this.selectedCreateStudentIds.values()).filter((id) => validIds.has(id))
    );
  }

  private pruneStudentDetails(): void {
    const validIds = new Set(this.studentOptions.map((row) => row.studentId));
    for (const studentId of Array.from(this.studentDetails.keys())) {
      if (!validIds.has(studentId)) this.studentDetails.delete(studentId);
    }
  }

  private pruneUnselectableSelectedStudents(): void {
    this.selectedCreateStudentIds = new Set(
      Array.from(this.selectedCreateStudentIds.values()).filter((studentId) =>
        this.isCreateStudentSelectable(studentId)
      )
    );
  }

  private normalizeAccountStatus(value: unknown): 'ACTIVE' | 'ARCHIVED' | '' {
    const status = String(value ?? '').trim().toUpperCase();
    if (status === 'ACTIVE') return 'ACTIVE';
    if (status === 'ARCHIVED') return 'ARCHIVED';
    return '';
  }

  private resolveAssignableStudentStatus(
    student: AssignableStudentOptionVm | undefined
  ): 'ACTIVE' | 'ARCHIVED' | '' {
    if (!student || typeof student !== 'object') return '';
    const raw = student as unknown as Record<string, unknown>;
    const normalizedStatus = this.normalizeAccountStatus(raw['status']);
    if (normalizedStatus) return normalizedStatus;

    const archived = raw['archived'];
    if (typeof archived === 'boolean') {
      return archived ? 'ARCHIVED' : 'ACTIVE';
    }

    const active = raw['active'];
    if (typeof active === 'boolean') {
      return active ? 'ACTIVE' : 'ARCHIVED';
    }

    const enabled = raw['enabled'];
    if (typeof enabled === 'boolean') {
      return enabled ? 'ACTIVE' : 'ARCHIVED';
    }

    return '';
  }

  private resolveCreateStudentStatus(
    student: AssignableStudentOptionVm,
    detail: StudentDetailVm | undefined
  ): 'ACTIVE' | 'ARCHIVED' | '' {
    if (detail?.status) {
      return detail.status;
    }
    return this.resolveAssignableStudentStatus(student);
  }

  private rebuildStudentOptionStatusMap(): void {
    this.studentOptionStatus.clear();
    for (const student of this.studentOptions) {
      this.studentOptionStatus.set(student.studentId, this.resolveAssignableStudentStatus(student));
    }
  }

  private resolveArchiveStatusLabel(status: 'ACTIVE' | 'ARCHIVED' | ''): string {
    if (status === 'ACTIVE') return '在读';
    if (status === 'ARCHIVED') return '已归档';
    return '未知';
  }

  private upsertDetail(studentId: number, patch: Partial<StudentDetailVm>): void {
    const current = this.studentDetails.get(studentId) || {
      email: '',
      phone: '',
      province: '',
      city: '',
      graduation: '',
      schoolName: '',
      canadaIdentity: '',
      gender: '',
      nationality: '',
      firstLanguage: '',
      motherLanguage: '',
      teacherNote: '',
      country: '',
      schoolBoard: '',
      graduationSeason: '',
      status: '',
    };
    const graduation = patch.graduation?.trim() || current.graduation;
    const graduationSeason = patch.graduationSeason?.trim() || this.resolveGraduationSeason(graduation);
    this.studentDetails.set(studentId, {
      email: patch.email?.trim() || current.email,
      phone: patch.phone?.trim() || current.phone,
      province: patch.province?.trim() || current.province,
      city: patch.city?.trim() || current.city,
      graduation,
      schoolName: patch.schoolName?.trim() || current.schoolName,
      canadaIdentity: patch.canadaIdentity?.trim() || current.canadaIdentity,
      gender: patch.gender?.trim() || current.gender,
      nationality: patch.nationality?.trim() || current.nationality,
      firstLanguage: patch.firstLanguage?.trim() || current.firstLanguage,
      motherLanguage: patch.motherLanguage?.trim() || current.motherLanguage,
      teacherNote: patch.teacherNote?.trim() || current.teacherNote,
      country: patch.country?.trim() || current.country,
      schoolBoard: patch.schoolBoard?.trim() || current.schoolBoard,
      graduationSeason,
      status: patch.status || current.status,
    });
  }

  private setTeacherNote(studentId: number, noteText: string): void {
    const current = this.studentDetails.get(studentId) || {
      email: '',
      phone: '',
      province: '',
      city: '',
      graduation: '',
      schoolName: '',
      canadaIdentity: '',
      gender: '',
      nationality: '',
      firstLanguage: '',
      motherLanguage: '',
      teacherNote: '',
      country: '',
      schoolBoard: '',
      graduationSeason: '',
      status: '',
    };
    this.studentDetails.set(studentId, {
      ...current,
      teacherNote: String(noteText ?? ''),
    });
  }

  private buildFromAccount(student: StudentAccount): Partial<StudentDetailVm> {
    const profile =
      student?.['profile'] && typeof student['profile'] === 'object'
        ? (student['profile'] as Record<string, unknown>)
        : {};
    const graduation = this.formatGraduation(
      this.pick([
        student['currentSchoolExpectedGraduation'],
        student['expectedGraduationTime'],
        student['expectedGraduationDate'],
        profile['currentSchoolExpectedGraduation'],
        profile['expectedGraduationTime'],
        profile['expectedGraduationDate'],
      ])
    );
    return {
      email: this.pick([student.email, student['emailAddress'], student['contactEmail'], profile['email']]),
      phone: this.pick([student.phone, student['phoneNumber'], student['mobile'], profile['phone']]),
      province: this.pick([
        student['currentSchoolProvince'],
        student['schoolProvince'],
        student['province'],
        profile['currentSchoolProvince'],
        profile['province'],
      ]),
      city: this.pick([
        student['currentSchoolCity'],
        student['schoolCity'],
        student['city'],
        profile['currentSchoolCity'],
        profile['city'],
      ]),
      graduation,
      schoolName: this.pick([
        student['currentSchoolName'],
        student['schoolName'],
        student['school'],
        profile['currentSchoolName'],
        profile['schoolName'],
      ]),
      canadaIdentity: this.pick([
        student['identityInCanada'],
        student['statusInCanada'],
        student['canadaIdentity'],
        profile['identityInCanada'],
        profile['statusInCanada'],
      ]),
      gender: this.pick([student['gender'], student['sex'], profile['gender'], profile['sex']]),
      nationality: this.pick([student['nationality'], student['citizenship'], profile['nationality']]),
      firstLanguage: this.pick([
        student['firstLanguage'],
        student['primaryLanguage'],
        student['nativeLanguage'],
        student['motherTongue'],
        profile['firstLanguage'],
        profile['primaryLanguage'],
        profile['nativeLanguage'],
        profile['motherTongue'],
      ]),
      motherLanguage: this.pick([
        student['motherLanguage'],
        student['motherTongue'],
        student['nativeLanguage'],
        profile['motherLanguage'],
        profile['motherTongue'],
        profile['nativeLanguage'],
      ]),
      teacherNote: this.pick([student['teacherNote'], student['teacherNotes'], profile['teacherNote']]),
      country: this.pick([
        student['currentSchoolCountry'],
        student['schoolCountry'],
        student['country'],
        profile['currentSchoolCountry'],
      ]),
      schoolBoard: this.pick([
        student['currentSchoolBoard'],
        student['schoolBoard'],
        student['educationBoard'],
        profile['currentSchoolBoard'],
      ]),
      graduationSeason: this.resolveGraduationSeason(graduation),
      status: this.normalizeAccountStatus(student.status),
    };
  }

  private rebuildMetaFilterOptions(): void {
    const validIds = new Set(this.studentOptions.map((row) => row.studentId));
    const countries = new Set<string>();
    const boards = new Set<string>();
    const seasons = new Set<string>();
    for (const [studentId, detail] of this.studentDetails.entries()) {
      if (!validIds.has(studentId)) continue;
      if (detail.country) countries.add(detail.country);
      if (detail.schoolBoard) boards.add(detail.schoolBoard);
      if (detail.graduationSeason) seasons.add(detail.graduationSeason);
    }

    this.countryFilterOptions = this.mergeFilterOptions(
      this.buildCountryFilterOptions(),
      Array.from(countries)
    );
    this.schoolBoardFilterOptions = this.mergeFilterOptions(
      this.buildSchoolBoardFilterBaseOptions(),
      Array.from(boards)
    );
    this.graduationSeasonFilterOptions = this.mergeFilterOptions(
      [COUNTRY_FILTER_ALL_OPTION],
      Array.from(seasons)
    );

    this.syncCountryFilterSelection();
    this.syncProvinceFilterSelection();
    this.syncCityFilterSelection();
    this.syncSchoolBoardFilterSelection();
    this.syncGraduationSeasonFilterSelection();
  }

  private collectProvinceFilterOptions(country: ProvinceFilterCountry | '' = ''): string[] {
    const baseOptions = country
      ? PROVINCE_FILTER_OPTIONS_BY_COUNTRY[country]
      : PROVINCE_FILTER_COUNTRIES.flatMap(
          (supportedCountry) => PROVINCE_FILTER_OPTIONS_BY_COUNTRY[supportedCountry]
        );
    const validIds = new Set(this.studentOptions.map((row) => row.studentId));
    const options: string[] = [];
    for (const [studentId, detail] of this.studentDetails.entries()) {
      if (!validIds.has(studentId)) continue;
      const detailCountry = this.resolveProvinceFilterCountry(detail.country);
      if (country && detailCountry !== country) continue;
      const province = this.normalizeProvinceValueForDetail(detail.province, country || detailCountry);
      if (province) {
        options.push(province);
      }
    }
    return this.mergeFilterOptions(baseOptions, options);
  }

  private collectCityFilterOptions(country: ProvinceFilterCountry | '' = ''): string[] {
    const baseOptions = country
      ? CITY_FILTER_OPTIONS_BY_COUNTRY[country]
      : PROVINCE_FILTER_COUNTRIES.flatMap(
          (supportedCountry) => CITY_FILTER_OPTIONS_BY_COUNTRY[supportedCountry]
        );
    const validIds = new Set(this.studentOptions.map((row) => row.studentId));
    const options: string[] = [];
    for (const [studentId, detail] of this.studentDetails.entries()) {
      if (!validIds.has(studentId)) continue;
      const detailCountry = this.resolveProvinceFilterCountry(detail.country);
      if (country && detailCountry !== country) continue;
      const city = this.normalizeCityValueForDetail(detail.city, country || detailCountry);
      if (city) {
        options.push(city);
      }
    }
    return this.mergeFilterOptions(baseOptions, options);
  }

  private normalizeProvinceValueForDetail(
    value: unknown,
    country: ProvinceFilterCountry | '' = ''
  ): string {
    return this.normalizeProvinceFilterValue(value, country);
  }

  private normalizeCityValueForDetail(
    value: unknown,
    country: ProvinceFilterCountry | '' = ''
  ): string {
    return this.normalizeCityFilterValue(value, country);
  }

  private syncCountryFilterSelection(): void {
    const input = String(this.createCountryFilterInput ?? '').trim();
    if (!input) {
      this.createCountryFilter = COUNTRY_FILTER_ALL_OPTION;
      return;
    }

    const resolved = this.resolveCountryFilterInputSelection(input);
    const resolvedKey = this.normalizeCountryKey(resolved);
    const optionExists = this.countryFilterOptions.some(
      (option) => this.normalizeCountryKey(option) === resolvedKey
    );
    if (!resolved || !optionExists) {
      this.createCountryFilterInput = '';
      this.createCountryFilter = COUNTRY_FILTER_ALL_OPTION;
      return;
    }

    this.createCountryFilterInput = resolved;
    this.createCountryFilter = resolved;
  }

  private syncProvinceFilterSelection(): void {
    const input = String(this.createProvinceFilterInput ?? '').trim();
    if (!input) {
      this.createProvinceFilter = '';
      return;
    }

    const country = this.provinceFilterCountry;
    const resolved = this.resolveProvinceFilterSelection(input, country);
    const resolvedKey = this.normalizeCountryKey(resolved);
    const optionExists = this.provinceFilterOptions.some(
      (option) => this.normalizeCountryKey(option) === resolvedKey
    );
    if (!resolved || !resolvedKey || !optionExists) {
      this.createProvinceFilterInput = '';
      this.createProvinceFilter = '';
      return;
    }

    this.createProvinceFilterInput = resolved;
    this.createProvinceFilter = resolved;
  }

  private syncCityFilterSelection(): void {
    const input = String(this.createCityFilterInput ?? '').trim();
    if (!input) {
      this.createCityFilter = '';
      return;
    }

    const country = this.cityFilterCountry;
    const resolved = this.resolveCityFilterSelection(input, country);
    const resolvedKey = this.normalizeCountryKey(resolved);
    const optionExists = this.cityFilterOptions.some(
      (option) => this.normalizeCountryKey(option) === resolvedKey
    );
    if (!resolved || !resolvedKey || !optionExists) {
      this.createCityFilterInput = '';
      this.createCityFilter = '';
      return;
    }

    this.createCityFilterInput = resolved;
    this.createCityFilter = resolved;
  }

  private syncSchoolBoardFilterSelection(): void {
    const input = String(this.createSchoolBoardFilterInput ?? '').trim();
    if (!input) {
      this.createSchoolBoardFilter = COUNTRY_FILTER_ALL_OPTION;
      return;
    }

    const resolved = this.resolveSchoolBoardFilterSelection(input);
    const resolvedKey = this.normalizeCountryKey(resolved);
    const optionExists = this.schoolBoardFilterOptions.some(
      (option) => this.normalizeCountryKey(option) === resolvedKey
    );
    if (!resolved || !optionExists) {
      this.createSchoolBoardFilterInput = '';
      this.createSchoolBoardFilter = COUNTRY_FILTER_ALL_OPTION;
      return;
    }

    this.createSchoolBoardFilterInput = resolved;
    this.createSchoolBoardFilter = resolved;
  }

  private syncGraduationSeasonFilterSelection(): void {
    const input = String(this.createGraduationSeasonFilterInput ?? '').trim();
    if (!input) {
      this.createGraduationSeasonFilter = COUNTRY_FILTER_ALL_OPTION;
      return;
    }

    const resolved = this.resolveGraduationSeasonFilterSelection(input);
    const resolvedKey = this.normalizeGraduationSeasonFilterValue(resolved);
    const optionExists = this.graduationSeasonFilterOptions.some(
      (option) => this.normalizeGraduationSeasonFilterValue(option) === resolvedKey
    );
    if (!resolved || (!resolvedKey && resolved !== COUNTRY_FILTER_ALL_OPTION) || !optionExists) {
      this.createGraduationSeasonFilterInput = '';
      this.createGraduationSeasonFilter = COUNTRY_FILTER_ALL_OPTION;
      return;
    }

    this.createGraduationSeasonFilterInput = resolved;
    this.createGraduationSeasonFilter = resolved;
  }

  private mergeFilterOptions(baseOptions: readonly string[], dynamicOptions: readonly string[]): string[] {
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

    for (const option of baseOptions) append(option);
    for (const option of dynamicOptions) append(option);

    return options;
  }

  private buildCountryFilterOptions(): string[] {
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

    append(COUNTRY_FILTER_ALL_OPTION);
    append(COUNTRY_FILTER_NA_OPTION);
    for (const option of COUNTRY_FILTER_PRIORITY_OPTIONS) append(option);
    for (const option of this.buildRegionCountryFilterOptions()) append(option);
    for (const option of COUNTRY_FILTER_FALLBACK_OPTIONS) append(option);
    return options;
  }

  private buildSchoolBoardFilterBaseOptions(): string[] {
    return this.mergeFilterOptions([COUNTRY_FILTER_ALL_OPTION], EDUCATION_BOARD_LIBRARY_OPTIONS);
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

  private resolveCountryFilterSelection(value: unknown): 'ALL' | 'N/A' | string {
    const normalized = this.normalizeCountryFilterValue(value);
    return normalized || 'ALL';
  }

  private resolveCountryFilterInputSelection(value: unknown): string {
    const resolved = this.resolveCountryFilterSelection(value);
    if (resolved === 'ALL') return COUNTRY_FILTER_ALL_OPTION;
    if (resolved === 'N/A') return COUNTRY_FILTER_NA_OPTION;
    return resolved;
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
  ): string {
    const normalized = this.normalizeProvinceFilterValue(value, country);
    return normalized || '';
  }

  private normalizeProvinceFilterValue(value: unknown, country: ProvinceFilterCountry | ''): string {
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

  private resolveCityFilterSelection(
    value: unknown,
    country: ProvinceFilterCountry | '' = ''
  ): string {
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

  private normalizeCountryFilterValue(value: unknown): 'ALL' | 'N/A' | string | '' {
    const rawText = String(value ?? '').trim();
    const normalizedKey = this.normalizeCountryKey(rawText);
    if (!normalizedKey) return '';

    if (
      normalizedKey === 'all' ||
      normalizedKey === 'all countries' ||
      normalizedKey === 'all country'
    ) {
      return 'ALL';
    }

    if (
      normalizedKey === 'n a' ||
      normalizedKey === 'na' ||
      normalizedKey === 'not available'
    ) {
      return 'N/A';
    }

    if (normalizedKey === 'ca' || normalizedKey === 'canada') {
      return 'Canada';
    }

    if (
      normalizedKey === 'cn' ||
      normalizedKey === 'china' ||
      normalizedKey === 'pr china' ||
      normalizedKey === 'peoples republic of china' ||
      normalizedKey === 'china mainland'
    ) {
      return 'China (mainland)';
    }

    if (
      normalizedKey === 'us' ||
      normalizedKey === 'usa' ||
      normalizedKey === 'u s' ||
      normalizedKey === 'u s a' ||
      normalizedKey === 'america' ||
      normalizedKey === 'united states' ||
      normalizedKey === 'united states of america'
    ) {
      return 'United States';
    }

    const matched = this.countryFilterOptions.find(
      (option) => this.normalizeCountryKey(option) === normalizedKey
    );
    return matched || rawText;
  }

  private resolveSchoolBoardFilterSelection(value: unknown): string {
    const normalized = this.normalizeSchoolBoardFilterValue(value);
    return normalized || COUNTRY_FILTER_ALL_OPTION;
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

    if (
      normalizedKey === 'all' ||
      normalizedKey === 'all school boards' ||
      normalizedKey === 'all boards'
    ) {
      return COUNTRY_FILTER_ALL_OPTION;
    }

    const matched = this.schoolBoardFilterOptions.find(
      (option) => this.normalizeCountryKey(option) === normalizedKey
    );
    return matched || rawText;
  }

  private resolveGraduationSeasonFilterSelection(value: unknown): string {
    const normalized = this.normalizeGraduationSeasonFilterValue(value);
    if (!normalized) {
      const rawKey = this.normalizeCountryKey(value);
      if (
        rawKey === 'all' ||
        rawKey === 'all graduation seasons' ||
        rawKey === 'all seasons'
      ) {
        return COUNTRY_FILTER_ALL_OPTION;
      }
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
      if (season) return `${year} ${season}`;
    }

    const seasonFirst = normalizedKey.match(/^([a-z\u4e00-\u9fff]+)\s+(\d{4})$/);
    if (seasonFirst) {
      const season = this.resolveGraduationSeasonName(seasonFirst[1]);
      const year = Number(seasonFirst[2]);
      if (season) return `${year} ${season}`;
    }

    const compactText = rawText.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '').trim();
    const compactMatch = compactText.match(/^(\d{4})(fall|autumn|winter|f|w)$/);
    if (compactMatch) {
      const year = Number(compactMatch[1]);
      const season = this.resolveGraduationSeasonName(compactMatch[2]);
      if (season) return `${year} ${season}`;
    }

    return '';
  }

  private resolveGraduationSeasonName(value: unknown): 'Fall' | 'Winter' | '' {
    const token = String(value ?? '').trim().toLowerCase();
    if (!token) return '';
    if (token === 'fall' || token === 'autumn' || token === 'f') return 'Fall';
    if (token === 'winter' || token === 'w') return 'Winter';
    return '';
  }

  private normalizeCountryKey(value: unknown): string {
    return String(value ?? '')
      .toLowerCase()
      .replace(/[.]/g, '')
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
      .trim();
  }

  private pick(candidates: unknown[]): string {
    for (const candidate of candidates) {
      const text = String(candidate ?? '').trim();
      if (text) return text;
    }
    return '';
  }

  private formatGraduation(value: unknown): string {
    const text = String(value ?? '').trim();
    if (!text) return '';
    const ym = text.match(/^(\d{4})[-/. ](\d{1,2})$/);
    if (ym) return `${ym[1]}-${String(Number(ym[2])).padStart(2, '0')}`;
    const ts = Date.parse(text);
    if (Number.isFinite(ts)) {
      const d = new Date(ts);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    return text;
  }

  private resolveGraduationSeason(graduation: string): string {
    const text = String(graduation || '').trim();
    if (!text) return '';
    const ym = text.match(/^(\d{4})-(\d{2})$/);
    if (ym) {
      const year = Number(ym[1]);
      const month = Number(ym[2]);
      return `${year} ${month >= 7 ? 'Fall' : 'Winter'}`;
    }
    const ts = Date.parse(text);
    if (Number.isFinite(ts)) {
      const d = new Date(ts);
      return `${d.getFullYear()} ${d.getMonth() + 1 >= 7 ? 'Fall' : 'Winter'}`;
    }
    return '';
  }

  private resolveStudentId(account: StudentAccount): number | null {
    const candidates: unknown[] = [
      account.studentId,
      account['student_id'],
      account['studentAccountId'],
      account['id'],
    ];
    for (const candidate of candidates) {
      const n = Number(candidate);
      if (Number.isFinite(n) && n > 0) return Math.trunc(n);
    }
    return null;
  }

  private normalizeAccounts(
    raw: StudentAccount[] | { items?: StudentAccount[]; data?: StudentAccount[] } | unknown
  ): StudentAccount[] {
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') {
      const node = raw as { items?: unknown; data?: unknown };
      if (Array.isArray(node.items)) return node.items as StudentAccount[];
      if (Array.isArray(node.data)) return node.data as StudentAccount[];
    }
    return [];
  }

  private normalizeTaskGroupId(value: unknown): string {
    return String(value ?? '').trim();
  }

  private resolveInfoTaskGroupId(info: InfoTaskVm | null | undefined): string {
    const fromRow = this.normalizeTaskGroupId(info?.taskGroupId);
    if (fromRow) {
      return fromRow;
    }
    const infoId = Number(info?.id);
    if (!Number.isFinite(infoId) || infoId <= 0) {
      return '';
    }
    return this.infoTaskGroupIdByInfoId.get(Math.trunc(infoId)) || '';
  }

  private resolveInfoRecipientStudentIds(infoId: number): number[] {
    const ids = this.selectedStudentIdsByInfoId.get(infoId) || [];
    return ids
      .map((studentId) => Math.trunc(Number(studentId)))
      .filter((studentId) => Number.isFinite(studentId) && studentId > 0);
  }

  private rememberInfoMappings(infoId: number, taskGroupId: string, studentIds: number[]): void {
    const normalizedInfoId = Math.trunc(Number(infoId));
    const normalizedTaskGroupId = this.normalizeTaskGroupId(taskGroupId);
    if (!Number.isFinite(normalizedInfoId) || normalizedInfoId <= 0 || !normalizedTaskGroupId) {
      return;
    }
    const normalizedStudentIds = Array.from(
      new Set(
        (studentIds || [])
          .map((studentId) => Math.trunc(Number(studentId)))
          .filter((studentId) => Number.isFinite(studentId) && studentId > 0)
      )
    );
    this.infoTaskGroupIdByInfoId.set(normalizedInfoId, normalizedTaskGroupId);
    this.selectedStudentIdsByInfoId.set(normalizedInfoId, normalizedStudentIds);
  }

  private generateInfoTaskGroupId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.floor(Math.random() * 0x1000000)
      .toString(36)
      .padStart(5, '0');
    return `INFO-${timestamp}-${randomPart}`;
  }

  private startInfosLoadWatchdog(): void {
    this.clearInfosLoadWatchdog();
    this.infosLoadWatchdog = window.setTimeout(() => {
      if (!this.infosLoading) return;
      this.infosLoading = false;
      if (!this.infosError) {
        this.infosError = '请求超时，请检查后端服务或网络连接。';
      }
      this.cdr.detectChanges();
    }, 15000);
  }

  private clearInfosLoadWatchdog(): void {
    if (this.infosLoadWatchdog === null) return;
    window.clearTimeout(this.infosLoadWatchdog);
    this.infosLoadWatchdog = null;
  }

  private parseTags(raw: string): string[] {
    return Array.from(
      new Set(
        String(raw || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      )
    );
  }

  private extractErrorMessage(error: unknown): string {
    if (typeof error === 'string') return error;
    if (!error || typeof error !== 'object') return '';

    const maybeTimeout = String((error as { name?: unknown }).name || '')
      .trim()
      .toLowerCase();
    if (maybeTimeout === 'timeouterror') {
      return '请求超时，请检查后端服务或网络连接。';
    }

    const obj = error as {
      message?: unknown;
      error?: unknown;
      status?: unknown;
      statusText?: unknown;
    };

    if (obj.error && typeof obj.error === 'object') {
      const payload = obj.error as {
        message?: unknown;
        error?: unknown;
      };
      if (typeof payload.message === 'string' && payload.message.trim()) {
        return payload.message.trim();
      }
      if (typeof payload.error === 'string' && payload.error.trim()) {
        return payload.error.trim();
      }
    }

    if (typeof obj.error === 'string' && obj.error.trim()) {
      return obj.error.trim();
    }
    if (typeof obj.message === 'string' && obj.message.trim()) {
      return obj.message.trim();
    }

    const status = Number(obj.status);
    if (Number.isFinite(status) && status > 0) {
      return `请求失败（HTTP ${status}）。`;
    }

    return '';
  }
}
