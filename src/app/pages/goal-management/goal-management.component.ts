import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { from, of } from 'rxjs';
import { catchError, concatMap, finalize, map, mergeMap, toArray } from 'rxjs/operators';

import {
  type AssignableStudentOptionVm,
  type CreateGoalRequestVm,
  type GoalTaskStatus,
  type GoalTaskVm,
  TaskCenterService,
} from '../../services/task-center.service';
import { type StudentAccount, StudentManagementService } from '../../services/student-management.service';
import {
  EDUCATION_BOARD_LIBRARY_OPTIONS,
  type StudentProfilePayload,
  type StudentProfileResponse,
  StudentProfileService,
} from '../../services/student-profile.service';

interface StudentDetailVm {
  email: string;
  phone: string;
  city: string;
  graduation: string;
  teacherNote: string;
  country: string;
  schoolBoard: string;
  graduationSeason: string;
}

const COUNTRY_FILTER_ALL_OPTION = 'All';
const COUNTRY_FILTER_NA_OPTION = 'N/A';
const COUNTRY_FILTER_PRIORITY_OPTIONS = ['Canada', 'China (mainland)', 'United States'] as const;
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
] as const;

@Component({
  selector: 'app-goal-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './goal-management.component.html',
  styleUrl: './goal-management.component.scss',
})
export class GoalManagementComponent implements OnInit, OnDestroy {
  studentOptions: AssignableStudentOptionVm[] = [];
  studentsLoading = false;
  studentsError = '';
  private readonly studentDetails = new Map<number, StudentDetailVm>();
  private readonly profileLoadInFlight = new Set<number>();
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
  createSchoolBoardFilterInput = '';
  createSchoolBoardFilter = COUNTRY_FILTER_ALL_OPTION;
  createGraduationSeasonFilterInput = '';
  createGraduationSeasonFilter = COUNTRY_FILTER_ALL_OPTION;

  goals: GoalTaskVm[] = [];
  goalsLoading = false;
  goalsError = '';
  filterStudentId: number | null = null;
  filterStatus: GoalTaskStatus | 'ALL' = 'ALL';
  filterKeyword = '';

  createPanelExpanded = false;
  studentPanelExpanded = false;
  createStudentKeyword = '';
  selectedCreateStudentIds = new Set<number>();
  createTitle = '';
  createDescription = '';
  createDueAt = '';
  creating = false;
  createError = '';
  createSuccess = '';

  selectedGoalId: number | null = null;
  updatingGoalId: number | null = null;
  updateError = '';

  constructor(
    private taskCenter: TaskCenterService,
    private studentManagement: StudentManagementService,
    private studentProfile: StudentProfileService,
    private router: Router,
    private cdr: ChangeDetectorRef = { detectChanges: () => {} } as ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAssignableStudents();
    this.loadGoals();
  }

