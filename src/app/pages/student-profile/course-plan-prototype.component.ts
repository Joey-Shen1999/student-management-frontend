import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../services/auth.service';
import {
  CoursePlanCoursePayload,
  CoursePlanPayload,
  CoursePlanSemester,
  CoursePlanService,
  CoursePlanStatus,
  CoursePlanYearStructure,
} from '../../services/course-plan.service';
import { CourseCatalogEntry, COURSE_PLAN_CATALOG } from './course-plan-course-catalog';

type CourseStatus = CoursePlanStatus;
type YearStructure = CoursePlanYearStructure;
type SemesterSlot = CoursePlanSemester;

interface CourseDraft {
  id: string;
  status: CourseStatus;
  courseCode: string;
  mark: string;
  semester: SemesterSlot;
  sortOrder: number;
}

interface GradePlanDraft {
  id: number;
  level: number;
  yearStructure: YearStructure;
  courses: CourseDraft[];
}

interface DragState {
  courseId: string;
  sourceGradeId: number;
}

@Component({
  selector: 'app-course-plan-prototype',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './course-plan-prototype.component.html',
  styleUrl: './course-plan-prototype.component.scss',
})
export class CoursePlanPrototypeComponent implements OnInit, OnDestroy {
  readonly statusOrder: readonly CourseStatus[] = ['COMPLETED', 'IN_PROGRESS', 'PLANNED'];
  readonly yearStructureOrder: readonly YearStructure[] = ['SEMESTER', 'FULL_YEAR'];
  readonly courseCatalog = COURSE_PLAN_CATALOG;

  managedMode = false;
  studentId = 0;

  loading = false;
  saving = false;
  error = '';
  savedMessage = '';

  draggingCourseId: string | null = null;
  activeSuggestionCourseId: string | null = null;
  highlightedSuggestionIndex = 0;
  showGrade13 = false;
  manualCurrentGradeLevel: number | null = null;

  grades: GradePlanDraft[] = this.buildEmptyScaffold();

