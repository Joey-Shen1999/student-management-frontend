import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { from, of } from 'rxjs';
import { catchError, concatMap, finalize, map, mergeMap, toArray } from 'rxjs/operators';

import { type LanguageCourseStatus } from '../../features/ielts/ielts-types';
import {
  type AssignableStudentOptionVm,
  type CreateInfoRequestVm,
  type GoalTaskStatus,
  type GoalTaskVm,
  type TaskCycleFrequency,
  type TaskCycleType,
  type TaskCycleUnit,
  TaskCenterService,
} from '../../services/task-center.service';
import { AuthService } from '../../services/auth.service';
import { type StudentAccount, StudentManagementService } from '../../services/student-management.service';
import {
  EDUCATION_BOARD_LIBRARY_OPTIONS,
  type StudentProfilePayload,
  type StudentProfileResponse,
  StudentProfileService,
} from '../../services/student-profile.service';
import { TeacherPreferenceService } from '../../services/teacher-preference.service';
import {
  buildGoalStudentSelectorColumns,
  type GoalStudentSelectorColumnConfig,
  type GoalStudentSelectorColumnKey,
} from '../../shared/student-columns/goal-student-selector-columns';
import {
  buildPresetVisibleColumnKeys,
  normalizeVisibleColumnKeys,
} from '../../shared/student-columns/student-column-visibility.util';
import {
  STUDENT_SELECTOR_AVAILABLE_COLUMN_KEYS_BY_CONTEXT,
  STUDENT_SELECTOR_DEFAULT_COLUMN_KEYS_BY_CONTEXT,
  STUDENT_SELECTOR_FILTER_FIELDS_BY_CONTEXT,
  type StudentSelectorFilterFieldKey,
  type VolunteerCompletedFilterValue,
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
  ielts: string;
  languageTracking: string;
  languageCourseStatus: LanguageCourseStatus | '';
  ossltResult: 'PASS' | 'FAIL' | 'UNKNOWN' | '';
  ossltTracking: 'PASSED' | 'WAITING_UPDATE' | 'NEEDS_TRACKING' | '';
  totalVolunteerHours: number | null;
  volunteerCompleted: boolean | null;
  status: 'ACTIVE' | 'ARCHIVED' | '';
}

interface GoalGroupRowVm {
  taskGroupKey: string;
  taskGroupId: string | null;
  goals: GoalTaskVm[];
  representativeGoal: GoalTaskVm;
  status: GoalTaskStatus;
  updatedAt: string;
  studentNames: string[];
  studentCount: number;
  completedCount: number;
}

type TrackingSaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

interface TaskCycleDraftVm {
  cycleType: TaskCycleType;
  frequency: TaskCycleFrequency;
  customInterval: number;
  customUnit: TaskCycleUnit;
  label: string;
}

interface TrackingStudentVm {
  goalId: number | null;
  studentId: number;
  studentName: string;
  username: string;
  email: string;
  schoolName: string;
  graduation: string;
  completed: boolean;
  saving: boolean;
}

interface CreateStudentColumnPreferenceVm {
  visibleColumnKeys?: string[];
  orderedColumnKeys?: string[];
}

interface CreateStudentFilterPreferenceVm {
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
  languageTrackingFilter?: string;
  languageCourseStatusFilter?: string;
  ossltResultFilter?: string;
  ossltTrackingFilter?: string;
  volunteerCompleted?: VolunteerCompletedFilterValue | boolean;
  keyword?: string;
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

const GOAL_STUDENT_SELECTOR_COLUMN_PREFERENCE_STORAGE_KEY_PREFIX =
  'goal-management.create-goal.student-selector.visible-columns';
const GOAL_STUDENT_SELECTOR_COLUMN_PREFERENCE_PAGE_KEY =
  'goal-management.create-goal.student-selector-columns';
const GOAL_STUDENT_SELECTOR_COLUMN_PREFERENCE_VERSION = 'v7';
const GOAL_STUDENT_SELECTOR_FILTER_PREFERENCE_STORAGE_KEY_PREFIX =
  'goal-management.create-goal.student-selector.filters';
const GOAL_STUDENT_SELECTOR_FILTER_PREFERENCE_VERSION = 'v4';
const TASK_CYCLE_META_STORAGE_KEY_PREFIX = 'goal-management.task-cycle-meta';
const TASK_CYCLE_META_STORAGE_VERSION = 'v1';
const TRACKING_AUTO_SAVE_DELAY_MS = 850;

@Component({
  selector: 'app-goal-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, StudentSelectorPanelComponent],
  templateUrl: './goal-management.component.html',
  styleUrl: './goal-management.component.scss',
})
export class GoalManagementComponent implements OnInit, OnDestroy {
  private readonly selectorContext = 'goal-create' as const;
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
  private readonly profileLoadInFlight = new Set<number>();
  private skipDependentFilterValidationOnce = false;
  private readonly teacherNoteProfileCache = new Map<
    number,
    StudentProfilePayload | StudentProfileResponse
  >();
  private readonly teacherNoteSaveInFlight = new Set<number>();
  private readonly teacherNoteAutoSaveTimers = new Map<number, ReturnType<typeof setTimeout>>();

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
  createLanguageScoreFilter = '';
  createLanguageTrackingFilter = '';
  createLanguageCourseStatusFilter = '';
  createOssltResultFilter = '';
  createOssltTrackingFilter = '';
  createVolunteerCompletedFilter: VolunteerCompletedFilterValue = '';
  readonly languageScoreFilterOptions: readonly string[] = [
    'GREEN_STRICT_PASS',
    'GREEN_COMMON_PASS_WITH_WARNING',
    'YELLOW_NEEDS_PREPARATION',
    'NO_REQUIREMENT',
  ];
  readonly languageTrackingFilterOptions: readonly string[] = [
    'TEACHER_REVIEW_APPROVED',
    'AUTO_PASS_ALL_SCHOOLS',
    'AUTO_PASS_PARTIAL_SCHOOLS',
    'NEEDS_TRACKING',
  ];
  readonly languageCourseStatusFilterOptions: readonly LanguageCourseStatus[] = [
    'NOT_RECEIVED_TRAINING',
    'ENROLLED_GLOBAL_IELTS',
    'ENROLLED_OTHER_IELTS',
    'COURSE_COMPLETED_NOT_EXAMINED',
    'EXAM_REGISTERED',
    'SCORE_RELEASED',
  ];
  readonly ossltResultFilterOptions: readonly string[] = ['PASS', 'FAIL', 'UNKNOWN'];
  readonly ossltTrackingFilterOptions: readonly string[] = [
    'WAITING_UPDATE',
    'NEEDS_TRACKING',
    'PASSED',
  ];

  goals: GoalTaskVm[] = [];
  goalsLoading = false;
  goalsError = '';
  filterStudentId: number | null = null;
  filterStatus: GoalTaskStatus | 'ALL' = 'ALL';
  filterKeyword = '';

  createPanelExpanded = false;
  studentPanelExpanded = false;
  studentFilterExpanded = false;
  createStudentColumnPanelExpanded = false;
  createStudentKeyword = '';
  selectedCreateStudentIds = new Set<number>();
  createStudentColumnOrderKeys: GoalStudentSelectorColumnKey[] =
    this.createStudentColumns.map((column) => column.key);
  visibleCreateStudentColumnKeys: Set<GoalStudentSelectorColumnKey> =
    this.buildCreateStudentDefaultVisibleColumnKeys();
  createTitle = '';
  createDescription = '';
  createDueAt = '';
  cycleDraft: TaskCycleDraftVm = this.createDefaultCycleDraft();
  creating = false;
  createError = '';
  createSuccess = '';
  editingTaskGroupId: string | null = null;

  selectedGoalId: number | null = null;
  updatingGoalGroupKey: string | null = null;
  updateError = '';
  trackingStudents: TrackingStudentVm[] = [];
  trackingLoading = false;
  trackingError = '';
  autoSaveStatus: TrackingSaveStatus = 'idle';
  autoSaveError = '';
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private autoSaveRequestSeq = 0;
  private suppressAutoSave = false;
  private readonly pendingCompletionByStudentId = new Map<number, boolean>();
  sendConfirmOpen = false;
  sendConfirmText = '';
  sendingNotification = false;
  sendError = '';
  sendSuccess = '';

  constructor(
    private taskCenter: TaskCenterService,
    private studentManagement: StudentManagementService,
    private studentProfile: StudentProfileService,
    private auth: AuthService,
    private teacherPreferenceApi: TeacherPreferenceService,
    private router: Router,
    private cdr: ChangeDetectorRef = { detectChanges: () => {} } as ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeCreateStudentVisibleColumns();
    this.initializeCreateStudentFiltersFromPreference();
    this.loadCreateStudentVisibleColumnsPreferenceFromServer();
    this.loadAssignableStudents();
    this.loadGoals();
  }

  ngOnDestroy(): void {
    this.clearTrackingAutoSaveTimer();
    this.clearAllTeacherNoteAutoSaveTimers();
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
    return this.editingTaskGroupId !== null;
  }

  get completedTrackingCount(): number {
    return this.trackingStudents.filter((student) => student.completed).length;
  }

  get pendingTrackingCount(): number {
    return Math.max(0, this.trackingStudents.length - this.completedTrackingCount);
  }

  get completionPercent(): number {
    if (this.trackingStudents.length === 0) return 0;
    return Math.round((this.completedTrackingCount / this.trackingStudents.length) * 100);
  }

  get canAutoSaveTrackingDraft(): boolean {
    return this.isEditMode && !this.creating;
  }

  get saveStatusLabel(): string {
    if (this.autoSaveStatus === 'saving') return 'Saving...';
    if (this.autoSaveStatus === 'saved') return 'All changes saved';
    if (this.autoSaveStatus === 'failed') return 'Save failed';
    return this.isEditMode ? 'All changes saved' : 'Ready to create';
  }

  get saveStatusClass(): string {
    return `save-pill ${this.autoSaveStatus}`;
  }

  get sendRecipientCount(): number {
    return Array.from(this.selectedCreateStudentIds.values()).filter((studentId) =>
      this.isCreateStudentSelectable(studentId)
    ).length;
  }

  get isSendConfirmationReady(): boolean {
    return this.sendConfirmText.trim().toUpperCase() === 'SEND';
  }

  get goalGroups(): GoalGroupRowVm[] {
    const groups = new Map<string, GoalTaskVm[]>();
    for (const goal of this.goals) {
      const taskGroupId = this.resolveGoalTaskGroupId(goal);
      const taskGroupKey = taskGroupId || `single-${goal.id}`;
      const bucket = groups.get(taskGroupKey);
      if (bucket) {
        bucket.push(goal);
      } else {
        groups.set(taskGroupKey, [goal]);
      }
    }

    const rows: GoalGroupRowVm[] = [];
    for (const [taskGroupKey, goals] of groups.entries()) {
      const sortedGoals = this.sortGoals(goals);
      const representativeGoal = sortedGoals[0];
      const taskGroupId = this.resolveGoalTaskGroupId(representativeGoal) || null;
      const status = this.resolveGoalGroupStatus(sortedGoals);
      const updatedAt = sortedGoals.reduce((latest, row) => {
        return this.toTs(row.updatedAt, 0) > this.toTs(latest, 0) ? row.updatedAt : latest;
      }, representativeGoal.updatedAt);
      const studentNames = Array.from(
        new Set(
          sortedGoals
            .map((row) => String(row.assignedStudentName || '').trim())
            .filter(Boolean)
        )
      );
      const completedCount = sortedGoals.filter((row) => row.status === 'COMPLETED').length;

      rows.push({
        taskGroupKey,
        taskGroupId,
        goals: sortedGoals,
        representativeGoal,
        status,
        updatedAt,
        studentNames,
        studentCount: sortedGoals.length,
        completedCount,
      });
    }

    return rows.sort((a, b) => {
      const rankA = a.status === 'COMPLETED' ? 1 : 0;
      const rankB = b.status === 'COMPLETED' ? 1 : 0;
      if (rankA !== rankB) return rankA - rankB;
      const dueA = this.toTs(a.representativeGoal.dueAt, Number.MAX_SAFE_INTEGER);
      const dueB = this.toTs(b.representativeGoal.dueAt, Number.MAX_SAFE_INTEGER);
      if (dueA !== dueB) return dueA - dueB;
      return this.toTs(b.updatedAt, 0) - this.toTs(a.updatedAt, 0);
    });
  }