  ngOnDestroy(): void {
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

  goDashboard(): void { this.router.navigate(['/teacher/dashboard']); }
  toggleCreatePanel(): void { this.createPanelExpanded = !this.createPanelExpanded; if (!this.createPanelExpanded) this.studentPanelExpanded = false; }
  toggleStudentPanel(): void { this.studentPanelExpanded = !this.studentPanelExpanded; if (this.studentPanelExpanded) this.loadMissingProfilesForVisibleRows(); }
  onStudentKeywordChange(): void { this.loadMissingProfilesForVisibleRows(); }
  onCountryFilterInputChange(value: string): void {
    const input = String(value ?? '').trim();
    this.createCountryFilterInput = input;
    this.createCountryFilter = input
      ? this.resolveCountryFilterInputSelection(input)
      : COUNTRY_FILTER_ALL_OPTION;
    this.syncSchoolBoardFilterSelection();
    this.syncGraduationSeasonFilterSelection();
    this.loadMissingProfilesForVisibleRows();
  }
  onSchoolBoardFilterInputChange(value: string): void {
    const input = String(value ?? '').trim();
    this.createSchoolBoardFilterInput = input;
    this.createSchoolBoardFilter = input
      ? this.resolveSchoolBoardFilterSelection(input)
      : COUNTRY_FILTER_ALL_OPTION;
    this.syncGraduationSeasonFilterSelection();
    this.loadMissingProfilesForVisibleRows();
  }
  onGraduationSeasonFilterInputChange(value: string): void {
    const input = String(value ?? '').trim();
    this.createGraduationSeasonFilterInput = input;
    this.createGraduationSeasonFilter = input
      ? this.resolveGraduationSeasonFilterSelection(input)
      : COUNTRY_FILTER_ALL_OPTION;
    this.loadMissingProfilesForVisibleRows();
  }
  refreshAssignableStudents(): void { this.loadAssignableStudents(); }
  refreshGoals(): void { this.loadGoals(); }
  applyFilters(): void { this.loadGoals(); }
  clearFilters(): void { this.filterStudentId = null; this.filterStatus = 'ALL'; this.filterKeyword = ''; this.loadGoals(); }

  resetStudentMetaFilters(): void {
    this.createCountryFilterInput = '';
    this.createCountryFilter = COUNTRY_FILTER_ALL_OPTION;
    this.createSchoolBoardFilterInput = '';
    this.createSchoolBoardFilter = COUNTRY_FILTER_ALL_OPTION;
    this.createGraduationSeasonFilterInput = '';
    this.createGraduationSeasonFilter = COUNTRY_FILTER_ALL_OPTION;
    this.createStudentKeyword = '';
    this.loadMissingProfilesForVisibleRows();
  }

  resetCreateForm(): void {
    this.studentPanelExpanded = false;
    this.resetStudentMetaFilters();
    this.clearAllTeacherNoteAutoSaveTimers();
    this.selectedCreateStudentIds.clear();
    this.createTitle = '';
    this.createDescription = '';
    this.createDueAt = '';
    this.createError = '';
    this.createSuccess = '';
  }

  onCreateStudentCheckboxChange(studentId: number, event: Event): void {
    event.stopPropagation();
    if (this.creating) return;
    const checked = (event.target as HTMLInputElement | null)?.checked === true;
    if (checked) this.selectedCreateStudentIds.add(studentId);
    else this.selectedCreateStudentIds.delete(studentId);
  }

  clearSelectedStudents(): void {
    if (this.creating) return;
    this.selectedCreateStudentIds.clear();
  }

  onToggleSelectAll(event: Event): void {
    if (this.creating) return;
    const checked = (event.target as HTMLInputElement | null)?.checked === true;
    for (const row of this.filteredCreateStudentOptions) {
      if (checked) this.selectedCreateStudentIds.add(row.studentId);
      else this.selectedCreateStudentIds.delete(row.studentId);
    }
  }

  isCreateStudentSelected(studentId: number): boolean { return this.selectedCreateStudentIds.has(studentId); }
  areAllVisibleStudentsSelected(): boolean {
    const rows = this.filteredCreateStudentOptions;
    return rows.length > 0 && rows.every((row) => this.selectedCreateStudentIds.has(row.studentId));
  }
  isVisibleStudentSelectionPartial(): boolean {
    const rows = this.filteredCreateStudentOptions;
    if (rows.length === 0) return false;
    const selectedCount = rows.filter((row) => this.selectedCreateStudentIds.has(row.studentId)).length;
    return selectedCount > 0 && selectedCount < rows.length;
  }
  isSelectedStudentOutOfCurrentFilter(student: AssignableStudentOptionVm): boolean {
    return !this.matchesCreateStudentFilters(student, this.createStudentKeyword.trim().toLowerCase());
  }

  detailCity(studentId: number): string { return this.studentDetails.get(studentId)?.city || '-'; }
  detailSchoolBoard(studentId: number): string { return this.studentDetails.get(studentId)?.schoolBoard || '-'; }
  detailGraduation(studentId: number): string { return this.studentDetails.get(studentId)?.graduation || '-'; }
  detailTeacherNote(studentId: number): string { return this.studentDetails.get(studentId)?.teacherNote || ''; }
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
    const selectedIds = Array.from(this.selectedCreateStudentIds.values()).sort((a, b) => a - b);
    if (selectedIds.length === 0) {
      this.studentPanelExpanded = true;
      this.createError = '请至少选择 1 位学生。';
      this.createSuccess = '';
      return;
    }
    const title = this.createTitle.trim();
    if (!title) { this.createError = '请填写 Goal 标题。'; this.createSuccess = ''; return; }
    const description = this.createDescription.trim();
    if (!description) { this.createError = '请填写 Goal 描述。'; this.createSuccess = ''; return; }

    this.creating = true;
    this.createError = '';
    this.createSuccess = '';
    this.cdr.detectChanges();
    const baseRequest = { title, description, dueAt: this.createDueAt.trim() || null };

    from(selectedIds).pipe(
      concatMap((studentId) => this.taskCenter.createGoal({ ...(baseRequest as Omit<CreateGoalRequestVm, 'studentId'>), studentId })),
      toArray(),
      finalize(() => { this.creating = false; this.cdr.detectChanges(); })
    ).subscribe({
      next: (rows) => {
        const first = rows[0];
        if (first) this.selectedGoalId = first.id;
        this.createSuccess = rows.length === 1 ? `Goal 已创建：#${first?.id || ''} ${first?.title || ''}`.trim() : `Goal 已为 ${rows.length} 位学生发布。`;
        this.createTitle = '';
        this.createDescription = '';
        this.createDueAt = '';
        this.resetStudentMetaFilters();
        this.selectedCreateStudentIds.clear();
        this.loadGoals();
      },
      error: (error: unknown) => { this.createError = this.extractErrorMessage(error) || '发布 Goal 失败。'; this.cdr.detectChanges(); },
    });
  }