  private nextLocalCourseSeed = 1;
  private dragState: DragState | null = null;
  private suggestionCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly autoSaveDelayMs = 700;
  private lastSavedPayloadDigest = '';
  private pendingAutoSave = false;
  private routeSub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private auth: AuthService,
    private coursePlanApi: CoursePlanService,
    private cdr: ChangeDetectorRef = { detectChanges: () => {} } as ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe((params) => {
      this.applyRouteContext(params);
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.clearCourseSuggestionCloseTimer();
    this.clearAutoSaveTimer();
  }

  get visibleGrades(): GradePlanDraft[] {
    return this.showGrade13 ? this.grades : this.grades.filter((grade) => grade.level !== 13);
  }

  get effectiveCurrentGradeLevel(): number {
    const level =
      this.manualCurrentGradeLevel !== null ? this.manualCurrentGradeLevel : this.inferCurrentGradeLevel();
    return this.clampToVisibleGrade(level);
  }

  gridTemplateColumns(): string {
    return `repeat(${this.visibleGrades.length}, minmax(240px, 1fr))`;
  }

  get autoSaveLabel(): string {
    if (this.saving) return 'Auto-saving...';
    if (this.autoSaveTimer !== null) return 'Unsaved changes...';
    if (this.error && !this.loading) return 'Auto-save failed';
    if (this.savedMessage) return this.savedMessage;
    return 'Auto-save on';
  }

  countGradeCourses(grade: GradePlanDraft): number {
    return grade.courses.length;
  }

  refresh(): void {
    this.clearAutoSaveTimer();
    this.pendingAutoSave = false;
    this.loadState();
  }

  save(): void {
    this.clearAutoSaveTimer();
    this.persistCoursePlan({ force: true, successMessage: 'Course plan saved.' });
  }

  private persistCoursePlan(options: { force?: boolean; successMessage?: string } = {}): void {
    if (!this.studentId || this.loading) return;

    const payload = this.buildPayloadForSave();
    const payloadDigest = this.createPayloadDigest(payload);
    if (!options.force && payloadDigest === this.lastSavedPayloadDigest) {
      this.savedMessage = '';
      return;
    }

    if (this.saving) {
      this.pendingAutoSave = true;
      return;
    }

    this.saving = true;
    this.error = '';
    this.savedMessage = '';
    this.cdr.detectChanges();

    const request$ = this.managedMode
      ? this.coursePlanApi.saveTeacherStudentCoursePlan(this.studentId, payload)
      : this.coursePlanApi.saveStudentCoursePlan(payload);

    request$
      .pipe(
        finalize(() => {
          this.saving = false;
          if (this.pendingAutoSave) {
            this.pendingAutoSave = false;
            this.scheduleAutoSave(0);
          }
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (savedPayload) => {
          const currentDigest = this.createPayloadDigest(this.buildPayloadForSave());
          if (currentDigest === payloadDigest) {
            this.applyPayload(savedPayload || payload);
            this.updateLastSavedPayloadDigest();
            this.savedMessage = options.successMessage || 'Saved automatically.';
          } else {
            this.lastSavedPayloadDigest = payloadDigest;
            this.pendingAutoSave = true;
          }
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.error = this.extractErrorMessage(error, 'Failed to save course plan.');
          this.cdr.detectChanges();
        },
      });
  }

  toggleGrade13(): void {
    this.showGrade13 = !this.showGrade13;
    if (!this.showGrade13 && this.manualCurrentGradeLevel === 13) {
      this.manualCurrentGradeLevel = null;
    }
    this.savedMessage = '';
    this.ensureSemesterAssignmentsForCurrentGrade();
    this.markCoursePlanDirty();
  }

  toggleManualCurrentGrade(level: number): void {
    this.manualCurrentGradeLevel = this.manualCurrentGradeLevel === level ? null : level;
    this.savedMessage = '';
    this.ensureSemesterAssignmentsForCurrentGrade();
    this.markCoursePlanDirty();
  }

  addCourse(gradeId: number): void {
    const grade = this.grades.find((item) => item.id === gradeId);
    if (!grade) return;
    const status = this.defaultStatusForGrade(grade.level);
    grade.courses.push(
      this.createCourse(
        grade.level,
        status,
        '',
        '',
        this.defaultSemesterForGrade(grade, status),
        grade.courses.length
      )
    );
    this.savedMessage = '';
    this.markCoursePlanDirty();
  }

  removeCourse(gradeId: number, courseId: string): void {
    const grade = this.grades.find((item) => item.id === gradeId);
    if (!grade) return;
    grade.courses = grade.courses.filter((course) => course.id !== courseId);
    this.reindexGradeCourses(grade);
    this.savedMessage = '';
    if (this.activeSuggestionCourseId === courseId) {
      this.closeCourseSuggestions();
    }
    this.markCoursePlanDirty();
  }

  setCourseStatus(course: CourseDraft, status: CourseStatus): void {
    if (course.status === status) return;
    course.status = status;
    if (status === 'PLANNED') {
      course.mark = '';
    }
    this.savedMessage = '';
    this.markCoursePlanDirty();
  }

  setYearStructure(grade: GradePlanDraft, yearStructure: YearStructure): void {
    if (grade.yearStructure === yearStructure) return;
    grade.yearStructure = yearStructure;
    if (yearStructure === 'FULL_YEAR') {
      grade.courses.forEach((course) => {
        course.semester = null;
      });
      this.savedMessage = '';
      this.markCoursePlanDirty();
      return;
    }

    if (this.isCurrentGrade(grade)) {
      this.assignSemesterSlots(grade);
    }
    this.savedMessage = '';
    this.markCoursePlanDirty();
  }

  isCurrentGrade(grade: GradePlanDraft): boolean {
    return grade.level === this.effectiveCurrentGradeLevel;
  }

  isManualCurrentGrade(grade: GradePlanDraft): boolean {
    return grade.level === this.manualCurrentGradeLevel;
  }

  isSemesterSplit(grade: GradePlanDraft): boolean {
    return this.isCurrentGrade(grade) && grade.yearStructure === 'SEMESTER';
  }

  semesterCourses(grade: GradePlanDraft, semester: Exclude<SemesterSlot, null>): CourseDraft[] {
    return grade.courses.filter((course) => course.semester === semester);
  }

  courseSuggestions(grade: GradePlanDraft, course: CourseDraft): CourseCatalogEntry[] {
    const query = this.normalizeSuggestionQuery(course.courseCode);

    return this.courseCatalog
      .filter((entry) => this.matchesSuggestionQuery(entry, query))
      .map((entry) => ({
        entry,
        score: this.scoreSuggestion(entry, grade.level, query),
      }))
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return left.entry.code.localeCompare(right.entry.code);
      })
      .slice(0, 8)
      .map((item) => item.entry);
  }