  trackCreateStudentColumn = (
    _index: number,
    column: GoalStudentSelectorColumnConfig
  ): GoalStudentSelectorColumnKey => column.key;
  readonly isCreateStudentSelectedRef = (studentId: number): boolean =>
    this.isCreateStudentSelected(studentId);
  readonly isSelectedStudentOutOfCurrentFilterRef = (
    student: AssignableStudentOptionVm
  ): boolean => this.isSelectedStudentOutOfCurrentFilter(student);
  readonly isCreateStudentSelectableRowRef = (student: AssignableStudentOptionVm): boolean =>
    this.isCreateStudentSelectableRow(student);
  readonly isCreateStudentColumnVisibleRef = (
    columnKey: string
  ): boolean => {
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
  readonly isTeacherNoteSavingRef = (studentId: number): boolean =>
    this.isTeacherNoteSaving(studentId);

  goDashboard(): void { this.router.navigate(['/teacher/dashboard']); }
  openCreatePanel(): void {
    if (this.creating) return;
    this.suppressAutoSave = true;
    this.clearTrackingAutoSaveTimer();
    this.editingTaskGroupId = null;
    this.resetCreateForm();
    this.createPanelExpanded = true;
    this.autoSaveStatus = 'idle';
    this.autoSaveError = '';
    this.trackingStudents = [];
    this.trackingError = '';
    this.closeSendConfirmation();
    this.suppressAutoSave = false;
  }
  openEditPanel(goal: GoalTaskVm): void {
    if (this.creating) return;
    const taskGroupId = this.resolveGoalTaskGroupId(goal);
    if (!taskGroupId) {
      this.createError = '当前 Task 缺少 taskGroupId，无法进入编辑模式。';
      this.createSuccess = '';
      this.cdr.detectChanges();
      return;
    }
    this.suppressAutoSave = true;
    this.clearTrackingAutoSaveTimer();
    this.editingTaskGroupId = taskGroupId;
    this.selectedGoalId = goal.id;
    this.createPanelExpanded = true;
    this.studentPanelExpanded = true;
    this.studentFilterExpanded = false;
    this.createStudentColumnPanelExpanded = false;
    this.createError = '';
    this.createSuccess = '';
    this.createTitle = goal.title;
    this.createDescription = goal.description;
    this.createDueAt = goal.dueAt || '';
    this.cycleDraft = this.resolveCycleDraftForGoal(taskGroupId, goal);
    this.autoSaveStatus = 'saved';
    this.autoSaveError = '';
    this.sendError = '';
    this.sendSuccess = '';
    this.closeSendConfirmation();
    this.selectedCreateStudentIds = new Set<number>(
      this.collectTaskGroupStudentIds(this.goals, taskGroupId, goal.assignedStudentId)
    );
    this.rebuildTrackingStudentsFromSelection();
    this.loadMissingProfilesForVisibleRows();
    this.loadTrackingStudents(taskGroupId);
    this.suppressAutoSave = false;

    this.taskCenter
      .listTeacherGoals({ page: 1, size: 1000 })
      .pipe(catchError(() => of({ items: [] as GoalTaskVm[], total: 0, page: 1, size: 1000 })))
      .subscribe((resp) => {
        if (this.editingTaskGroupId !== taskGroupId) return;
        const groupedStudentIds = this.collectTaskGroupStudentIds(
          resp.items || [],
          taskGroupId,
          goal.assignedStudentId
        );
        this.selectedCreateStudentIds = new Set<number>(groupedStudentIds);
        this.pruneUnselectableSelectedStudents();
        this.rebuildTrackingStudentsFromSelection();
        this.loadMissingProfilesForVisibleRows();
        this.loadTrackingStudents(taskGroupId);
        this.cdr.detectChanges();
      });
  }
  closeCreatePanel(force = false): void {
    if (this.creating && !force) return;
    this.clearTrackingAutoSaveTimer();
    this.closeSendConfirmation();
    this.createPanelExpanded = false;
    this.studentPanelExpanded = false;
    this.studentFilterExpanded = false;
    this.createStudentColumnPanelExpanded = false;
    this.editingTaskGroupId = null;
    this.trackingStudents = [];
    this.trackingError = '';
    this.autoSaveStatus = 'idle';
    this.autoSaveError = '';
  }
  onCreatePanelBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeCreatePanel();
  }
  toggleCreatePanel(): void {
    if (this.createPanelExpanded) this.closeCreatePanel();
    else this.openCreatePanel();
  }
  toggleStudentPanel(): void {
    this.studentPanelExpanded = !this.studentPanelExpanded;
    if (this.studentPanelExpanded) this.loadMissingProfilesForVisibleRows();
    else {
      this.studentFilterExpanded = false;
      this.createStudentColumnPanelExpanded = false;
    }
  }
  toggleStudentFilterPanel(): void { this.studentFilterExpanded = !this.studentFilterExpanded; }
  toggleCreateStudentColumnPanel(): void {
    this.createStudentColumnPanelExpanded = !this.createStudentColumnPanelExpanded;
  }

  onTrackingDraftChange(): void {
    if (this.suppressAutoSave) return;
    this.scheduleTrackingAutoSave();
  }

  onCycleTypeChange(value: string): void {
    this.cycleDraft.cycleType = value === 'ROUTINE' ? 'ROUTINE' : 'ONE_TIME';
    if (this.cycleDraft.cycleType === 'ONE_TIME') {
      this.cycleDraft.frequency = 'DAILY';
    }
    this.onTrackingDraftChange();
  }

  onCycleFrequencyChange(value: string): void {
    const normalized = String(value || '').trim().toUpperCase();
    this.cycleDraft.frequency =
      normalized === 'WEEKLY' || normalized === 'CUSTOM'
        ? (normalized as TaskCycleFrequency)
        : 'DAILY';
    this.onTrackingDraftChange();
  }

  onCustomCycleIntervalChange(value: string | number): void {
    const numericValue = Math.trunc(Number(value));
    this.cycleDraft.customInterval =
      Number.isFinite(numericValue) && numericValue > 0 ? Math.min(numericValue, 99) : 1;
    this.onTrackingDraftChange();
  }

  onCustomCycleUnitChange(value: string): void {
    this.cycleDraft.customUnit = value === 'WEEKS' ? 'WEEKS' : 'DAYS';
    this.onTrackingDraftChange();
  }

  retryAutoSave(): void {
    this.flushTrackingAutoSave(true);
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
      this.persistCreateStudentVisibleColumnsPreference();
      this.syncCreateStudentVisibleColumnsPreferenceToServer();
    }
  }

  isCreateStudentColumnVisible(columnKey: GoalStudentSelectorColumnKey): boolean {
    return this.visibleCreateStudentColumnKeys.has(columnKey);
  }
  onCreateStudentColumnVisibilityChange(
    columnKey: string,
    event: Event | boolean
  ): void {
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
    this.persistCreateStudentVisibleColumnsPreference();
    this.syncCreateStudentVisibleColumnsPreferenceToServer();
    if (checked && config.backendDependent) {
      this.loadMissingProfilesForVisibleRows();
    }
  }
  resetCreateStudentVisibleColumns(): void {
    this.createStudentColumnOrderKeys = this.createStudentColumns.map((column) => column.key);
    this.visibleCreateStudentColumnKeys = this.buildCreateStudentDefaultVisibleColumnKeys();
    this.persistCreateStudentVisibleColumnsPreference();
    this.syncCreateStudentVisibleColumnsPreferenceToServer();
    this.loadMissingProfilesForVisibleRows();
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
  onStudentKeywordChange(value?: string): void {
    if (typeof value === 'string') {
      this.createStudentKeyword = value;
    }
    this.persistCreateStudentFiltersPreference();
    this.loadMissingProfilesForVisibleRows();
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
    this.persistCreateStudentFiltersPreference();
    this.loadMissingProfilesForVisibleRows();
  }
  onProvinceFilterInputChange(value: string): void {
    const input = String(value ?? '').trim();
    this.createProvinceFilterInput = input;
    const country = this.provinceFilterCountry;
    this.createProvinceFilter = input ? this.resolveProvinceFilterSelection(input, country) : '';
    this.persistCreateStudentFiltersPreference();
    this.loadMissingProfilesForVisibleRows();
  }
  onCityFilterInputChange(value: string): void {
    const input = String(value ?? '').trim();
    this.createCityFilterInput = input;
    const country = this.cityFilterCountry;
    this.createCityFilter = input ? this.resolveCityFilterSelection(input, country) : '';
    this.persistCreateStudentFiltersPreference();
    this.loadMissingProfilesForVisibleRows();
  }
  onSchoolBoardFilterInputChange(value: string): void {
    const input = String(value ?? '').trim();
    this.createSchoolBoardFilterInput = input;
    this.createSchoolBoardFilter = input
      ? this.resolveSchoolBoardFilterSelection(input)
      : COUNTRY_FILTER_ALL_OPTION;
    this.syncGraduationSeasonFilterSelection();
    this.persistCreateStudentFiltersPreference();
    this.loadMissingProfilesForVisibleRows();
  }
  onGraduationSeasonFilterInputChange(value: string): void {
    const input = String(value ?? '').trim();
    this.createGraduationSeasonFilterInput = input;
    this.createGraduationSeasonFilter = input
      ? this.resolveGraduationSeasonFilterSelection(input)
      : COUNTRY_FILTER_ALL_OPTION;
    this.persistCreateStudentFiltersPreference();
    this.loadMissingProfilesForVisibleRows();
  }
  onLanguageScoreFilterChange(value: string): void {
    this.createLanguageScoreFilter = this.normalizeIeltsValue(value) || '';
    this.persistCreateStudentFiltersPreference();
    this.loadMissingProfilesForVisibleRows();
  }
  onLanguageTrackingFilterChange(value: string): void {
    this.createLanguageTrackingFilter = this.normalizeLanguageTrackingValue(value) || '';
    this.persistCreateStudentFiltersPreference();
    this.loadMissingProfilesForVisibleRows();
  }
  onLanguageCourseStatusFilterChange(value: string): void {
    this.createLanguageCourseStatusFilter = this.normalizeLanguageCourseStatusValue(value) || '';
    this.persistCreateStudentFiltersPreference();
    this.loadMissingProfilesForVisibleRows();
  }
  onOssltResultFilterChange(value: string): void {
    this.createOssltResultFilter = this.normalizeOssltResultValue(value) || '';
    this.persistCreateStudentFiltersPreference();
    this.loadMissingProfilesForVisibleRows();
  }
  onOssltTrackingFilterChange(value: string): void {
    this.createOssltTrackingFilter = this.normalizeOssltTrackingStatusValue(value) || '';
    this.persistCreateStudentFiltersPreference();
    this.loadMissingProfilesForVisibleRows();
  }
  onVolunteerCompletedFilterChange(value: VolunteerCompletedFilterValue): void {
    this.createVolunteerCompletedFilter = this.normalizeVolunteerCompletedFilterValue(value);
    this.persistCreateStudentFiltersPreference();
    this.loadMissingProfilesForVisibleRows();
  }
  refreshAssignableStudents(): void { this.loadAssignableStudents(); }
  refreshGoals(): void { this.loadGoals(); }
  applyFilters(): void { this.loadGoals(); }
  clearFilters(): void { this.filterStudentId = null; this.filterStatus = 'ALL'; this.filterKeyword = ''; this.loadGoals(); }

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
    this.createLanguageScoreFilter = '';
    this.createLanguageTrackingFilter = '';
    this.createLanguageCourseStatusFilter = '';
    this.createOssltResultFilter = '';
    this.createOssltTrackingFilter = '';
    this.createVolunteerCompletedFilter = '';
    this.createStudentKeyword = '';
    this.persistCreateStudentFiltersPreference();
    this.loadMissingProfilesForVisibleRows();
  }

  resetCreateForm(): void {
    this.studentPanelExpanded = false;
    this.studentFilterExpanded = false;
    this.createStudentColumnPanelExpanded = false;
    this.resetStudentMetaFilters();
    this.clearAllTeacherNoteAutoSaveTimers();
    this.selectedCreateStudentIds.clear();
    this.createTitle = '';
    this.createDescription = '';
    this.createDueAt = '';
    this.cycleDraft = this.createDefaultCycleDraft();
    this.autoSaveStatus = 'idle';
    this.autoSaveError = '';
    this.trackingStudents = [];
    this.trackingError = '';
    this.sendError = '';
    this.sendSuccess = '';
    this.closeSendConfirmation();
    this.createError = '';
    this.createSuccess = '';
  }

  onCreateStudentCheckboxChange(studentId: number, event: Event | boolean): void {
    if (typeof event !== 'boolean') {
      event.stopPropagation();
    }
    if (this.creating) return;
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
    this.rebuildTrackingStudentsFromSelection();
    this.scheduleTrackingAutoSave();
  }

  clearSelectedStudents(): void {
    if (this.creating) return;
    this.selectedCreateStudentIds.clear();
    this.rebuildTrackingStudentsFromSelection();
    this.scheduleTrackingAutoSave();
  }

  onToggleSelectAll(event: Event | boolean): void {
    if (this.creating) return;
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
    this.rebuildTrackingStudentsFromSelection();
    this.scheduleTrackingAutoSave();
  }

  isCreateStudentSelected(studentId: number): boolean { return this.selectedCreateStudentIds.has(studentId); }
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