  selectGoal(goal: GoalTaskVm): void { this.selectedGoalId = goal.id; this.updateError = ''; }

  setGoalStatus(goal: GoalTaskVm, status: GoalTaskStatus): void {
    if (this.updatingGoalId !== null) return;
    this.updatingGoalId = goal.id;
    this.updateError = '';
    this.cdr.detectChanges();
    this.taskCenter.updateTeacherGoalStatus(goal.id, {
      status,
      progressNote: status === 'COMPLETED' ? '老师已在 Goal 管理页标记完成。' : goal.progressNote,
    }).pipe(finalize(() => { this.updatingGoalId = null; this.cdr.detectChanges(); }))
      .subscribe({
        next: (updated) => { this.goals = this.sortGoals(this.goals.map((row) => (row.id === updated.id ? updated : row))); this.selectedGoalId = updated.id; this.cdr.detectChanges(); },
        error: (error: unknown) => { this.updateError = this.extractErrorMessage(error) || '更新 Goal 状态失败。'; this.cdr.detectChanges(); },
      });
  }

  trackStudent = (_: number, student: AssignableStudentOptionVm): number => student.studentId;
  trackGoal = (_: number, goal: GoalTaskVm): number => goal.id;
  goalStatusLabel(status: GoalTaskStatus): string { if (status === 'NOT_STARTED') return '未开始'; if (status === 'IN_PROGRESS') return '进行中'; return '已完成'; }
  displayDueAt(goal: GoalTaskVm): string { if (!goal.dueAt) return '无截止日期'; const ts = Date.parse(goal.dueAt); return Number.isFinite(ts) ? new Date(ts).toLocaleDateString() : goal.dueAt; }
  displayUpdatedAt(value: string): string { const ts = Date.parse(value); return Number.isFinite(ts) ? new Date(ts).toLocaleString() : value; }