  emptyCopyForGrade(grade: GradePlanDraft): string {
    return `Start adding Grade ${grade.level} courses here.`;
  }

  openCourseSuggestions(courseId: string): void {
    this.clearCourseSuggestionCloseTimer();
    if (this.activeSuggestionCourseId !== courseId) {
      this.highlightedSuggestionIndex = 0;
    }
    this.activeSuggestionCourseId = courseId;
  }

  scheduleCourseSuggestionsClose(): void {
    this.clearCourseSuggestionCloseTimer();
    this.suggestionCloseTimer = setTimeout(() => this.closeCourseSuggestions(), 120);
  }

  closeCourseSuggestions(): void {
    this.clearCourseSuggestionCloseTimer();
    this.activeSuggestionCourseId = null;
    this.highlightedSuggestionIndex = 0;
  }

  isCourseSuggestionOpen(course: CourseDraft): boolean {
    return this.activeSuggestionCourseId === course.id;
  }

  onCourseCodeInput(course: CourseDraft): void {
    this.openCourseSuggestions(course.id);
    this.highlightedSuggestionIndex = 0;
    this.savedMessage = '';
    this.markCoursePlanDirty();
  }

  onCourseMarkInput(): void {
    this.savedMessage = '';
    this.markCoursePlanDirty();
  }

  onCourseCodeKeydown(event: KeyboardEvent, grade: GradePlanDraft, course: CourseDraft): void {
    const suggestions = this.courseSuggestions(grade, course);
    const isOpen = this.isCourseSuggestionOpen(course);

    if (event.key === 'Escape') {
      this.closeCourseSuggestions();
      return;
    }

    if (!suggestions.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.openCourseSuggestions(course.id);
      this.highlightedSuggestionIndex = isOpen
        ? Math.min(this.highlightedSuggestionIndex + 1, suggestions.length - 1)
        : 0;
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.openCourseSuggestions(course.id);
      this.highlightedSuggestionIndex = isOpen
        ? Math.max(this.highlightedSuggestionIndex - 1, 0)
        : suggestions.length - 1;
      return;
    }

    if (event.key === 'Enter' && this.isCourseSuggestionOpen(course)) {
      event.preventDefault();
      this.applyCourseSuggestion(course, suggestions[this.highlightedSuggestionIndex] ?? suggestions[0]);
    }
  }

  selectCourseSuggestion(
    event: MouseEvent,
    course: CourseDraft,
    suggestion: CourseCatalogEntry
  ): void {
    event.preventDefault();
    this.applyCourseSuggestion(course, suggestion);
  }