  detailEmail(studentId: number): string { return this.studentDetails.get(studentId)?.email || '-'; }
  detailPhone(studentId: number): string { return this.studentDetails.get(studentId)?.phone || '-'; }
  detailGraduation(studentId: number): string { return this.studentDetails.get(studentId)?.graduation || '-'; }
  detailSchoolName(studentId: number): string { return this.studentDetails.get(studentId)?.schoolName || '-'; }
  detailCanadaIdentity(studentId: number): string {
    return this.studentDetails.get(studentId)?.canadaIdentity || '-';
  }
  detailGender(studentId: number): string { return this.studentDetails.get(studentId)?.gender || '-'; }
  detailNationality(studentId: number): string { return this.studentDetails.get(studentId)?.nationality || '-'; }
  detailFirstLanguage(studentId: number): string {
    return this.studentDetails.get(studentId)?.firstLanguage || '-';
  }
  detailMotherLanguage(studentId: number): string {
    return this.studentDetails.get(studentId)?.motherLanguage || '-';
  }
  detailSchoolBoard(studentId: number): string { return this.studentDetails.get(studentId)?.schoolBoard || '-'; }
  detailCountry(studentId: number): string { return this.studentDetails.get(studentId)?.country || '-'; }
  detailProvince(studentId: number): string { return this.studentDetails.get(studentId)?.province || '-'; }
  detailCity(studentId: number): string { return this.studentDetails.get(studentId)?.city || '-'; }
  detailIelts(student: AssignableStudentOptionVm): string {
    const cached = this.studentDetails.get(student.studentId)?.ielts || '';
    if (cached) return this.resolveIeltsLabel(cached);
    const fallback = this.extractIeltsFromRecord(
      student as unknown as Record<string, unknown>
    );
    return this.resolveIeltsLabel(fallback);
  }
  detailLanguageTracking(student: AssignableStudentOptionVm): string {
    const cached = this.studentDetails.get(student.studentId)?.languageTracking || '';
    if (cached) return this.resolveLanguageTrackingLabel(cached);
    const fallback = this.extractLanguageTrackingFromRecord(
      student as unknown as Record<string, unknown>
    );
    return this.resolveLanguageTrackingLabel(fallback);
  }
  detailLanguageCourseStatus(student: AssignableStudentOptionVm): string {
    const cached = this.studentDetails.get(student.studentId)?.languageCourseStatus || '';
    if (cached) return this.resolveLanguageCourseStatusLabel(cached);
    const fallback = this.extractLanguageCourseStatusFromRecord(
      student as unknown as Record<string, unknown>
    );
    return this.resolveLanguageCourseStatusLabel(fallback);
  }
  detailOssltResult(student: AssignableStudentOptionVm): string {
    const cached = this.studentDetails.get(student.studentId)?.ossltResult || '';
    if (cached) return this.resolveOssltResultLabel(cached);
    const fallback = this.extractOssltResultFromRecord(
      student as unknown as Record<string, unknown>
    );
    return this.resolveOssltResultLabel(fallback);
  }
  detailOssltTracking(student: AssignableStudentOptionVm): string {
    const cached = this.studentDetails.get(student.studentId)?.ossltTracking || '';
    if (cached) return this.resolveOssltTrackingStatusLabel(cached);
    const fallback = this.extractOssltTrackingStatusFromRecord(
      student as unknown as Record<string, unknown>
    );
    return this.resolveOssltTrackingStatusLabel(fallback);
  }
  detailStatus(studentId: number): string {
    return this.resolveArchiveStatusLabel(this.studentDetails.get(studentId)?.status || '');
  }
  detailSelectable(studentId: number): string {
    return this.isCreateStudentSelectable(studentId) ? '可选' : '已锁定';
  }
  detailTeacherNote(studentId: number): string { return this.studentDetails.get(studentId)?.teacherNote || ''; }
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
      case 'ielts':
        return this.detailIelts(student);
      case 'languageTracking':
        return this.detailLanguageTracking(student);
      case 'languageCourseStatus':
        return this.detailLanguageCourseStatus(student);
      case 'ossltResult':
        return this.detailOssltResult(student);
      case 'ossltTracking':
        return this.detailOssltTracking(student);
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
  isCreateStudentSelectableRow(student: AssignableStudentOptionVm): boolean {
    const detail = this.studentDetails.get(student.studentId);
    return this.resolveCreateStudentStatus(student, detail) !== 'ARCHIVED';
  }
  isTeacherNoteSaving(studentId: number): boolean { return this.teacherNoteSaveInFlight.has(studentId); }

  onTeacherNoteCellFocus(studentId: number): void {
    this.ensureTeacherNoteProfileCached(studentId);
  }

  onTeacherNoteCellChange(studentId: number, value: unknown): void {
    if (this.creating) return;
    this.setTeacherNote(studentId, String(value ?? ''));
    this.scheduleTeacherNoteAutoSave(studentId);
    this.cdr.detectChanges();
  }

  onTeacherNoteCellBlur(studentId: number): void {
    this.flushTeacherNoteAutoSave(studentId);
  }

  createGoal(): void {
    if (this.creating) return;
    const selectedIds = Array.from(this.selectedCreateStudentIds.values())
      .filter((studentId) => this.isCreateStudentSelectable(studentId))
      .sort((a, b) => a - b);
    if (selectedIds.length === 0) {
      this.studentPanelExpanded = true;
      this.createError = '请至少选择 1 位学生。';
      this.createSuccess = '';
      return;
    }

    const title = this.createTitle.trim();
    if (!title) { this.createError = '请填写 Task 标题。'; this.createSuccess = ''; return; }
    const description = this.createDescription.trim();
    if (!description) { this.createError = '请填写 Task 描述。'; this.createSuccess = ''; return; }

    const dueAt = this.createDueAt.trim() || null;
    if (this.isEditMode) {
      this.flushTrackingAutoSave(true);
      return;
    }

    this.createNewGoals(selectedIds, title, description, dueAt);
  }

  private createNewGoals(
    selectedIds: number[],
    title: string,
    description: string,
    dueAt: string | null
  ): void {
    this.creating = true;
    this.createError = '';
    this.createSuccess = '';
    this.cdr.detectChanges();

    this.taskCenter.createGoalGroup({
      title,
      description,
      dueAt,
      studentIds: selectedIds,
      ...this.buildCycleRequestPayload(),
    }).pipe(
      finalize(() => { this.creating = false; this.cdr.detectChanges(); })
    ).subscribe({
      next: (resp) => {
        const rows = this.sortGoals(resp.items || []);
        const first = rows[0];
        if (first) this.selectedGoalId = first.id;
        const taskGroupId = String(resp.taskGroupId || first?.taskGroupId || '').trim();
        if (taskGroupId) {
          this.editingTaskGroupId = taskGroupId;
          this.persistCycleMeta(taskGroupId);
          this.rebuildTrackingStudentsFromSelection();
          this.loadTrackingStudents(taskGroupId);
        }
        this.autoSaveStatus = 'saved';
        this.createSuccess =
          rows.length === 1
            ? `Task已创建：#${first?.id || ''} ${first?.title || ''}`.trim()
            : `Task已为 ${rows.length} 位学生发布。`;
        this.loadGoals();
      },
      error: (error: unknown) => {
        this.createError = this.extractErrorMessage(error) || '发布 Task 失败。';
        this.cdr.detectChanges();
      },
    });
  }

  private saveEditedGoal(
    _selectedIds: number[],
    _title: string,
    _description: string,
    _dueAt: string | null
  ): void {
    const editingTaskGroupId = this.editingTaskGroupId;
    if (!editingTaskGroupId) return;

    this.flushTrackingAutoSave(true);
  }

  private scheduleTrackingAutoSave(): void {
    if (!this.canAutoSaveTrackingDraft || this.suppressAutoSave) return;
    this.clearTrackingAutoSaveTimer();
    this.autoSaveStatus = 'saving';
    this.autoSaveError = '';
    this.autoSaveTimer = setTimeout(() => this.flushTrackingAutoSave(), TRACKING_AUTO_SAVE_DELAY_MS);
  }

  private flushTrackingAutoSave(force = false): void {
    if (!this.canAutoSaveTrackingDraft && !force) return;
    const taskGroupId = this.editingTaskGroupId;
    if (!taskGroupId) return;

    this.clearTrackingAutoSaveTimer();
    const title = this.createTitle.trim();
    const description = this.createDescription.trim();
    const selectedIds = this.getSelectedCreateStudentIds();
    if (!title || !description || selectedIds.length === 0) {
      this.autoSaveStatus = 'failed';
      this.autoSaveError = !title
        ? 'Task name is required.'
        : !description
          ? 'Description is required.'
          : 'Select at least one student.';
      this.cdr.detectChanges();
      return;
    }

    const requestSeq = ++this.autoSaveRequestSeq;
    this.autoSaveStatus = 'saving';
    this.autoSaveError = '';
    this.taskCenter
      .overwriteGoalGroup(taskGroupId, {
        title,
        description,
        dueAt: this.createDueAt.trim() || null,
        studentIds: selectedIds,
        ...this.buildCycleRequestPayload(),
      })
      .subscribe({
        next: (updatedGroup) => {
          if (requestSeq !== this.autoSaveRequestSeq) return;
          const updatedRows = this.sortGoals(updatedGroup.items || []);
          this.goals = this.sortGoals([
            ...updatedRows,
            ...this.goals.filter((row) => this.resolveGoalTaskGroupId(row) !== taskGroupId),
          ]);
          const selectedInGroup =
            updatedRows.find((row) => row.id === this.selectedGoalId) || updatedRows[0];
          if (selectedInGroup) {
            this.selectedGoalId = selectedInGroup.id;
          }
          this.persistCycleMeta(taskGroupId);
          this.autoSaveStatus = 'saved';
          this.autoSaveError = '';
          this.loadTrackingStudents(taskGroupId);
          this.loadGoals();
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          if (requestSeq !== this.autoSaveRequestSeq) return;
          this.autoSaveStatus = 'failed';
          this.autoSaveError = this.extractErrorMessage(error) || 'Could not save changes.';
          this.cdr.detectChanges();
        },
      });
  }

  private clearTrackingAutoSaveTimer(): void {
    if (!this.autoSaveTimer) return;
    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = null;
  }

  private getSelectedCreateStudentIds(): number[] {
    return Array.from(this.selectedCreateStudentIds.values())
      .filter((studentId) => this.isCreateStudentSelectable(studentId))
      .sort((a, b) => a - b);
  }