  private loadAssignableStudents(): void {
    this.studentsLoading = true;
    this.studentsError = '';
    this.taskCenter.listAssignableStudents().pipe(finalize(() => { this.studentsLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (rows) => { this.studentOptions = [...rows].sort((a, b) => a.studentId - b.studentId); this.syncSelectedStudents(); this.pruneStudentDetails(); this.hydrateStudentDetailsFromAccounts(); this.loadMissingProfilesForVisibleRows(); this.cdr.detectChanges(); },
        error: (error: unknown) => { this.studentsError = this.extractErrorMessage(error) || '加载学生列表失败。'; this.studentOptions = []; this.selectedCreateStudentIds.clear(); this.studentDetails.clear(); this.rebuildMetaFilterOptions(); this.cdr.detectChanges(); },
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
      const hasCore = !!(d && d.country && d.city && d.schoolBoard && d.graduation);
      return !this.profileLoadInFlight.has(studentId) && !hasCore;
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
        error: (error: unknown) => { this.goalsError = this.extractErrorMessage(error) || '加载 Goal 列表失败。'; this.goals = []; this.selectedGoalId = null; this.cdr.detectChanges(); },
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

  private upsertDetail(studentId: number, patch: Partial<StudentDetailVm>): void {
    const current = this.studentDetails.get(studentId) || { email: '', phone: '', city: '', graduation: '', teacherNote: '', country: '', schoolBoard: '', graduationSeason: '' };
    const graduation = patch.graduation?.trim() || current.graduation;
    const graduationSeason = patch.graduationSeason?.trim() || this.resolveGraduationSeason(graduation);
    this.studentDetails.set(studentId, {
      email: patch.email?.trim() || current.email,
      phone: patch.phone?.trim() || current.phone,
      city: patch.city?.trim() || current.city,
      graduation,
      teacherNote: patch.teacherNote?.trim() || current.teacherNote,
      country: patch.country?.trim() || current.country,
      schoolBoard: patch.schoolBoard?.trim() || current.schoolBoard,
      graduationSeason,
    });
  }

  private setTeacherNote(studentId: number, noteText: string): void {
    const current = this.studentDetails.get(studentId) || {
      email: '',
      phone: '',
      city: '',
      graduation: '',
      teacherNote: '',
      country: '',
      schoolBoard: '',
      graduationSeason: '',
    };
    this.studentDetails.set(studentId, {
      ...current,
      teacherNote: String(noteText ?? ''),
    });
  }

  private buildFromAccount(student: StudentAccount): Partial<StudentDetailVm> {
    const profile = student?.['profile'] && typeof student['profile'] === 'object' ? (student['profile'] as Record<string, unknown>) : {};
    const graduation = this.formatGraduation(this.pick([
      student['currentSchoolExpectedGraduation'], student['expectedGraduationTime'], student['expectedGraduationDate'],
      profile['currentSchoolExpectedGraduation'], profile['expectedGraduationTime'], profile['expectedGraduationDate'],
    ]));
    return {
      email: this.pick([student.email, student['emailAddress'], student['contactEmail'], profile['email']]),
      phone: this.pick([student.phone, student['phoneNumber'], student['mobile'], profile['phone']]),
      city: this.pick([student['currentSchoolCity'], student['schoolCity'], student['city'], profile['currentSchoolCity'], profile['city']]),
      graduation,
      teacherNote: this.pick([student['teacherNote'], student['teacherNotes'], profile['teacherNote']]),
      country: this.pick([student['currentSchoolCountry'], student['schoolCountry'], student['country'], profile['currentSchoolCountry'], profile['country']]),
      schoolBoard: this.pick([student['currentSchoolBoard'], student['schoolBoard'], student['educationBoard'], profile['currentSchoolBoard'], profile['schoolBoard'], profile['educationBoard']]),
      graduationSeason: this.resolveGraduationSeason(graduation),
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
      city: this.pick([profile['currentSchoolCity'], profile['city'], school['city'], root['currentSchoolCity']]),
      graduation,
      teacherNote: this.pick([profile['teacherNote'], profile['teacherNotes'], root['teacherNote']]),
      country: this.pick([profile['currentSchoolCountry'], profile['country'], school['country'], root['currentSchoolCountry']]),
      schoolBoard: this.pick([profile['currentSchoolBoard'], profile['schoolBoard'], profile['educationBoard'], school['schoolBoard'], school['educationBoard'], root['currentSchoolBoard']]),
      graduationSeason: this.resolveGraduationSeason(graduation),
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
    this.syncSchoolBoardFilterSelection();
    this.syncGraduationSeasonFilterSelection();
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

  private matchesCreateStudentFilters(
    student: AssignableStudentOptionVm,
    keyword: string
  ): boolean {
    const detail = this.studentDetails.get(student.studentId);
    if (!this.matchesCountryFilter(detail)) return false;
    if (!this.matchesSchoolBoardFilter(detail)) return false;
    if (!this.matchesGraduationSeasonFilter(detail)) return false;
    if (!keyword) return true;

    return this.buildCreateStudentSearchText(student, detail).includes(keyword);
  }

  private buildCreateStudentSearchText(
    student: AssignableStudentOptionVm,
    detail: StudentDetailVm | undefined
  ): string {
    return [
      student.studentName,
      student.username || '',
      detail?.email || '',
      detail?.phone || '',
      detail?.city || '',
      detail?.graduation || '',
      detail?.teacherNote || '',
      detail?.country || '',
      detail?.schoolBoard || '',
      detail?.graduationSeason || '',
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