  startCourseDrag(event: DragEvent, gradeId: number, courseId: string): void {
    this.dragState = { sourceGradeId: gradeId, courseId };
    this.draggingCourseId = courseId;
    const payload = JSON.stringify(this.dragState);
    event.dataTransfer?.setData('application/json', payload);
    event.dataTransfer?.setData('text/plain', payload);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  endCourseDrag(): void {
    this.dragState = null;
    this.draggingCourseId = null;
  }

  allowCourseDrop(event: DragEvent): void {
    event.preventDefault();
  }

  dropCourse(event: DragEvent, targetGradeId: number, targetSemester: SemesterSlot): void {
    event.preventDefault();
    const dragState = this.dragState ?? this.parseDragState(event);
    if (!dragState) return;

    const sourceGrade = this.grades.find((grade) => grade.id === dragState.sourceGradeId);
    const targetGrade = this.grades.find((grade) => grade.id === targetGradeId);
    if (!sourceGrade || !targetGrade) {
      this.endCourseDrag();
      return;
    }

    const courseIndex = sourceGrade.courses.findIndex((course) => course.id === dragState.courseId);
    if (courseIndex === -1) {
      this.endCourseDrag();
      return;
    }

    const course = sourceGrade.courses[courseIndex];
    const resolvedSemester = this.resolveDropSemester(targetGrade, targetSemester, course.status);
    if (sourceGrade.id === targetGrade.id && course.semester === resolvedSemester) {
      this.endCourseDrag();
      return;
    }

    sourceGrade.courses.splice(courseIndex, 1);
    this.reindexGradeCourses(sourceGrade);
    course.semester = resolvedSemester;
    targetGrade.courses.push(course);
    this.reindexGradeCourses(targetGrade);
    this.savedMessage = '';
    this.endCourseDrag();
    this.markCoursePlanDirty();
  }

  trackGrade = (_index: number, grade: GradePlanDraft): number => grade.id;
  trackStatus = (_index: number, status: CourseStatus): CourseStatus => status;
  trackCourse = (_index: number, course: CourseDraft): string => course.id;
  trackSuggestion = (_index: number, suggestion: CourseCatalogEntry): string => suggestion.code;

  statusLabel(status: CourseStatus): string {
    if (status === 'COMPLETED') return 'Done';
    if (status === 'IN_PROGRESS') return 'Doing';
    return 'Plan';
  }

  yearStructureLabel(yearStructure: YearStructure): string {
    return yearStructure === 'SEMESTER' ? 'Semester' : 'Full Year';
  }

  semesterLabel(semester: Exclude<SemesterSlot, null>): string {
    return semester === 'S1' ? 'Semester 1' : 'Semester 2';
  }

  statusClass(status: CourseStatus): string {
    if (status === 'COMPLETED') return 'completed';
    if (status === 'IN_PROGRESS') return 'in-progress';
    return 'planned';
  }

  private loadState(): void {
    if (!this.studentId) return;

    this.loading = true;
    this.error = '';
    this.savedMessage = '';
    this.cdr.detectChanges();

    const request$ = this.managedMode
      ? this.coursePlanApi.getTeacherStudentCoursePlan(this.studentId)
      : this.coursePlanApi.getStudentCoursePlan();

    request$
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (payload) => {
          this.applyPayload(payload);
          this.updateLastSavedPayloadDigest();
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.error = this.extractErrorMessage(error, 'Failed to load course plan.');
          this.cdr.detectChanges();
        },
      });
  }

  private applyPayload(payload: CoursePlanPayload | null | undefined): void {
    const normalized = this.normalizePayload(payload);
    this.showGrade13 = normalized.grade13Enabled;
    this.manualCurrentGradeLevel =
      !normalized.grade13Enabled && normalized.currentGradeLevel === 13
        ? null
        : normalized.currentGradeLevel;
    this.grades = normalized.grades;
    this.closeCourseSuggestions();
    this.endCourseDrag();
    this.ensureSemesterAssignmentsForCurrentGrade();
  }

  private normalizePayload(payload: CoursePlanPayload | null | undefined): {
    currentGradeLevel: number | null;
    grade13Enabled: boolean;
    grades: GradePlanDraft[];
  } {
    const levels: readonly number[] = [9, 10, 11, 12, 13];
    const gradeMap = new Map<number, GradePlanDraft>();

    for (const grade of payload?.grades || []) {
      const normalizedGrade = this.normalizeGrade(grade);
      if (!normalizedGrade) continue;
      gradeMap.set(normalizedGrade.level, normalizedGrade);
    }

    const grades = levels.map((level) => {
      const found = gradeMap.get(level);
      if (found) return found;
      return this.createGrade(level, 'FULL_YEAR', []);
    });

    const grade13 = gradeMap.get(13);
    const hasGrade13Data = !!grade13 && grade13.courses.length > 0;
    const grade13Enabled = !!payload?.grade13Enabled || hasGrade13Data;

    const currentGradeLevel = this.normalizeCurrentGradeLevel(payload?.currentGradeLevel);
    return { currentGradeLevel, grade13Enabled, grades };
  }

  private normalizeGrade(grade: CoursePlanPayload['grades'][number] | null | undefined): GradePlanDraft | null {
    const level = Number(grade?.gradeLevel);
    if (!Number.isFinite(level)) return null;
    const normalizedLevel = Math.trunc(level);
    if (normalizedLevel < 9 || normalizedLevel > 13) return null;

    const yearStructure: YearStructure = grade?.yearStructure === 'SEMESTER' ? 'SEMESTER' : 'FULL_YEAR';
    const rows = Array.isArray(grade?.courses) ? grade.courses : [];
    const courses = rows
      .map((row, index) => this.normalizeCourse(row, normalizedLevel, yearStructure, index))
      .filter((row): row is CourseDraft => row !== null)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((course, index) => ({
        ...course,
        sortOrder: index,
      }));

    return this.createGrade(normalizedLevel, yearStructure, courses);
  }

  private normalizeCourse(
    course: CoursePlanCoursePayload | null | undefined,
    gradeLevel: number,
    yearStructure: YearStructure,
    fallbackSortOrder: number
  ): CourseDraft | null {
    if (!course || typeof course !== 'object') return null;

    const status = this.normalizeStatus(course.status);
    const normalizedId = this.normalizeCourseId(course.id, gradeLevel);
    const normalizedCode = this.trimCourseCode(course.courseCode);
    const normalizedSortOrder = this.normalizeSortOrder(course.sortOrder, fallbackSortOrder);
    const normalizedMark = status === 'PLANNED' ? '' : this.normalizeMarkText(course.mark);
    const normalizedSemester =
      yearStructure === 'FULL_YEAR' ? null : this.normalizeSemester(course.semester);

    return {
      id: normalizedId,
      status,
      courseCode: normalizedCode,
      mark: normalizedMark,
      semester: normalizedSemester,
      sortOrder: normalizedSortOrder,
    };
  }

  private buildPayloadForSave(): CoursePlanPayload {
    const gradeLevels: readonly number[] = [9, 10, 11, 12];
    const shouldIncludeGrade13 = this.showGrade13;
    const payloadGrades = this.grades
      .filter((grade) => {
        if (gradeLevels.includes(grade.level)) return true;
        return shouldIncludeGrade13 && grade.level === 13;
      })
      .map((grade) => this.buildGradePayload(grade));

    return {
      currentGradeLevel: this.normalizeCurrentGradeLevel(this.manualCurrentGradeLevel),
      grade13Enabled: this.showGrade13,
      grades: payloadGrades,
    };
  }

  private buildGradePayload(grade: GradePlanDraft): CoursePlanPayload['grades'][number] {
    return {
      gradeLevel: grade.level,
      yearStructure: grade.yearStructure,
      courses: grade.courses.map((course, index) => this.buildCoursePayload(grade, course, index)),
    };
  }

  private buildCoursePayload(
    grade: GradePlanDraft,
    course: CourseDraft,
    sortOrder: number
  ): CoursePlanCoursePayload {
    const status = this.normalizeStatus(course.status);
    return {
      id: this.normalizeCourseId(course.id, grade.level),
      courseCode: this.trimCourseCode(course.courseCode),
      status,
      mark: this.normalizeMarkForSave(course.mark, status),
      semester: grade.yearStructure === 'FULL_YEAR' ? null : this.normalizeSemester(course.semester),
      sortOrder,
    };
  }

  private applyRouteContext(params: ParamMap): void {
    const routeStudentId = params.get('studentId');
    if (routeStudentId !== null) {
      const parsed = Number(routeStudentId);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        this.loading = false;
        this.error = 'Invalid student id in route.';
        this.studentId = 0;
        this.cdr.detectChanges();
        return;
      }

      this.managedMode = true;
      this.studentId = Math.trunc(parsed);
      this.loadState();
      return;
    }

    this.managedMode = false;
    const sessionStudentId = Number(this.auth.getSession()?.studentId);
    if (!Number.isFinite(sessionStudentId) || sessionStudentId <= 0) {
      this.loading = false;
      this.error = 'Current student id is missing from session.';
      this.studentId = 0;
      this.cdr.detectChanges();
      return;
    }

    this.studentId = Math.trunc(sessionStudentId);
    this.loadState();
  }

  private defaultStatusForGrade(level: number): CourseStatus {
    const effectiveCurrentGradeLevel = this.effectiveCurrentGradeLevel;
    if (level === effectiveCurrentGradeLevel) return 'IN_PROGRESS';
    if (level < effectiveCurrentGradeLevel) return 'COMPLETED';
    return 'PLANNED';
  }

  private applyCourseSuggestion(course: CourseDraft, suggestion: CourseCatalogEntry): void {
    course.courseCode = suggestion.code;
    this.savedMessage = '';
    this.closeCourseSuggestions();
    this.markCoursePlanDirty();
  }

  private markCoursePlanDirty(): void {
    if (!this.studentId || this.loading) return;

    this.error = '';
    this.savedMessage = '';
    this.clearAutoSaveTimer();

    const payloadDigest = this.createPayloadDigest(this.buildPayloadForSave());
    if (payloadDigest === this.lastSavedPayloadDigest) {
      this.cdr.detectChanges();
      return;
    }

    if (this.saving) {
      this.pendingAutoSave = true;
      this.cdr.detectChanges();
      return;
    }

    this.scheduleAutoSave();
  }

  private scheduleAutoSave(delayMs = this.autoSaveDelayMs): void {
    this.clearAutoSaveTimer();
    this.autoSaveTimer = setTimeout(() => {
      this.autoSaveTimer = null;
      this.persistCoursePlan();
    }, delayMs);
    this.cdr.detectChanges();
  }

  private clearAutoSaveTimer(): void {
    if (this.autoSaveTimer === null) return;
    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = null;
  }

  private updateLastSavedPayloadDigest(): void {
    this.lastSavedPayloadDigest = this.createPayloadDigest(this.buildPayloadForSave());
  }

  private createPayloadDigest(payload: CoursePlanPayload): string {
    return JSON.stringify(payload);
  }

  private defaultSemesterForGrade(grade: GradePlanDraft, status: CourseStatus): SemesterSlot {
    if (!this.isSemesterSplit(grade)) return null;
    if (status === 'COMPLETED') return 'S1';
    return this.currentSemesterSlot();
  }

  private clearCourseSuggestionCloseTimer(): void {
    if (this.suggestionCloseTimer === null) return;
    clearTimeout(this.suggestionCloseTimer);
    this.suggestionCloseTimer = null;
  }

  private normalizeSuggestionQuery(value: string): string {
    return String(value || '').trim().toUpperCase();
  }

  private matchesSuggestionQuery(entry: CourseCatalogEntry, query: string): boolean {
    if (!query) return true;

    const haystacks = [entry.code, entry.title, ...(entry.keywords ?? [])].map((value) =>
      value.toUpperCase()
    );

    return haystacks.some((value) => value.includes(query));
  }

  private scoreSuggestion(entry: CourseCatalogEntry, gradeLevel: number, query: string): number {
    const gradeDistance = Math.abs(entry.gradeLevel - gradeLevel);
    let score = Math.max(0, 24 - Math.min(gradeDistance, 4) * 6);

    if (!query) return score;

    const code = entry.code.toUpperCase();
    const title = entry.title.toUpperCase();
    const keywords = (entry.keywords ?? []).map((value) => value.toUpperCase());

    if (code === query) score += 120;
    else if (code.startsWith(query)) score += 90;
    else if (code.includes(query)) score += 60;

    if (title.startsWith(query)) score += 48;
    else if (title.includes(query)) score += 30;

    if (keywords.some((value) => value.includes(query))) score += 24;

    return score;
  }

  private resolveDropSemester(
    targetGrade: GradePlanDraft,
    targetSemester: SemesterSlot,
    status: CourseStatus
  ): SemesterSlot {
    if (!this.isSemesterSplit(targetGrade)) return null;
    return targetSemester ?? this.defaultSemesterForGrade(targetGrade, status);
  }

  private ensureSemesterAssignmentsForCurrentGrade(): void {
    const currentGrade = this.grades.find((grade) => grade.level === this.effectiveCurrentGradeLevel);
    if (!currentGrade || currentGrade.yearStructure !== 'SEMESTER') return;
    this.assignSemesterSlots(currentGrade);
  }

  private assignSemesterSlots(grade: GradePlanDraft): void {
    const currentSemester = this.currentSemesterSlot();
    grade.courses.forEach((course) => {
      if (course.semester) return;
      course.semester = course.status === 'COMPLETED' ? 'S1' : currentSemester;
    });
  }

  private currentSemesterSlot(): Exclude<SemesterSlot, null> {
    const month = new Date().getMonth();
    if (month >= 8 || month <= 0) return 'S1';
    if (month <= 5) return 'S2';
    return 'S1';
  }

  private parseDragState(event: DragEvent): DragState | null {
    const payload =
      event.dataTransfer?.getData('application/json') || event.dataTransfer?.getData('text/plain') || '';
    const text = String(payload || '').trim();
    if (!text) return null;

    try {
      const parsed = JSON.parse(text) as DragState;
      const sourceGradeId = Number(parsed?.sourceGradeId);
      const courseId = String(parsed?.courseId || '').trim();
      if (!Number.isFinite(sourceGradeId) || !courseId) return null;
      return { sourceGradeId: Math.trunc(sourceGradeId), courseId };
    } catch {
      const [gradeText, courseId] = text.split(':');
      const sourceGradeId = Number(gradeText);
      if (!Number.isFinite(sourceGradeId) || !courseId) return null;
      return {
        sourceGradeId: Math.trunc(sourceGradeId),
        courseId: courseId.trim(),
      };
    }
  }

  private inferCurrentGradeLevel(): number {
    const inProgressGrade = this.grades.find((grade) =>
      grade.courses.some((course) => course.status === 'IN_PROGRESS')
    );
    if (inProgressGrade) return inProgressGrade.level;
    return 12;
  }

  private clampToVisibleGrade(level: number): number {
    const visibleLevels = this.visibleGrades.map((grade) => grade.level);
    if (visibleLevels.length <= 0) return 12;
    const min = Math.min(...visibleLevels);
    const max = Math.max(...visibleLevels);
    return Math.min(max, Math.max(min, Math.trunc(level)));
  }

  private normalizeCurrentGradeLevel(value: unknown): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    const normalized = Math.trunc(parsed);
    if (normalized < 9 || normalized > 13) return null;
    return normalized;
  }

  private normalizeStatus(status: unknown): CourseStatus {
    const text = String(status || '')
      .trim()
      .toUpperCase();
    if (text === 'COMPLETED') return 'COMPLETED';
    if (text === 'IN_PROGRESS') return 'IN_PROGRESS';
    return 'PLANNED';
  }

  private normalizeSemester(value: unknown): SemesterSlot {
    const text = String(value || '')
      .trim()
      .toUpperCase();
    if (text === 'S1') return 'S1';
    if (text === 'S2') return 'S2';
    return null;
  }

  private normalizeSortOrder(value: unknown, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, Math.trunc(parsed));
  }

  private normalizeMarkText(value: unknown): string {
    const text = String(value ?? '').trim();
    if (!text) return '';
    const parsed = Number(text);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return '';
    const rounded = Math.round(parsed * 100) / 100;
    return String(rounded);
  }

  private normalizeMarkForSave(value: unknown, status: CourseStatus): number | null {
    if (status === 'PLANNED') return null;
    const text = String(value ?? '').trim();
    if (!text) return null;
    const parsed = Number(text);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null;
    return Math.round(parsed * 100) / 100;
  }

  private trimCourseCode(value: unknown): string {
    const text = String(value || '').trim();
    return text.slice(0, 64);
  }

  private normalizeCourseId(value: unknown, gradeLevel: number): string {
    const raw = String(value || '').trim();
    if (raw) return raw.slice(0, 128);
    return this.createLocalCourseId(gradeLevel);
  }

  private createLocalCourseId(gradeLevel: number): string {
    const timestamp = Date.now();
    const id = `g${Math.trunc(gradeLevel)}-local-${timestamp}-${this.nextLocalCourseSeed++}`;
    return id.slice(0, 128);
  }

  private buildEmptyScaffold(): GradePlanDraft[] {
    return [9, 10, 11, 12, 13].map((level) => this.createGrade(level, 'FULL_YEAR', []));
  }

  private createGrade(level: number, yearStructure: YearStructure, courses: CourseDraft[]): GradePlanDraft {
    return { id: level, level, yearStructure, courses: [...courses] };
  }

  private createCourse(
    gradeLevel: number,
    status: CourseStatus,
    courseCode: string,
    mark: string,
    semester: SemesterSlot = null,
    sortOrder = 0,
    id: string | null = null
  ): CourseDraft {
    return {
      id: this.normalizeCourseId(id, gradeLevel),
      status,
      courseCode: this.trimCourseCode(courseCode),
      mark: status === 'PLANNED' ? '' : this.normalizeMarkText(mark),
      semester,
      sortOrder,
    };
  }

  private reindexGradeCourses(grade: GradePlanDraft): void {
    grade.courses.forEach((course, index) => {
      course.sortOrder = index;
    });
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    if (!error || typeof error !== 'object') return fallback;

    const obj = error as {
      name?: unknown;
      status?: unknown;
      message?: unknown;
      error?: unknown;
    };

    const errorName = String(obj.name || '').trim().toLowerCase();
    if (errorName === 'timeouterror') {
      return 'Request timed out. Please retry.';
    }

    const payloadMessage = this.extractPayloadErrorMessage(obj.error);
    if (payloadMessage) return payloadMessage;

    const message = String(obj.message || '').trim();
    if (message) return message;

    const status = Number(obj.status);
    if (Number.isFinite(status) && status > 0) {
      return `Request failed (HTTP ${status}).`;
    }

    return fallback;
  }

  private extractPayloadErrorMessage(payload: unknown): string {
    if (!payload) return '';

    if (typeof payload === 'string') {
      const rawText = payload.trim();
      if (!rawText) return '';
      try {
        const parsed = JSON.parse(rawText) as {
          message?: unknown;
          error?: unknown;
          details?: unknown;
        };
        const parsedMessage = this.composeErrorMessage(parsed.message, parsed.error, parsed.details);
        return parsedMessage || rawText;
      } catch {
        return rawText;
      }
    }

    if (typeof payload !== 'object') return '';
    const obj = payload as {
      message?: unknown;
      error?: unknown;
      details?: unknown;
    };
    return this.composeErrorMessage(obj.message, obj.error, obj.details);
  }

  private composeErrorMessage(message: unknown, error: unknown, details: unknown): string {
    const baseMessage = String(message || error || '')
      .trim()
      .replace(/\s+/g, ' ');
    const detailText = this.extractErrorDetails(details);

    if (baseMessage && detailText) return `${baseMessage} ${detailText}`;
    if (detailText) return detailText;
    return baseMessage;
  }

  private extractErrorDetails(details: unknown): string {
    if (!Array.isArray(details)) return '';

    const detailRows = details
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry.trim();
        }
        if (!entry || typeof entry !== 'object') {
          return '';
        }

        const item = entry as { field?: unknown; message?: unknown };
        const field = String(item.field || '').trim();
        const message = String(item.message || '').trim();
        if (field && message) return `${field} ${message}`;
        return message || field;
      })
      .filter((value) => value.length > 0);

    if (detailRows.length <= 0) return '';
    return `Details: ${detailRows.join('; ')}`;
  }
}