  private loadTrackingStudents(taskGroupId: string): void {
    const normalizedTaskGroupId = this.normalizeTaskGroupId(taskGroupId);
    if (!normalizedTaskGroupId) return;

    this.trackingLoading = true;
    this.trackingError = '';
    this.taskCenter
      .getGoalGroupStudentStatuses(normalizedTaskGroupId)
      .pipe(
        finalize(() => {
          this.trackingLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (resp) => {
          if (this.editingTaskGroupId !== normalizedTaskGroupId) return;
          this.trackingStudents = (resp.students || []).map((student) => {
            const option = this.findStudentOption(student.studentId);
            return {
              goalId: student.goalId,
              studentId: student.studentId,
              studentName:
                student.studentName || option?.studentName || `Student #${student.studentId}`,
              username: String(student.username || option?.username || '').trim(),
              email: String(
                student.email || option?.email || this.detailEmail(student.studentId) || ''
              ).trim(),
              schoolName: this.detailSchoolName(student.studentId),
              graduation: this.detailGraduation(student.studentId),
              completed: student.completed || student.status === 'COMPLETED',
              saving: false,
            };
          });
          this.selectedCreateStudentIds = new Set(
            this.trackingStudents.map((student) => student.studentId)
          );
          this.applyPendingCompletionUpdates();
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.trackingError =
            this.extractErrorMessage(error) || 'Could not load student completion statuses.';
          this.rebuildTrackingStudentsFromSelection();
          this.cdr.detectChanges();
        },
      });
  }

  private rebuildTrackingStudentsFromGoals(): void {
    const taskGroupId = this.editingTaskGroupId;
    if (!taskGroupId) {
      this.rebuildTrackingStudentsFromSelection();
      return;
    }
    const rows = this.goals.filter((goal) => this.resolveGoalTaskGroupId(goal) === taskGroupId);
    if (rows.length === 0) {
      this.rebuildTrackingStudentsFromSelection();
      return;
    }
    this.trackingStudents = rows.map((goal) => {
      const option = this.findStudentOption(goal.assignedStudentId);
      return {
        goalId: goal.id,
        studentId: goal.assignedStudentId,
        studentName:
          goal.assignedStudentName || option?.studentName || `Student #${goal.assignedStudentId}`,
        username: String(option?.username || '').trim(),
        email: String(option?.email || this.detailEmail(goal.assignedStudentId) || '').trim(),
        schoolName: this.detailSchoolName(goal.assignedStudentId),
        graduation: this.detailGraduation(goal.assignedStudentId),
        completed: goal.status === 'COMPLETED',
        saving: false,
      };
    });
  }

  private rebuildTrackingStudentsFromSelection(): void {
    const previousByStudentId = new Map(
      this.trackingStudents.map((student) => [student.studentId, student])
    );
    this.trackingStudents = this.getSelectedCreateStudentIds().map((studentId) => {
      const previous = previousByStudentId.get(studentId);
      const option = this.findStudentOption(studentId);
      return {
        goalId: previous?.goalId || null,
        studentId,
        studentName: option?.studentName || previous?.studentName || `Student #${studentId}`,
        username: String(option?.username || previous?.username || '').trim(),
        email: String(option?.email || previous?.email || this.detailEmail(studentId) || '').trim(),
        schoolName: this.detailSchoolName(studentId),
        graduation: this.detailGraduation(studentId),
        completed: previous?.completed || this.pendingCompletionByStudentId.get(studentId) === true,
        saving: previous?.saving || false,
      };
    });
  }

  private persistTrackingStudentStatus(student: TrackingStudentVm, completed: boolean): void {
    if (!student.goalId) return;

    student.saving = true;
    this.updateError = '';
    this.taskCenter
      .updateTeacherGoalStatus(student.goalId, {
        status: completed ? 'COMPLETED' : 'NOT_STARTED',
        progressNote: completed ? 'Teacher marked this student Completed in Task Tracking.' : '',
      })
      .pipe(
        finalize(() => {
          student.saving = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (updatedGoal) => {
          this.mergeUpdatedGoalRows([updatedGoal]);
          student.goalId = updatedGoal.id;
          student.completed = updatedGoal.status === 'COMPLETED';
          student.saving = false;
          this.pendingCompletionByStudentId.delete(student.studentId);
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          student.completed = !completed;
          this.updateError = this.extractErrorMessage(error) || 'Failed to update completion status.';
          this.cdr.detectChanges();
        },
      });
  }

  private applyPendingCompletionUpdates(): void {
    if (this.pendingCompletionByStudentId.size === 0) return;
    for (const student of this.trackingStudents) {
      if (!student.goalId || !this.pendingCompletionByStudentId.has(student.studentId)) continue;
      const completed = this.pendingCompletionByStudentId.get(student.studentId) === true;
      this.pendingCompletionByStudentId.delete(student.studentId);
      this.updateTrackingStudentStatus(student, completed);
    }
  }

  private mergeUpdatedGoalRows(updatedRows: GoalTaskVm[]): void {
    const updatedById = new Map(updatedRows.map((row) => [row.id, row]));
    this.goals = this.sortGoals(this.goals.map((row) => updatedById.get(row.id) || row));
  }

  private createDefaultCycleDraft(): TaskCycleDraftVm {
    return {
      cycleType: 'ONE_TIME',
      frequency: 'DAILY',
      customInterval: 1,
      customUnit: 'DAYS',
      label: '',
    };
  }

  private buildCycleRequestPayload(): {
    cycleType: TaskCycleType;
    cycleFrequency: TaskCycleFrequency | null;
    cycleInterval: number | null;
    cycleUnit: TaskCycleUnit | null;
    cycleLabel: string | null;
  } {
    const isRoutine = this.cycleDraft.cycleType === 'ROUTINE';
    const isCustom = isRoutine && this.cycleDraft.frequency === 'CUSTOM';
    return {
      cycleType: this.cycleDraft.cycleType,
      cycleFrequency: isRoutine ? this.cycleDraft.frequency : null,
      cycleInterval: isCustom ? this.cycleDraft.customInterval : null,
      cycleUnit: isCustom ? this.cycleDraft.customUnit : null,
      cycleLabel: this.cycleDraft.label.trim() || null,
    };
  }

  private resolveCycleDraftForGoal(taskGroupId: string, goal: GoalTaskVm): TaskCycleDraftVm {
    const stored = this.readCycleMeta(taskGroupId);
    if (stored) return stored;

    return {
      cycleType: goal.cycleType === 'ROUTINE' ? 'ROUTINE' : 'ONE_TIME',
      frequency:
        goal.cycleFrequency === 'WEEKLY' || goal.cycleFrequency === 'CUSTOM'
          ? goal.cycleFrequency
          : 'DAILY',
      customInterval:
        Number.isFinite(Number(goal.cycleInterval)) && Number(goal.cycleInterval) > 0
          ? Math.trunc(Number(goal.cycleInterval))
          : 1,
      customUnit: goal.cycleUnit === 'WEEKS' ? 'WEEKS' : 'DAYS',
      label: String(goal.cycleLabel || '').trim(),
    };
  }

  private persistCycleMeta(taskGroupId: string): void {
    try {
      const storage = (globalThis as { localStorage?: Storage }).localStorage;
      if (!storage) return;
      storage.setItem(this.resolveCycleMetaStorageKey(taskGroupId), JSON.stringify(this.cycleDraft));
    } catch {}
  }

  private readCycleMeta(taskGroupId: string): TaskCycleDraftVm | null {
    try {
      const storage = (globalThis as { localStorage?: Storage }).localStorage;
      if (!storage) return null;
      const raw = storage.getItem(this.resolveCycleMetaStorageKey(taskGroupId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<TaskCycleDraftVm>;
      if (!parsed || typeof parsed !== 'object') return null;
      const draft = this.createDefaultCycleDraft();
      return {
        cycleType: parsed.cycleType === 'ROUTINE' ? 'ROUTINE' : draft.cycleType,
        frequency:
          parsed.frequency === 'WEEKLY' || parsed.frequency === 'CUSTOM'
            ? parsed.frequency
            : draft.frequency,
        customInterval:
          Number.isFinite(Number(parsed.customInterval)) && Number(parsed.customInterval) > 0
            ? Math.min(99, Math.trunc(Number(parsed.customInterval)))
            : draft.customInterval,
        customUnit: parsed.customUnit === 'WEEKS' ? 'WEEKS' : draft.customUnit,
        label: String(parsed.label || '').trim(),
      };
    } catch {
      return null;
    }
  }

  private resolveCycleMetaStorageKey(taskGroupId: string): string {
    return `${TASK_CYCLE_META_STORAGE_KEY_PREFIX}.${TASK_CYCLE_META_STORAGE_VERSION}.${taskGroupId}`;
  }

  resolveCycleSummaryText(): string {
    const label = this.cycleDraft.label.trim();
    if (this.cycleDraft.cycleType === 'ONE_TIME') {
      return label ? `One-time / ${label}` : 'One-time';
    }
    if (this.cycleDraft.frequency === 'CUSTOM') {
      const unit = this.cycleDraft.customUnit === 'WEEKS' ? 'weeks' : 'days';
      const customText = `Every ${this.cycleDraft.customInterval} ${unit}`;
      return label ? `${customText} / ${label}` : customText;
    }
    const frequency = this.cycleDraft.frequency === 'WEEKLY' ? 'Weekly' : 'Daily';
    return label ? `${frequency} / ${label}` : frequency;
  }

  private buildTaskNotificationContent(): string {
    const title = this.createTitle.trim() || 'Untitled task';
    const description = this.createDescription.trim() || '-';
    const dueAt = this.createDueAt.trim() || 'No date';
    const cycle = this.resolveCycleSummaryText();
    return [
      `Task: ${title}`,
      `Cycle / Label: ${cycle}`,
      `Period date: ${dueAt}`,
      '',
      description,
    ].join('\n');
  }

  private findStudentOption(studentId: number): AssignableStudentOptionVm | null {
    return this.studentOptions.find((student) => student.studentId === studentId) || null;
  }

  private normalizeTaskGroupId(value: unknown): string {
    return String(value ?? '').trim();
  }

  private resolveGoalTaskGroupId(goal: GoalTaskVm | null | undefined): string {
    return String(goal?.taskGroupId || '').trim();
  }

  private collectTaskGroupStudentIds(
    goals: GoalTaskVm[],
    taskGroupId: string,
    fallbackStudentId: number
  ): number[] {
    const groupedIds = goals
      .filter((row) => this.resolveGoalTaskGroupId(row) === taskGroupId)
      .map((row) => row.assignedStudentId);
    const source = groupedIds.length > 0 ? groupedIds : [fallbackStudentId];
    return Array.from(
      new Set(
        source
          .map((studentId) => Math.trunc(Number(studentId)))
          .filter((studentId) => Number.isFinite(studentId) && studentId > 0)
      )
    ).sort((a, b) => a - b);
  }

  private resolveGoalGroupStatus(goals: GoalTaskVm[]): GoalTaskStatus {
    if (goals.length === 0) {
      return 'NOT_STARTED';
    }
    if (goals.every((goal) => goal.status === 'COMPLETED')) {
      return 'COMPLETED';
    }
    if (goals.every((goal) => goal.status === 'NOT_STARTED')) {
      return 'NOT_STARTED';
    }
    return 'IN_PROGRESS';
  }

  selectGoal(group: GoalGroupRowVm): void {
    this.selectedGoalId = group.representativeGoal.id;
    this.updateError = '';
  }

  isGoalGroupSelected(group: GoalGroupRowVm): boolean {
    if (!this.selectedGoalId) return false;
    return group.goals.some((goal) => goal.id === this.selectedGoalId);
  }

  goalGroupStatusLabel(group: GoalGroupRowVm): string {
    const baseStatus = this.goalStatusLabel(group.status);
    if (group.studentCount <= 1) {
      return baseStatus;
    }
    return `${baseStatus}（${group.completedCount}/${group.studentCount} Completed）`;
  }

  goalGroupStudentLabel(group: GoalGroupRowVm): string {
    if (group.studentCount <= 0) {
      return '-';
    }
    if (group.studentNames.length <= 3) {
      return group.studentNames.join('、');
    }
    return `${group.studentNames.slice(0, 3).join('、')} 等${group.studentCount}人`;
  }

  setGoalStatus(group: GoalGroupRowVm, status: GoalTaskStatus): void {
    if (this.updatingGoalGroupKey !== null) return;
    const goalsToUpdate = group.goals.filter((goal) => goal.status !== status);
    if (goalsToUpdate.length === 0) return;

    this.updatingGoalGroupKey = group.taskGroupKey;
    this.updateError = '';
    this.cdr.detectChanges();

    from(goalsToUpdate)
      .pipe(
        concatMap((goal) =>
          this.taskCenter.updateTeacherGoalStatus(goal.id, {
            status,
            progressNote: status === 'COMPLETED' ? '老师已在 Task 系统页标记 Completed。' : goal.progressNote,
          })
        ),
        toArray(),
        finalize(() => {
          this.updatingGoalGroupKey = null;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (updatedRows) => {
          const updatedById = new Map(updatedRows.map((row) => [row.id, row]));
          this.goals = this.sortGoals(
            this.goals.map((row) => updatedById.get(row.id) || row)
          );
          const groupIds = new Set(group.goals.map((row) => row.id));
          const selected = this.goals.find((row) => groupIds.has(row.id));
          this.selectedGoalId = selected?.id || this.selectedGoalId;
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.updateError = this.extractErrorMessage(error) || '更新 Task 状态失败。';
          this.cdr.detectChanges();
        },
      });
  }

  updateTrackingStudentStatus(student: TrackingStudentVm, completed: boolean): void {
    if (student.saving || this.creating) return;

    student.completed = completed;
    if (!student.goalId) {
      this.pendingCompletionByStudentId.set(student.studentId, completed);
      this.scheduleTrackingAutoSave();
      this.cdr.detectChanges();
      return;
    }

    this.persistTrackingStudentStatus(student, completed);
  }

  markAllTrackingStudents(completed: boolean): void {
    if (this.creating || this.trackingStudents.length === 0) return;

    const persistedRows = this.trackingStudents.filter((student) => student.goalId);
    const pendingRows = this.trackingStudents.filter((student) => !student.goalId);

    for (const student of this.trackingStudents) {
      student.completed = completed;
      student.saving = !!student.goalId;
    }
    for (const student of pendingRows) {
      this.pendingCompletionByStudentId.set(student.studentId, completed);
    }
    if (pendingRows.length > 0) {
      this.scheduleTrackingAutoSave();
    }
    if (persistedRows.length === 0) {
      this.cdr.detectChanges();
      return;
    }

    this.updateError = '';
    from(persistedRows)
      .pipe(
        concatMap((student) =>
          this.taskCenter.updateTeacherGoalStatus(student.goalId as number, {
            status: completed ? 'COMPLETED' : 'NOT_STARTED',
            progressNote: completed
              ? 'Teacher marked this student Completed in Task Tracking.'
              : '',
          })
        ),
        toArray(),
        finalize(() => {
          for (const student of persistedRows) {
            student.saving = false;
          }
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (updatedRows) => {
          this.mergeUpdatedGoalRows(updatedRows);
          const updatedByStudentId = new Map(
            updatedRows.map((row) => [row.assignedStudentId, row])
          );
          this.trackingStudents = this.trackingStudents.map((student) => {
            const updated = updatedByStudentId.get(student.studentId);
            if (!updated) return student;
            return {
              ...student,
              goalId: updated.id,
              completed: updated.status === 'COMPLETED',
            };
          });
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.updateError = this.extractErrorMessage(error) || 'Failed to update completion status.';
          this.rebuildTrackingStudentsFromGoals();
          this.cdr.detectChanges();
        },
      });
  }

  openSendConfirmation(): void {
    if (!this.isEditMode || this.sendRecipientCount === 0) return;
    this.sendConfirmOpen = true;
    this.sendConfirmText = '';
    this.sendError = '';
    this.sendSuccess = '';
  }

  closeSendConfirmation(): void {
    this.sendConfirmOpen = false;
    this.sendConfirmText = '';
  }

  confirmSendNotification(): void {
    if (!this.isSendConfirmationReady || this.sendingNotification || !this.editingTaskGroupId) {
      return;
    }

    const selectedIds = this.getSelectedCreateStudentIds();
    if (selectedIds.length === 0) {
      this.sendError = 'Select at least one student before sending.';
      return;
    }

    const request: CreateInfoRequestVm = {
      category: 'ACTIVITY',
      title: `Task update: ${this.createTitle.trim() || 'Untitled task'}`,
      content: this.buildTaskNotificationContent(),
      tags: ['Task Tracking', this.resolveCycleSummaryText()].filter(Boolean),
      studentIds: selectedIds,
      taskGroupId: this.editingTaskGroupId,
    };

    this.sendingNotification = true;
    this.sendError = '';
    this.sendSuccess = '';
    this.taskCenter
      .createInfo(request)
      .pipe(
        finalize(() => {
          this.sendingNotification = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (info) => {
          this.sendSuccess = `Notification sent to ${selectedIds.length} student(s). Ref #${info.id}`;
          this.closeSendConfirmation();
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.sendError = this.extractErrorMessage(error) || 'Failed to send notification.';
          this.cdr.detectChanges();
        },
      });
  }

  trackStudent = (_: number, student: AssignableStudentOptionVm): number => student.studentId;
  trackGoal = (_: number, group: GoalGroupRowVm): string => group.taskGroupKey;
  trackTrackingStudent = (_: number, student: TrackingStudentVm): number => student.studentId;
  goalStatusLabel(status: GoalTaskStatus): string { return status === 'COMPLETED' ? 'Completed' : 'Not Completed'; }
  displayDueAt(goal: GoalTaskVm): string { if (!goal.dueAt) return '无截止日期'; const ts = Date.parse(goal.dueAt); return Number.isFinite(ts) ? new Date(ts).toLocaleDateString() : goal.dueAt; }
  displayUpdatedAt(value: string): string { const ts = Date.parse(value); return Number.isFinite(ts) ? new Date(ts).toLocaleString() : value; }

  private loadAssignableStudents(): void {
    this.studentsLoading = true;
    this.studentsError = '';
    this.taskCenter.listAssignableStudents().pipe(finalize(() => { this.studentsLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (rows) => { this.studentOptions = [...rows].sort((a, b) => a.studentId - b.studentId); this.rebuildStudentOptionStatusMap(); this.syncSelectedStudents(); this.pruneStudentDetails(); this.hydrateStudentDetailsFromAccounts(); this.loadMissingProfilesForVisibleRows(); this.cdr.detectChanges(); },
        error: (error: unknown) => { this.studentsError = this.extractErrorMessage(error) || '加载学生列表失败。'; this.studentOptions = []; this.studentOptionStatus.clear(); this.selectedCreateStudentIds.clear(); this.studentDetails.clear(); this.rebuildMetaFilterOptions(); this.cdr.detectChanges(); },
      });
  }

  private hydrateStudentDetailsFromAccounts(): void {
    const validIds = new Set(this.studentOptions.map((row) => row.studentId));
    this.studentManagement.listStudents().pipe(catchError(() => of([] as StudentAccount[]))).subscribe((resp) => {
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

  private loadMissingProfilesForVisibleRows(): void {
    if (!this.studentPanelExpanded) return;
    const candidateIds = new Set<number>();
    for (const row of this.filteredCreateStudentOptions) candidateIds.add(row.studentId);
    for (const row of this.selectedCreateStudentOptions) candidateIds.add(row.studentId);

    const ids = Array.from(candidateIds).filter((studentId) => {
      const d = this.studentDetails.get(studentId);
      const hasCore = !!(
        d &&
        d.email &&
        d.phone &&
        d.country &&
        d.province &&
        d.city &&
        d.schoolBoard &&
        d.graduation
      );
      const hasExtended = !!(
        d &&
        d.schoolName &&
        d.canadaIdentity &&
        d.gender &&
        d.nationality &&
        d.firstLanguage &&
        d.motherLanguage
      );
      const needsExtended =
        this.visibleCreateStudentColumnKeys.has('schoolName') ||
        this.visibleCreateStudentColumnKeys.has('canadaIdentity') ||
        this.visibleCreateStudentColumnKeys.has('gender') ||
        this.visibleCreateStudentColumnKeys.has('nationality') ||
        this.visibleCreateStudentColumnKeys.has('firstLanguage') ||
        this.visibleCreateStudentColumnKeys.has('motherLanguage');
      const needsTeacherNote = this.visibleCreateStudentColumnKeys.has('teacherNote');
      const hasProfileLoaded = this.teacherNoteProfileCache.has(studentId);
      return (
        !this.profileLoadInFlight.has(studentId) &&
        (!hasCore || (needsExtended && !hasExtended) || (needsTeacherNote && !hasProfileLoaded)) &&
        !hasProfileLoaded
      );
    });
    if (ids.length === 0) return;

    from(ids).pipe(
      mergeMap((studentId) => {
        this.profileLoadInFlight.add(studentId);
        return this.studentProfile.getStudentProfileForTeacher(studentId).pipe(
          map((payload) => ({ studentId, payload })),
          catchError(() => of({ studentId, payload: null as StudentProfilePayload | StudentProfileResponse | null })),
          finalize(() => this.profileLoadInFlight.delete(studentId))
        );
      }, 4),
      toArray()
    ).subscribe((rows) => {
      for (const row of rows) {
        if (!row.payload) continue;
        this.teacherNoteProfileCache.set(row.studentId, row.payload);
        this.upsertDetail(row.studentId, this.buildFromProfile(row.payload));
      }
      this.pruneUnselectableSelectedStudents();
      this.rebuildMetaFilterOptions();
      this.cdr.detectChanges();
    });
  }

  private loadGoals(): void {
    this.goalsLoading = true;
    this.goalsError = '';
    this.taskCenter.listTeacherGoals({
      studentId: this.filterStudentId,
      status: this.filterStatus,
      keyword: this.filterKeyword,
      page: 1,
      size: 100,
    }).pipe(finalize(() => { this.goalsLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (resp) => { this.goals = this.sortGoals(resp.items || []); if (this.selectedGoalId && !this.goals.some((row) => row.id === this.selectedGoalId)) this.selectedGoalId = this.goals.length > 0 ? this.goals[0].id : null; if (!this.selectedGoalId && this.goals.length > 0) this.selectedGoalId = this.goals[0].id; this.cdr.detectChanges(); },
        error: (error: unknown) => { this.goalsError = this.extractErrorMessage(error) || '加载 Task 列表失败。'; this.goals = []; this.selectedGoalId = null; this.cdr.detectChanges(); },
      });
  }

  private sortGoals(items: GoalTaskVm[]): GoalTaskVm[] {
    return [...items].sort((a, b) => {
      const rankA = a.status === 'COMPLETED' ? 1 : 0;
      const rankB = b.status === 'COMPLETED' ? 1 : 0;
      if (rankA !== rankB) return rankA - rankB;
      const dueA = this.toTs(a.dueAt, Number.MAX_SAFE_INTEGER);
      const dueB = this.toTs(b.dueAt, Number.MAX_SAFE_INTEGER);
      if (dueA !== dueB) return dueA - dueB;
      return this.toTs(b.updatedAt, 0) - this.toTs(a.updatedAt, 0);
    });
  }

  private toTs(value: string | null | undefined, fallback: number): number {
    const ts = Date.parse(String(value || ''));
    return Number.isFinite(ts) ? ts : fallback;
  }

  private syncSelectedStudents(): void {
    const validIds = new Set(this.studentOptions.map((row) => row.studentId));
    this.selectedCreateStudentIds = new Set(Array.from(this.selectedCreateStudentIds.values()).filter((id) => validIds.has(id)));
  }

  private pruneStudentDetails(): void {
    const validIds = new Set(this.studentOptions.map((row) => row.studentId));
    for (const studentId of Array.from(this.studentDetails.keys())) if (!validIds.has(studentId)) this.studentDetails.delete(studentId);
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
      this.studentOptionStatus.set(
        student.studentId,
        this.resolveAssignableStudentStatus(student)
      );
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
      ielts: '',
      languageTracking: '',
      languageCourseStatus: '',
      ossltResult: '',
      ossltTracking: '',
      totalVolunteerHours: null,
      volunteerCompleted: null,
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
      ielts: patch.ielts?.trim() || current.ielts,
      languageTracking: patch.languageTracking?.trim() || current.languageTracking,
      languageCourseStatus:
        this.normalizeLanguageCourseStatusValue(patch.languageCourseStatus) ||
        current.languageCourseStatus,
      ossltResult: patch.ossltResult || current.ossltResult,
      ossltTracking: patch.ossltTracking || current.ossltTracking,
      totalVolunteerHours:
        patch.totalVolunteerHours !== undefined
          ? patch.totalVolunteerHours
          : current.totalVolunteerHours,
      volunteerCompleted:
        patch.volunteerCompleted !== undefined
          ? patch.volunteerCompleted
          : current.volunteerCompleted,
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
      ielts: '',
      languageTracking: '',
      languageCourseStatus: '',
      ossltResult: '',
      ossltTracking: '',
      totalVolunteerHours: null,
      volunteerCompleted: null,
      status: '',
    };
    this.studentDetails.set(studentId, {
      ...current,
      teacherNote: String(noteText ?? ''),
    });
  }

  private buildFromAccount(student: StudentAccount): Partial<StudentDetailVm> {
    const root = (student ?? {}) as Record<string, unknown>;
    const profile =
      root['profile'] && typeof root['profile'] === 'object'
        ? (root['profile'] as Record<string, unknown>)
        : {};
    const graduation = this.formatGraduation(this.pick([
      student['currentSchoolExpectedGraduation'], student['expectedGraduationTime'], student['expectedGraduationDate'],
      profile['currentSchoolExpectedGraduation'], profile['expectedGraduationTime'], profile['expectedGraduationDate'],
    ]));
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
      city: this.pick([student['currentSchoolCity'], student['schoolCity'], student['city'], profile['currentSchoolCity'], profile['city']]),
      graduation,
      schoolName: this.pick([
        student['currentSchoolName'],
        student['schoolName'],
        student['school'],
        profile['currentSchoolName'],
        profile['schoolName'],
        profile['school'],
      ]),
      canadaIdentity: this.pick([
        student['identityInCanada'],
        student['statusInCanada'],
        student['canadaIdentity'],
        student['canadianStatus'],
        student['immigrationStatus'],
        student['visaStatus'],
        student['studyPermitStatus'],
        profile['identityInCanada'],
        profile['statusInCanada'],
        profile['canadaIdentity'],
        profile['canadianStatus'],
        profile['immigrationStatus'],
        profile['visaStatus'],
        profile['studyPermitStatus'],
      ]),
      gender: this.pick([student['gender'], student['sex'], profile['gender'], profile['sex']]),
      nationality: this.pick([
        student['nationality'],
        student['citizenship'],
        profile['nationality'],
        profile['citizenship'],
      ]),
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
      country: this.pick([student['currentSchoolCountry'], student['schoolCountry'], student['country'], profile['currentSchoolCountry'], profile['country']]),
      schoolBoard: this.pick([student['currentSchoolBoard'], student['schoolBoard'], student['educationBoard'], profile['currentSchoolBoard'], profile['schoolBoard'], profile['educationBoard']]),
      graduationSeason: this.resolveGraduationSeason(graduation),
      ielts: this.extractIeltsFromRecord(root, profile),
      languageTracking: this.extractLanguageTrackingFromRecord(root, profile),
      languageCourseStatus: this.extractLanguageCourseStatusFromRecord(root, profile),
      ossltResult: this.extractOssltResultFromRecord(root, profile),
      ossltTracking: this.extractOssltTrackingStatusFromRecord(root, profile),
      totalVolunteerHours: this.extractVolunteerHoursFromRecord(root, profile),
      volunteerCompleted: this.extractVolunteerCompletedFromRecord(root, profile),
      status: this.normalizeAccountStatus(student.status),
    };
  }

  private buildFromProfile(payload: StudentProfilePayload | StudentProfileResponse): Partial<StudentDetailVm> {
    const root = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const profile = root['profile'] && typeof root['profile'] === 'object' ? (root['profile'] as Record<string, unknown>) : root;
    const school = profile['currentSchool'] && typeof profile['currentSchool'] === 'object' ? (profile['currentSchool'] as Record<string, unknown>) : {};
    const graduation = this.formatGraduation(this.pick([
      profile['currentSchoolExpectedGraduation'], profile['expectedGraduationTime'], profile['expectedGraduationDate'],
      school['currentSchoolExpectedGraduation'], school['expectedGraduationTime'], school['expectedGraduationDate'],
      root['currentSchoolExpectedGraduation'],
    ]));
    return {
      email: this.pick([profile['email'], root['email']]),
      phone: this.pick([profile['phone'], root['phone']]),
      province: this.pick([
        profile['currentSchoolProvince'],
        profile['province'],
        school['province'],
        root['currentSchoolProvince'],
      ]),
      city: this.pick([profile['currentSchoolCity'], profile['city'], school['city'], root['currentSchoolCity']]),
      graduation,
      schoolName: this.pick([
        profile['currentSchoolName'],
        profile['schoolName'],
        profile['school'],
        school['schoolName'],
        school['name'],
        root['currentSchoolName'],
        root['schoolName'],
      ]),
      canadaIdentity: this.pick([
        profile['identityInCanada'],
        profile['statusInCanada'],
        profile['canadaIdentity'],
        profile['canadianStatus'],
        profile['immigrationStatus'],
        profile['visaStatus'],
        profile['studyPermitStatus'],
        root['identityInCanada'],
        root['statusInCanada'],
        root['canadaIdentity'],
        root['canadianStatus'],
        root['immigrationStatus'],
        root['visaStatus'],
        root['studyPermitStatus'],
      ]),
      gender: this.pick([profile['gender'], profile['sex'], root['gender'], root['sex']]),
      nationality: this.pick([
        profile['nationality'],
        profile['citizenship'],
        root['nationality'],
        root['citizenship'],
      ]),
      firstLanguage: this.pick([
        profile['firstLanguage'],
        profile['primaryLanguage'],
        profile['nativeLanguage'],
        profile['motherTongue'],
        root['firstLanguage'],
        root['primaryLanguage'],
        root['nativeLanguage'],
        root['motherTongue'],
      ]),
      motherLanguage: this.pick([
        profile['motherLanguage'],
        profile['motherTongue'],
        profile['nativeLanguage'],
        root['motherLanguage'],
        root['motherTongue'],
        root['nativeLanguage'],
      ]),
      teacherNote: this.pick([profile['teacherNote'], profile['teacherNotes'], root['teacherNote']]),
      country: this.pick([profile['currentSchoolCountry'], profile['country'], school['country'], root['currentSchoolCountry']]),
      schoolBoard: this.pick([profile['currentSchoolBoard'], profile['schoolBoard'], profile['educationBoard'], school['schoolBoard'], school['educationBoard'], root['currentSchoolBoard']]),
      graduationSeason: this.resolveGraduationSeason(graduation),
      ielts: this.extractIeltsFromRecord(root, profile),
      languageTracking: this.extractLanguageTrackingFromRecord(root, profile),
      languageCourseStatus: this.extractLanguageCourseStatusFromRecord(root, profile),
      ossltResult: this.extractOssltResultFromRecord(root, profile),
      ossltTracking: this.extractOssltTrackingStatusFromRecord(root, profile),
      totalVolunteerHours: this.extractVolunteerHoursFromRecord(root, profile),
      volunteerCompleted: this.extractVolunteerCompletedFromRecord(root, profile),
      status: this.normalizeAccountStatus(root['status']),
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
    if (this.skipDependentFilterValidationOnce) {
      this.skipDependentFilterValidationOnce = false;
    } else {
      this.syncSchoolBoardFilterSelection();
      this.syncGraduationSeasonFilterSelection();
    }
    this.persistCreateStudentFiltersPreference();
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

  private normalizeCityValueForDetail(value: unknown, country: ProvinceFilterCountry | '' = ''): string {
    return this.normalizeCityFilterValue(value, country);
  }

  private resolveIeltsLabel(value: StudentDetailVm['ielts']): string {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'GREEN_STRICT_PASS') return '\u5df2\u8fbe\u6807';
    if (normalized === 'GREEN_COMMON_PASS_WITH_WARNING') return '\u57fa\u672c\u8fbe\u6807';
    if (normalized === 'YELLOW_NEEDS_PREPARATION') return '\u9700\u63d0\u5347';
    if (normalized === 'NO_REQUIREMENT') return '\u65e0\u9700\u8981\u6c42';
    return String(value ?? '').trim() || '\u5f85\u66f4\u65b0';
  }

  private resolveLanguageTrackingLabel(value: StudentDetailVm['languageTracking']): string {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'TEACHER_REVIEW_APPROVED') return '\u6559\u5e08\u5df2\u786e\u8ba4';
    if (normalized === 'AUTO_PASS_ALL_SCHOOLS') return '\u5168\u90e8\u5b66\u6821\u8fbe\u6807';
    if (normalized === 'AUTO_PASS_PARTIAL_SCHOOLS') return '\u90e8\u5206\u5b66\u6821\u8fbe\u6807';
    if (normalized === 'NEEDS_TRACKING') return '\u9700\u8981\u8ddf\u8fdb';
    return String(value ?? '').trim() || '\u5f85\u66f4\u65b0';
  }

  private resolveLanguageCourseStatusLabel(value: StudentDetailVm['languageCourseStatus']): string {
    const normalized = this.normalizeLanguageCourseStatusValue(value);
    if (normalized === 'NOT_RECEIVED_TRAINING') return '\u672a\u63a5\u6536\u57f9\u8bad';
    if (normalized === 'ENROLLED_GLOBAL_IELTS') return '\u5df2\u62a5\u540d\u73af\u7403\u96c5\u601d\u8bfe\u7a0b';
    if (normalized === 'ENROLLED_OTHER_IELTS') return '\u5df2\u62a5\u540d\u5176\u4ed6\u673a\u6784\u96c5\u601d\u8bfe\u7a0b';
    if (normalized === 'COURSE_COMPLETED_NOT_EXAMINED') return '\u5df2\u7ed3\u8bfe\uff0c\u672a\u8003\u8bd5';
    if (normalized === 'EXAM_REGISTERED') return '\u5df2\u62a5\u540d\u8003\u8bd5';
    if (normalized === 'SCORE_RELEASED') return '\u5df2\u51fa\u5206';
    return String(value ?? '').trim() || '\u5f85\u66f4\u65b0';
  }

  private extractIeltsFromRecord(
    source: Record<string, unknown>,
    profileSource?: Record<string, unknown>
  ): StudentDetailVm['ielts'] {
    const ieltsNode =
      this.asObjectRecord(source['ieltsModule']) ||
      this.asObjectRecord(source['ielts']) ||
      this.asObjectRecord(source['languageModule']);
    const profileIeltsNode =
      this.asObjectRecord(profileSource?.['ieltsModule']) ||
      this.asObjectRecord(profileSource?.['ielts']) ||
      this.asObjectRecord(profileSource?.['languageModule']);

    const candidates: unknown[] = [
      source['languageScoreStatus'],
      source['ieltsStatus'],
      source['latestIeltsStatus'],
      source['ielts_status'],
      ieltsNode?.['languageScoreStatus'],
      ieltsNode?.['ieltsStatus'],
      ieltsNode?.['latestIeltsStatus'],
      ieltsNode?.['ielts_status'],
      profileSource?.['languageScoreStatus'],
      profileSource?.['ieltsStatus'],
      profileSource?.['latestIeltsStatus'],
      profileIeltsNode?.['languageScoreStatus'],
      profileIeltsNode?.['ieltsStatus'],
      profileIeltsNode?.['latestIeltsStatus'],
    ];

    for (const candidate of candidates) {
      const normalized = this.normalizeIeltsValue(candidate);
      if (normalized) return normalized;
    }
    return '';
  }

  private extractLanguageTrackingFromRecord(
    source: Record<string, unknown>,
    profileSource?: Record<string, unknown>
  ): StudentDetailVm['languageTracking'] {
    const ieltsNode =
      this.asObjectRecord(source['ieltsModule']) ||
      this.asObjectRecord(source['ielts']) ||
      this.asObjectRecord(source['languageModule']);
    const profileIeltsNode =
      this.asObjectRecord(profileSource?.['ieltsModule']) ||
      this.asObjectRecord(profileSource?.['ielts']) ||
      this.asObjectRecord(profileSource?.['languageModule']);

    const candidates: unknown[] = [
      source['languageTrackingStatus'],
      source['ieltsTrackingStatus'],
      source['trackingStatus'],
      source['language_tracking_status'],
      ieltsNode?.['languageTrackingStatus'],
      ieltsNode?.['ieltsTrackingStatus'],
      ieltsNode?.['trackingStatus'],
      ieltsNode?.['language_tracking_status'],
      profileSource?.['languageTrackingStatus'],
      profileSource?.['ieltsTrackingStatus'],
      profileSource?.['trackingStatus'],
      profileIeltsNode?.['languageTrackingStatus'],
      profileIeltsNode?.['ieltsTrackingStatus'],
      profileIeltsNode?.['trackingStatus'],
    ];

    for (const candidate of candidates) {
      const normalized = this.normalizeLanguageTrackingValue(candidate);
      if (normalized) return normalized;
    }
    return '';
  }

  private extractLanguageCourseStatusFromRecord(
    source: Record<string, unknown>,
    profileSource?: Record<string, unknown>
  ): StudentDetailVm['languageCourseStatus'] {
    const ieltsNode =
      this.asObjectRecord(source['ieltsModule']) ||
      this.asObjectRecord(source['ielts']) ||
      this.asObjectRecord(source['languageModule']);
    const profileIeltsNode =
      this.asObjectRecord(profileSource?.['ieltsModule']) ||
      this.asObjectRecord(profileSource?.['ielts']) ||
      this.asObjectRecord(profileSource?.['languageModule']);

    const candidates: unknown[] = [
      source['languageCourseStatus'],
      source['language_course_status'],
      source['languageCourseEnrollmentStatus'],
      source['language_course_enrollment_status'],
      ieltsNode?.['languageCourseStatus'],
      ieltsNode?.['language_course_status'],
      ieltsNode?.['languageCourseEnrollmentStatus'],
      ieltsNode?.['language_course_enrollment_status'],
      profileSource?.['languageCourseStatus'],
      profileSource?.['language_course_status'],
      profileSource?.['languageCourseEnrollmentStatus'],
      profileSource?.['language_course_enrollment_status'],
      profileIeltsNode?.['languageCourseStatus'],
      profileIeltsNode?.['language_course_status'],
      profileIeltsNode?.['languageCourseEnrollmentStatus'],
      profileIeltsNode?.['language_course_enrollment_status'],
    ];

    for (const candidate of candidates) {
      const normalized = this.normalizeLanguageCourseStatusValue(candidate);
      if (normalized) return normalized;
    }
    return '';
  }

  private normalizeIeltsValue(value: unknown): StudentDetailVm['ielts'] {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const normalized = raw.toUpperCase();
    if (normalized === 'GREEN_STRICT_PASS') return 'GREEN_STRICT_PASS';
    if (normalized === 'GREEN_COMMON_PASS_WITH_WARNING') return 'GREEN_COMMON_PASS_WITH_WARNING';
    if (normalized === 'YELLOW_NEEDS_PREPARATION') return 'YELLOW_NEEDS_PREPARATION';
    if (normalized === 'NO_REQUIREMENT') return 'NO_REQUIREMENT';
    return raw;
  }

  private normalizeLanguageTrackingValue(value: unknown): StudentDetailVm['languageTracking'] {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const normalized = raw.toUpperCase();
    if (normalized === 'TEACHER_REVIEW_APPROVED') return 'TEACHER_REVIEW_APPROVED';
    if (normalized === 'AUTO_PASS_ALL_SCHOOLS') return 'AUTO_PASS_ALL_SCHOOLS';
    if (normalized === 'AUTO_PASS_PARTIAL_SCHOOLS') return 'AUTO_PASS_PARTIAL_SCHOOLS';
    if (normalized === 'NEEDS_TRACKING') return 'NEEDS_TRACKING';
    return raw;
  }

  private normalizeLanguageCourseStatusValue(
    value: unknown
  ): StudentDetailVm['languageCourseStatus'] {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const normalized = raw.toUpperCase();
    if (normalized === 'NOT_RECEIVED_TRAINING' || normalized === '1') return 'NOT_RECEIVED_TRAINING';
    if (normalized === 'ENROLLED_GLOBAL_IELTS' || normalized === '2') return 'ENROLLED_GLOBAL_IELTS';
    if (normalized === 'ENROLLED_OTHER_IELTS' || normalized === '3') return 'ENROLLED_OTHER_IELTS';
    if (normalized === 'COURSE_COMPLETED_NOT_EXAMINED' || normalized === '4') {
      return 'COURSE_COMPLETED_NOT_EXAMINED';
    }
    if (normalized === 'EXAM_REGISTERED' || normalized === '5') return 'EXAM_REGISTERED';
    if (normalized === 'SCORE_RELEASED' || normalized === '6') return 'SCORE_RELEASED';
    return raw as StudentDetailVm['languageCourseStatus'];
  }

  private resolveOssltResultLabel(value: StudentDetailVm['ossltResult']): string {
    if (value === 'PASS') return '\u5df2\u901a\u8fc7';
    if (value === 'FAIL') return '\u672a\u901a\u8fc7';
    return '\u5f85\u66f4\u65b0';
  }

  private resolveOssltTrackingStatusLabel(value: StudentDetailVm['ossltTracking']): string {
    if (value === 'PASSED') return '\u5df2\u901a\u8fc7';
    if (value === 'NEEDS_TRACKING') return '\u9700\u8981\u8ddf\u8fdb';
    if (value === 'WAITING_UPDATE') return '\u7b49\u5f85\u66f4\u65b0';
    return '\u5f85\u66f4\u65b0';
  }

  private extractOssltResultFromRecord(
    source: Record<string, unknown>,
    profileSource?: Record<string, unknown>
  ): StudentDetailVm['ossltResult'] {
    const ossltNode =
      this.asObjectRecord(source['ossltModule']) ||
      this.asObjectRecord(source['osslt']) ||
      this.asObjectRecord(source['ossltData']);
    const summaryNode =
      this.asObjectRecord(source['ossltSummary']) ||
      this.asObjectRecord(ossltNode?.['summary']) ||
      this.asObjectRecord(source['summary']);

    const candidates: unknown[] = [
      source['latestOssltResult'],
      source['latest_osslt_result'],
      source['ossltResult'],
      source['osslt_result'],
      source['result'],
      ossltNode?.['latestOssltResult'],
      ossltNode?.['latest_osslt_result'],
      ossltNode?.['ossltResult'],
      ossltNode?.['osslt_result'],
      summaryNode?.['latestOssltResult'],
      summaryNode?.['latest_osslt_result'],
      summaryNode?.['latestOssltResultStatus'],
      summaryNode?.['latest_osslt_result_status'],
      profileSource?.['latestOssltResult'],
      profileSource?.['latest_osslt_result'],
      profileSource?.['ossltResult'],
      profileSource?.['osslt_result'],
    ];

    for (const candidate of candidates) {
      const normalized = this.normalizeOssltResultValue(candidate);
      if (normalized) return normalized;
    }
    return '';
  }

  private extractOssltTrackingStatusFromRecord(
    source: Record<string, unknown>,
    profileSource?: Record<string, unknown>
  ): StudentDetailVm['ossltTracking'] {
    const ossltNode =
      this.asObjectRecord(source['ossltModule']) ||
      this.asObjectRecord(source['osslt']) ||
      this.asObjectRecord(source['ossltData']);
    const summaryNode =
      this.asObjectRecord(source['ossltSummary']) ||
      this.asObjectRecord(ossltNode?.['summary']) ||
      this.asObjectRecord(source['summary']);

    const candidates: unknown[] = [
      source['ossltTrackingStatus'],
      source['osslt_tracking_status'],
      source['ossltTrackingManualStatus'],
      source['osslt_tracking_manual_status'],
      source['trackingStatus'],
      source['tracking_status'],
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
      profileSource?.['ossltTrackingStatus'],
      profileSource?.['osslt_tracking_status'],
      profileSource?.['ossltTrackingManualStatus'],
      profileSource?.['osslt_tracking_manual_status'],
      profileSource?.['trackingStatus'],
      profileSource?.['tracking_status'],
    ];

    for (const candidate of candidates) {
      const normalized = this.normalizeOssltTrackingStatusValue(candidate);
      if (normalized) return normalized;
    }
    return '';
  }

  private normalizeOssltResultValue(value: unknown): StudentDetailVm['ossltResult'] {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'PASS') return 'PASS';
    if (normalized === 'FAIL') return 'FAIL';
    if (normalized === 'UNKNOWN') return 'UNKNOWN';
    return '';
  }

  private normalizeOssltTrackingStatusValue(value: unknown): StudentDetailVm['ossltTracking'] {
    const normalized = String(value ?? '').trim().toUpperCase();
    if (normalized === 'PASSED') return 'PASSED';
    if (normalized === 'WAITING_UPDATE') return 'WAITING_UPDATE';
    if (normalized === 'NEEDS_TRACKING') return 'NEEDS_TRACKING';
    return '';
  }

  private extractVolunteerHoursFromRecord(
    source: Record<string, unknown>,
    profileSource?: Record<string, unknown>
  ): number | null {
    const volunteerNode =
      this.asObjectRecord(source['volunteerTracking']) ||
      this.asObjectRecord(source['volunteer']) ||
      this.asObjectRecord(source['volunteerSummary']);
    const profileVolunteerNode =
      this.asObjectRecord(profileSource?.['volunteerTracking']) ||
      this.asObjectRecord(profileSource?.['volunteer']) ||
      this.asObjectRecord(profileSource?.['volunteerSummary']);

    const candidates: unknown[] = [
      source['totalVolunteerHours'],
      source['volunteerTotalHours'],
      source['volunteerHours'],
      source['totalHours'],
      volunteerNode?.['totalVolunteerHours'],
      volunteerNode?.['volunteerTotalHours'],
      volunteerNode?.['totalHours'],
      volunteerNode?.['hours'],
      profileSource?.['totalVolunteerHours'],
      profileSource?.['volunteerTotalHours'],
      profileSource?.['volunteerHours'],
      profileSource?.['totalHours'],
      profileVolunteerNode?.['totalVolunteerHours'],
      profileVolunteerNode?.['volunteerTotalHours'],
      profileVolunteerNode?.['totalHours'],
      profileVolunteerNode?.['hours'],
    ];

    for (const candidate of candidates) {
      const parsed = this.parseNumberValue(candidate);
      if (parsed !== null) {
        return parsed;
      }
    }
    return null;
  }

  private extractVolunteerCompletedFromRecord(
    source: Record<string, unknown>,
    profileSource?: Record<string, unknown>
  ): boolean | null {
    const volunteerNode =
      this.asObjectRecord(source['volunteerTracking']) ||
      this.asObjectRecord(source['volunteer']) ||
      this.asObjectRecord(source['volunteerSummary']);
    const profileVolunteerNode =
      this.asObjectRecord(profileSource?.['volunteerTracking']) ||
      this.asObjectRecord(profileSource?.['volunteer']) ||
      this.asObjectRecord(profileSource?.['volunteerSummary']);

    const candidates: unknown[] = [
      source['volunteerCompleted'],
      source['isVolunteerCompleted'],
      source['completedVolunteer'],
      source['volunteer_completion'],
      volunteerNode?.['volunteerCompleted'],
      volunteerNode?.['isVolunteerCompleted'],
      volunteerNode?.['completed'],
      volunteerNode?.['completionStatus'],
      profileSource?.['volunteerCompleted'],
      profileSource?.['isVolunteerCompleted'],
      profileVolunteerNode?.['volunteerCompleted'],
      profileVolunteerNode?.['isVolunteerCompleted'],
      profileVolunteerNode?.['completed'],
      profileVolunteerNode?.['completionStatus'],
    ];

    for (const candidate of candidates) {
      const parsed = this.parseBooleanValue(candidate);
      if (parsed !== null) {
        return parsed;
      }
    }

    const totalHours = this.extractVolunteerHoursFromRecord(source, profileSource);
    return totalHours === null ? null : totalHours >= 40;
  }

  private parseNumberValue(value: unknown): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private parseBooleanValue(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
      return null;
    }
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (
      normalized === 'true' ||
      normalized === 'yes' ||
      normalized === 'y' ||
      normalized === '1' ||
      normalized === 'completed'
    ) {
      return true;
    }
    if (
      normalized === 'false' ||
      normalized === 'no' ||
      normalized === 'n' ||
      normalized === '0' ||
      normalized === 'incomplete'
    ) {
      return false;
    }
    return null;
  }

  private normalizeVolunteerCompletedFilterValue(value: unknown): VolunteerCompletedFilterValue {
    if (value === true) return 'COMPLETED';
    if (value === false || value === null || value === undefined) return '';
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value <= 0) return '';
      return 'COMPLETED';
    }

    const normalized = String(value ?? '')
      .trim()
      .toUpperCase();
    if (!normalized || normalized === 'ALL' || normalized === 'ANY') return '';
    if (normalized === 'COMPLETED' || normalized === 'DONE') return 'COMPLETED';
    if (normalized === 'NOT_COMPLETED' || normalized === 'INCOMPLETE') return 'NOT_COMPLETED';
    if (normalized === 'TRUE' || normalized === 'YES' || normalized === '1') return 'COMPLETED';
    if (normalized === 'FALSE' || normalized === 'NO' || normalized === '0') return '';
    return '';
  }

  private asObjectRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  }

  private pick(candidates: unknown[]): string {
    for (const candidate of candidates) { const text = String(candidate ?? '').trim(); if (text) return text; }
    return '';
  }

  private formatGraduation(value: unknown): string {
    const text = String(value ?? '').trim();
    if (!text) return '';
    const ym = text.match(/^(\d{4})[-/. ](\d{1,2})$/);
    if (ym) return `${ym[1]}-${String(Number(ym[2])).padStart(2, '0')}`;
    const ts = Date.parse(text);
    if (Number.isFinite(ts)) { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
    return text;
  }

  private resolveGraduationSeason(graduation: string): string {
    const text = String(graduation || '').trim();
    if (!text) return '';
    const ym = text.match(/^(\d{4})-(\d{2})$/);
    if (ym) { const year = Number(ym[1]); const month = Number(ym[2]); return `${year} ${month >= 7 ? 'Fall' : 'Winter'}`; }
    const ts = Date.parse(text);
    if (Number.isFinite(ts)) { const d = new Date(ts); return `${d.getFullYear()} ${d.getMonth() + 1 >= 7 ? 'Fall' : 'Winter'}`; }
    return '';
  }

  private resolveStudentId(account: StudentAccount): number | null {
    const candidates: unknown[] = [account.studentId, account['student_id'], account['studentAccountId'], account['id']];
    for (const candidate of candidates) { const n = Number(candidate); if (Number.isFinite(n) && n > 0) return Math.trunc(n); }
    return null;
  }

  private normalizeAccounts(raw: StudentAccount[] | { items?: StudentAccount[]; data?: StudentAccount[] } | unknown): StudentAccount[] {
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') {
      const node = raw as { items?: unknown; data?: unknown };
      if (Array.isArray(node.items)) return node.items as StudentAccount[];
      if (Array.isArray(node.data)) return node.data as StudentAccount[];
    }
    return [];
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

  private resolveLanguageScoreForFilter(
    student: AssignableStudentOptionVm,
    detail: StudentDetailVm | undefined
  ): string {
    const detailValue = this.normalizeIeltsValue(detail?.ielts);
    if (detailValue) return detailValue;
    return this.extractIeltsFromRecord(student as unknown as Record<string, unknown>);
  }

  private matchesLanguageScoreFilter(
    student: AssignableStudentOptionVm,
    detail: StudentDetailVm | undefined
  ): boolean {
    if (!this.createLanguageScoreFilter) {
      return true;
    }
    return (
      this.resolveLanguageScoreForFilter(student, detail) === this.createLanguageScoreFilter
    );
  }

  private resolveLanguageTrackingForFilter(
    student: AssignableStudentOptionVm,
    detail: StudentDetailVm | undefined
  ): string {
    const detailValue = this.normalizeLanguageTrackingValue(detail?.languageTracking);
    if (detailValue) return detailValue;
    return this.extractLanguageTrackingFromRecord(
      student as unknown as Record<string, unknown>
    );
  }

  private matchesLanguageTrackingFilter(
    student: AssignableStudentOptionVm,
    detail: StudentDetailVm | undefined
  ): boolean {
    if (!this.createLanguageTrackingFilter) {
      return true;
    }
    return (
      this.resolveLanguageTrackingForFilter(student, detail) ===
      this.createLanguageTrackingFilter
    );
  }

  private resolveLanguageCourseStatusForFilter(
    student: AssignableStudentOptionVm,
    detail: StudentDetailVm | undefined
  ): StudentDetailVm['languageCourseStatus'] {
    const detailValue = this.normalizeLanguageCourseStatusValue(detail?.languageCourseStatus);
    if (detailValue) return detailValue;
    return this.extractLanguageCourseStatusFromRecord(
      student as unknown as Record<string, unknown>
    );
  }

  private matchesLanguageCourseStatusFilter(
    student: AssignableStudentOptionVm,
    detail: StudentDetailVm | undefined
  ): boolean {
    if (!this.createLanguageCourseStatusFilter) {
      return true;
    }
    return (
      this.resolveLanguageCourseStatusForFilter(student, detail) ===
      this.createLanguageCourseStatusFilter
    );
  }

  private resolveOssltResultForFilter(
    student: AssignableStudentOptionVm,
    detail: StudentDetailVm | undefined
  ): string {
    const detailValue = this.normalizeOssltResultValue(detail?.ossltResult);
    if (detailValue) return detailValue;
    return this.extractOssltResultFromRecord(student as unknown as Record<string, unknown>);
  }

  private matchesOssltResultFilter(
    student: AssignableStudentOptionVm,
    detail: StudentDetailVm | undefined
  ): boolean {
    if (!this.createOssltResultFilter) {
      return true;
    }
    return this.resolveOssltResultForFilter(student, detail) === this.createOssltResultFilter;
  }

  private resolveOssltTrackingForFilter(
    student: AssignableStudentOptionVm,
    detail: StudentDetailVm | undefined
  ): string {
    const detailValue = this.normalizeOssltTrackingStatusValue(detail?.ossltTracking);
    if (detailValue) return detailValue;
    return this.extractOssltTrackingStatusFromRecord(
      student as unknown as Record<string, unknown>
    );
  }

  private matchesOssltTrackingFilter(
    student: AssignableStudentOptionVm,
    detail: StudentDetailVm | undefined
  ): boolean {
    if (!this.createOssltTrackingFilter) {
      return true;
    }
    return (
      this.resolveOssltTrackingForFilter(student, detail) === this.createOssltTrackingFilter
    );
  }

  private matchesVolunteerCompletedFilter(
    student: AssignableStudentOptionVm,
    detail: StudentDetailVm | undefined
  ): boolean {
    if (!this.createVolunteerCompletedFilter) {
      return true;
    }
    const completed = this.resolveVolunteerCompletedForFilter(student, detail);
    if (completed === null) {
      return false;
    }
    if (this.createVolunteerCompletedFilter === 'COMPLETED') {
      return completed;
    }
    return !completed;
  }

  private resolveVolunteerCompletedForFilter(
    student: AssignableStudentOptionVm,
    detail: StudentDetailVm | undefined
  ): boolean | null {
    if (typeof detail?.volunteerCompleted === 'boolean') {
      return detail.volunteerCompleted;
    }
    const totalHours = detail?.totalVolunteerHours;
    if (typeof totalHours === 'number' && Number.isFinite(totalHours)) {
      return totalHours >= 40;
    }

    const row = (student ?? {}) as unknown as Record<string, unknown>;
    const completed = this.parseBooleanValue(
      row['volunteerCompleted'] ?? row['isVolunteerCompleted']
    );
    if (completed !== null) {
      return completed;
    }
    const rowHours = this.parseNumberValue(
      row['totalVolunteerHours'] ?? row['volunteerTotalHours'] ?? row['totalHours']
    );
    if (rowHours === null) {
      return null;
    }
    return rowHours >= 40;
  }

  private matchesCreateStudentFilters(
    student: AssignableStudentOptionVm,
    keyword: string
  ): boolean {
    const detail = this.studentDetails.get(student.studentId);
    if (this.resolveCreateStudentStatus(student, detail) === 'ARCHIVED') return false;
    if (!this.matchesCountryFilter(detail)) return false;
    if (!this.matchesProvinceFilter(detail)) return false;
    if (!this.matchesCityFilter(detail)) return false;
    if (!this.matchesSchoolBoardFilter(detail)) return false;
    if (!this.matchesGraduationSeasonFilter(detail)) return false;
    if (!this.matchesLanguageScoreFilter(student, detail)) return false;
    if (!this.matchesLanguageTrackingFilter(student, detail)) return false;
    if (!this.matchesLanguageCourseStatusFilter(student, detail)) return false;
    if (!this.matchesOssltResultFilter(student, detail)) return false;
    if (!this.matchesOssltTrackingFilter(student, detail)) return false;
    if (!this.matchesVolunteerCompletedFilter(student, detail)) return false;
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
      this.detailIelts(student),
      this.detailLanguageTracking(student),
      this.detailLanguageCourseStatus(student),
      detail?.ielts || '',
      detail?.languageTracking || '',
      detail?.languageCourseStatus || '',
      this.detailOssltResult(student),
      this.detailOssltTracking(student),
      detail?.ossltResult || '',
      detail?.ossltTracking || '',
      this.resolveArchiveStatusLabel(status),
      status,
      this.isCreateStudentSelectable(student.studentId) ? '可选 selectable' : '不可选 not selectable',
    ]
      .join(' ')
      .toLowerCase();
  }

  private scheduleTeacherNoteAutoSave(studentId: number): void {
    this.clearTeacherNoteAutoSaveTimer(studentId);
    const timer = setTimeout(() => {
      this.teacherNoteAutoSaveTimers.delete(studentId);
      this.saveTeacherNote(studentId);
    }, 700);
    this.teacherNoteAutoSaveTimers.set(studentId, timer);
  }

  private flushTeacherNoteAutoSave(studentId: number): void {
    this.clearTeacherNoteAutoSaveTimer(studentId);
    this.saveTeacherNote(studentId);
  }

  private clearTeacherNoteAutoSaveTimer(studentId: number): void {
    const timer = this.teacherNoteAutoSaveTimers.get(studentId);
    if (!timer) return;
    clearTimeout(timer);
    this.teacherNoteAutoSaveTimers.delete(studentId);
  }

  private clearAllTeacherNoteAutoSaveTimers(): void {
    for (const timer of this.teacherNoteAutoSaveTimers.values()) {
      clearTimeout(timer);
    }
    this.teacherNoteAutoSaveTimers.clear();
  }

  private ensureTeacherNoteProfileCached(studentId: number): void {
    if (this.teacherNoteProfileCache.has(studentId) || this.teacherNoteSaveInFlight.has(studentId)) {
      return;
    }

    this.studentProfile.getStudentProfileForTeacher(studentId).subscribe({
      next: (payload) => {
        this.teacherNoteProfileCache.set(studentId, payload);
      },
      error: () => {},
    });
  }

  private saveTeacherNote(studentId: number): void {
    if (this.teacherNoteSaveInFlight.has(studentId)) {
      return;
    }

    const noteText = String(this.studentDetails.get(studentId)?.teacherNote ?? '').trim();
    this.teacherNoteSaveInFlight.add(studentId);
    this.cdr.detectChanges();

    const cachedProfile = this.teacherNoteProfileCache.get(studentId);
    if (cachedProfile) {
      this.saveTeacherNoteWithProfile(studentId, cachedProfile, noteText);
      return;
    }

    this.studentProfile.getStudentProfileForTeacher(studentId).subscribe({
      next: (payload) => {
        this.teacherNoteProfileCache.set(studentId, payload);
        this.saveTeacherNoteWithProfile(studentId, payload, noteText);
      },
      error: () => {
        this.teacherNoteSaveInFlight.delete(studentId);
        this.cdr.detectChanges();
      },
    });
  }

  private saveTeacherNoteWithProfile(
    studentId: number,
    profilePayload: StudentProfilePayload | StudentProfileResponse | null | undefined,
    noteText: string
  ): void {
    const requestPayload = this.buildTeacherProfilePayloadWithNote(profilePayload, noteText);
    this.studentProfile
      .saveStudentProfileForTeacher(studentId, requestPayload)
      .pipe(
        finalize(() => {
          this.teacherNoteSaveInFlight.delete(studentId);
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (savedPayload) => {
          this.teacherNoteProfileCache.set(studentId, savedPayload);
          this.setTeacherNote(studentId, noteText);
          this.cdr.detectChanges();
        },
        error: () => {},
      });
  }

  private initializeCreateStudentVisibleColumns(): void {
    const defaults = this.buildCreateStudentDefaultVisibleColumnKeys();
    const defaultOrder = this.createStudentColumns.map((column) => column.key);
    const persisted = this.readCreateStudentVisibleColumnsPreference();
    this.createStudentColumnOrderKeys = defaultOrder;
    if (!persisted) {
      this.visibleCreateStudentColumnKeys = defaults;
      return;
    }

    if (Array.isArray(persisted.orderedColumnKeys) && persisted.orderedColumnKeys.length > 0) {
      this.createStudentColumnOrderKeys =
        this.normalizeCreateStudentColumnOrderKeys(persisted.orderedColumnKeys);
    }

    const normalized = normalizeVisibleColumnKeys(
      this.createStudentColumns,
      persisted.visibleColumnKeys || []
    );
    this.visibleCreateStudentColumnKeys = normalized.size > 0 ? normalized : defaults;
  }

  private buildCreateStudentDefaultVisibleColumnKeys(): Set<GoalStudentSelectorColumnKey> {
    const presetKeys = STUDENT_SELECTOR_DEFAULT_COLUMN_KEYS_BY_CONTEXT[this.selectorContext];
    return buildPresetVisibleColumnKeys(this.createStudentColumns, presetKeys);
  }

  private persistCreateStudentVisibleColumnsPreference(): void {
    try {
      const storage = (globalThis as { localStorage?: Storage }).localStorage;
      if (!storage) return;
      const payload: CreateStudentColumnPreferenceVm = {
        visibleColumnKeys: Array.from(this.visibleCreateStudentColumnKeys.values()),
        orderedColumnKeys: this.normalizeCreateStudentColumnOrderKeys(
          this.createStudentColumnOrderKeys
        ),
      };
      storage.setItem(
        this.resolveCreateStudentVisibleColumnsStorageKey(),
        JSON.stringify(payload)
      );
    } catch {}
  }

  private readCreateStudentVisibleColumnsPreference(): CreateStudentColumnPreferenceVm | null {
    try {
      const storage = (globalThis as { localStorage?: Storage }).localStorage;
      if (!storage) return null;
      const raw = storage.getItem(this.resolveCreateStudentVisibleColumnsStorageKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return {
          visibleColumnKeys: parsed
            .map((value) => String(value ?? '').trim())
            .filter(Boolean),
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

  private resolveCreateStudentVisibleColumnsStorageKey(): string {
    const session = this.auth.getSession();
    const teacherId = Number(session?.teacherId);
    if (Number.isFinite(teacherId) && teacherId > 0) {
      return `${GOAL_STUDENT_SELECTOR_COLUMN_PREFERENCE_STORAGE_KEY_PREFIX}.teacher-${Math.trunc(teacherId)}.${GOAL_STUDENT_SELECTOR_COLUMN_PREFERENCE_VERSION}`;
    }

    const userId = this.auth.getCurrentUserId();
    if (userId && userId > 0) {
      return `${GOAL_STUDENT_SELECTOR_COLUMN_PREFERENCE_STORAGE_KEY_PREFIX}.user-${Math.trunc(userId)}.${GOAL_STUDENT_SELECTOR_COLUMN_PREFERENCE_VERSION}`;
    }

    return `${GOAL_STUDENT_SELECTOR_COLUMN_PREFERENCE_STORAGE_KEY_PREFIX}.anonymous.${GOAL_STUDENT_SELECTOR_COLUMN_PREFERENCE_VERSION}`;
  }

  private loadCreateStudentVisibleColumnsPreferenceFromServer(): void {
    const authorization = this.auth.getAuthorizationHeaderValue();
    if (!authorization) return;

    this.teacherPreferenceApi
      .getPagePreference(GOAL_STUDENT_SELECTOR_COLUMN_PREFERENCE_PAGE_KEY)
      .subscribe({
        next: (payload) => {
          const remoteVersion = String(payload?.version ?? '').trim();
          if (remoteVersion !== GOAL_STUDENT_SELECTOR_COLUMN_PREFERENCE_VERSION) {
            this.syncCreateStudentVisibleColumnsPreferenceToServer();
            return;
          }

          const remoteOrderedKeys = Array.isArray(payload?.orderedColumnKeys)
            ? payload.orderedColumnKeys.map((key) => String(key ?? '').trim()).filter(Boolean)
            : [];
          const remoteKeys = Array.isArray(payload?.visibleColumnKeys)
            ? payload.visibleColumnKeys.map((key) => String(key ?? '').trim())
            : [];
          if (remoteOrderedKeys.length > 0) {
            this.createStudentColumnOrderKeys =
              this.normalizeCreateStudentColumnOrderKeys(remoteOrderedKeys);
          }
          if (remoteKeys.length > 0) {
            const normalized = normalizeVisibleColumnKeys(this.createStudentColumns, remoteKeys);
            if (normalized.size > 0) {
              this.visibleCreateStudentColumnKeys = normalized;
            }
          }
          this.persistCreateStudentVisibleColumnsPreference();
          this.loadMissingProfilesForVisibleRows();
          this.cdr.detectChanges();
        },
        error: () => {},
      });
  }

  private syncCreateStudentVisibleColumnsPreferenceToServer(): void {
    const authorization = this.auth.getAuthorizationHeaderValue();
    if (!authorization) return;

    this.teacherPreferenceApi
      .upsertPagePreference(GOAL_STUDENT_SELECTOR_COLUMN_PREFERENCE_PAGE_KEY, {
        version: GOAL_STUDENT_SELECTOR_COLUMN_PREFERENCE_VERSION,
        visibleColumnKeys: Array.from(this.visibleCreateStudentColumnKeys.values()),
        orderedColumnKeys: this.normalizeCreateStudentColumnOrderKeys(
          this.createStudentColumnOrderKeys
        ),
      })
      .subscribe({
        next: () => {},
        error: () => {},
      });
  }

  private initializeCreateStudentFiltersFromPreference(): void {
    const persisted = this.readCreateStudentFiltersPreference();
    if (!persisted) return;
    this.skipDependentFilterValidationOnce = true;

    const countrySource = String(
      persisted.countryFilterInput ?? persisted.countryFilter ?? ''
    ).trim();
    const resolvedCountry = countrySource
      ? this.resolveCountryFilterInputSelection(countrySource)
      : COUNTRY_FILTER_ALL_OPTION;
    this.createCountryFilter = resolvedCountry;
    this.createCountryFilterInput =
      resolvedCountry === COUNTRY_FILTER_ALL_OPTION ? '' : resolvedCountry;

    const provinceSource = String(
      persisted.provinceFilterInput ?? persisted.provinceFilter ?? ''
    ).trim();
    const resolvedProvince = provinceSource
      ? this.resolveProvinceFilterSelection(provinceSource, this.provinceFilterCountry)
      : '';
    this.createProvinceFilter = resolvedProvince;
    this.createProvinceFilterInput = resolvedProvince;

    const citySource = String(persisted.cityFilterInput ?? persisted.cityFilter ?? '').trim();
    const resolvedCity = citySource
      ? this.resolveCityFilterSelection(citySource, this.cityFilterCountry)
      : '';
    this.createCityFilter = resolvedCity;
    this.createCityFilterInput = resolvedCity;

    const schoolBoardSource = String(
      persisted.schoolBoardFilterInput ?? persisted.schoolBoardFilter ?? ''
    ).trim();
    const resolvedSchoolBoard = schoolBoardSource
      ? this.resolveSchoolBoardFilterSelection(schoolBoardSource)
      : COUNTRY_FILTER_ALL_OPTION;
    this.createSchoolBoardFilter = resolvedSchoolBoard;
    this.createSchoolBoardFilterInput =
      resolvedSchoolBoard === COUNTRY_FILTER_ALL_OPTION ? '' : resolvedSchoolBoard;

    const graduationSeasonSource = String(
      persisted.graduationSeasonFilterInput ?? persisted.graduationSeasonFilter ?? ''
    ).trim();
    const resolvedGraduationSeason = graduationSeasonSource
      ? this.resolveGraduationSeasonFilterSelection(graduationSeasonSource)
      : COUNTRY_FILTER_ALL_OPTION;
    this.createGraduationSeasonFilter = resolvedGraduationSeason;
    this.createGraduationSeasonFilterInput =
      resolvedGraduationSeason === COUNTRY_FILTER_ALL_OPTION ? '' : resolvedGraduationSeason;

    this.createLanguageScoreFilter = this.normalizeIeltsValue(
      persisted.languageScoreFilter
    ) || '';
    this.createLanguageTrackingFilter = this.normalizeLanguageTrackingValue(
      persisted.languageTrackingFilter
    ) || '';
    this.createLanguageCourseStatusFilter = this.normalizeLanguageCourseStatusValue(
      persisted.languageCourseStatusFilter
    ) || '';
    this.createOssltResultFilter = this.normalizeOssltResultValue(
      persisted.ossltResultFilter
    ) || '';
    this.createOssltTrackingFilter = this.normalizeOssltTrackingStatusValue(
      persisted.ossltTrackingFilter
    ) || '';
    this.createVolunteerCompletedFilter = this.normalizeVolunteerCompletedFilterValue(
      persisted.volunteerCompleted
    );
    this.createStudentKeyword = String(persisted.keyword ?? '').trim();
  }

  private persistCreateStudentFiltersPreference(): void {
    try {
      const storage = (globalThis as { localStorage?: Storage }).localStorage;
      if (!storage) return;
      const payload: CreateStudentFilterPreferenceVm = {
        countryFilterInput: this.createCountryFilterInput,
        countryFilter: this.createCountryFilter,
        provinceFilterInput: this.createProvinceFilterInput,
        provinceFilter: this.createProvinceFilter,
        cityFilterInput: this.createCityFilterInput,
        cityFilter: this.createCityFilter,
        schoolBoardFilterInput: this.createSchoolBoardFilterInput,
        schoolBoardFilter: this.createSchoolBoardFilter,
        graduationSeasonFilterInput: this.createGraduationSeasonFilterInput,
        graduationSeasonFilter: this.createGraduationSeasonFilter,
        languageScoreFilter: this.createLanguageScoreFilter,
        languageTrackingFilter: this.createLanguageTrackingFilter,
        languageCourseStatusFilter: this.createLanguageCourseStatusFilter,
        ossltResultFilter: this.createOssltResultFilter,
        ossltTrackingFilter: this.createOssltTrackingFilter,
        volunteerCompleted: this.createVolunteerCompletedFilter,
        keyword: this.createStudentKeyword,
      };
      storage.setItem(this.resolveCreateStudentFiltersStorageKey(), JSON.stringify(payload));
    } catch {}
  }

  private readCreateStudentFiltersPreference(): CreateStudentFilterPreferenceVm | null {
    try {
      const storage = (globalThis as { localStorage?: Storage }).localStorage;
      if (!storage) return null;
      const raw = storage.getItem(this.resolveCreateStudentFiltersStorageKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed as CreateStudentFilterPreferenceVm;
    } catch {
      return null;
    }
  }

  private resolveCreateStudentFiltersStorageKey(): string {
    const session = this.auth.getSession();
    const teacherId = Number(session?.teacherId);
    if (Number.isFinite(teacherId) && teacherId > 0) {
      return `${GOAL_STUDENT_SELECTOR_FILTER_PREFERENCE_STORAGE_KEY_PREFIX}.teacher-${Math.trunc(teacherId)}.${GOAL_STUDENT_SELECTOR_FILTER_PREFERENCE_VERSION}`;
    }

    const userId = this.auth.getCurrentUserId();
    if (userId && userId > 0) {
      return `${GOAL_STUDENT_SELECTOR_FILTER_PREFERENCE_STORAGE_KEY_PREFIX}.user-${Math.trunc(userId)}.${GOAL_STUDENT_SELECTOR_FILTER_PREFERENCE_VERSION}`;
    }

    return `${GOAL_STUDENT_SELECTOR_FILTER_PREFERENCE_STORAGE_KEY_PREFIX}.anonymous.${GOAL_STUDENT_SELECTOR_FILTER_PREFERENCE_VERSION}`;
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

  private extractErrorMessage(error: unknown): string {
    if (typeof error === 'string') return error;
    if (!error || typeof error !== 'object') return '';
    const obj = error as { name?: unknown; message?: unknown; error?: unknown; status?: unknown };
    if (String(obj.name || '').toLowerCase() === 'timeouterror') return '请求超时，请检查后端服务或网络连接。';
    if (obj.error && typeof obj.error === 'object') {
      const payload = obj.error as { message?: unknown; error?: unknown };
      if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();
      if (typeof payload.error === 'string' && payload.error.trim()) return payload.error.trim();
    }
    if (typeof obj.error === 'string' && obj.error.trim()) return obj.error.trim();
    if (typeof obj.message === 'string' && obj.message.trim()) return obj.message.trim();
    const status = Number(obj.status);
    if (Number.isFinite(status) && status > 0) return `请求失败（HTTP ${status}）。`;
    return '';
  }
}
