import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CourseCatalogEntry, COURSE_PLAN_CATALOG } from './course-plan-course-catalog';

type CourseStatus = 'COMPLETED' | 'IN_PROGRESS' | 'PLANNED';
type YearStructure = 'SEMESTER' | 'FULL_YEAR';
type SemesterSlot = 'S1' | 'S2' | null;

interface CourseDraft {
  id: number;
  status: CourseStatus;
  courseCode: string;
  mark: string;
  semester: SemesterSlot;
}

interface GradePlanDraft {
  id: number;
  level: number;
  yearStructure: YearStructure;
  courses: CourseDraft[];
}

interface DragState {
  courseId: number;
  sourceGradeId: number;
}

@Component({
  selector: 'app-course-plan-prototype',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './course-plan-prototype.component.html',
  styleUrl: './course-plan-prototype.component.scss',
})
export class CoursePlanPrototypeComponent {
  readonly statusOrder: readonly CourseStatus[] = ['COMPLETED', 'IN_PROGRESS', 'PLANNED'];
  readonly yearStructureOrder: readonly YearStructure[] = ['SEMESTER', 'FULL_YEAR'];
  readonly courseCatalog = COURSE_PLAN_CATALOG;
  private nextCourseId = 1000;
  private dragState: DragState | null = null;
  private suggestionCloseTimer: ReturnType<typeof setTimeout> | null = null;
  draggingCourseId: number | null = null;
  activeSuggestionCourseId: number | null = null;
  highlightedSuggestionIndex = 0;
  showGrade13 = true;
  graduationGradeLevel = 12;
  expectedGraduationDate = this.buildDefaultGraduationDate();
  manualCurrentGradeLevel: number | null = null;

  grades: GradePlanDraft[] = [
    this.createGrade(9, 'SEMESTER', [
      this.createCourse('COMPLETED', 'ENG1D', '91'),
      this.createCourse('COMPLETED', 'MPM1D', '94'),
      this.createCourse('IN_PROGRESS', 'SNC1D', ''),
      this.createCourse('PLANNED', 'FSF1D', ''),
    ]),
    this.createGrade(10, 'SEMESTER', [
      this.createCourse('COMPLETED', 'ENG2D', '90'),
      this.createCourse('COMPLETED', 'MPM2D', '93'),
      this.createCourse('IN_PROGRESS', 'CHC2D', ''),
      this.createCourse('PLANNED', 'GLC2O', ''),
    ]),
    this.createGrade(11, 'SEMESTER', [
      this.createCourse('COMPLETED', 'BAF3M', '88', 'S1'),
      this.createCourse('IN_PROGRESS', 'MCR3U', '', 'S2'),
      this.createCourse('IN_PROGRESS', 'SCH3U', '', 'S2'),
      this.createCourse('PLANNED', 'SPH3U', '', 'S2'),
    ]),
    this.createGrade(12, 'SEMESTER', [
      this.createCourse('IN_PROGRESS', 'ENG4U', ''),
      this.createCourse('PLANNED', 'MHF4U', ''),
      this.createCourse('PLANNED', 'MCV4U', ''),
    ]),
    this.createGrade(13, 'FULL_YEAR', [this.createCourse('PLANNED', '', '')]),
  ];

  constructor() {
    this.ensureSemesterAssignmentsForCurrentGrade();
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

  countGradeCourses(grade: GradePlanDraft): number {
    return grade.courses.length;
  }

  toggleGrade13(): void {
    this.showGrade13 = !this.showGrade13;
    if (!this.showGrade13 && this.manualCurrentGradeLevel === 13) {
      this.manualCurrentGradeLevel = null;
    }
    this.ensureSemesterAssignmentsForCurrentGrade();
  }

  toggleManualCurrentGrade(level: number): void {
    this.manualCurrentGradeLevel = this.manualCurrentGradeLevel === level ? null : level;
    this.ensureSemesterAssignmentsForCurrentGrade();
  }

  addCourse(gradeId: number): void {
    const grade = this.grades.find((item) => item.id === gradeId);
    if (!grade) return;
    const status = this.defaultStatusForGrade(grade.level);
    grade.courses.push(this.createCourse(status, '', '', this.defaultSemesterForGrade(grade, status)));
  }

  removeCourse(gradeId: number, courseId: number): void {
    const grade = this.grades.find((item) => item.id === gradeId);
    if (!grade) return;
    grade.courses = grade.courses.filter((course) => course.id !== courseId);
    if (this.activeSuggestionCourseId === courseId) {
      this.closeCourseSuggestions();
    }
  }

  setCourseStatus(course: CourseDraft, status: CourseStatus): void {
    course.status = status;
    if (status === 'PLANNED') {
      course.mark = '';
    }
  }

  setYearStructure(grade: GradePlanDraft, yearStructure: YearStructure): void {
    grade.yearStructure = yearStructure;
    if (yearStructure === 'FULL_YEAR') {
      grade.courses.forEach((course) => {
        course.semester = null;
      });
      return;
    }

    if (this.isCurrentGrade(grade)) {
      this.assignSemesterSlots(grade);
    }
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

  openCourseSuggestions(courseId: number): void {
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

  startCourseDrag(event: DragEvent, gradeId: number, courseId: number): void {
    this.dragState = { sourceGradeId: gradeId, courseId };
    this.draggingCourseId = courseId;
    event.dataTransfer?.setData('text/plain', `${gradeId}:${courseId}`);
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
    course.semester = resolvedSemester;
    targetGrade.courses.push(course);
    this.endCourseDrag();
  }

  trackGrade = (_index: number, grade: GradePlanDraft): number => grade.id;
  trackStatus = (_index: number, status: CourseStatus): CourseStatus => status;
  trackCourse = (_index: number, course: CourseDraft): number => course.id;
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
    return semester === 'S1' ? '上学期' : '下学期';
  }

  statusClass(status: CourseStatus): string {
    if (status === 'COMPLETED') return 'completed';
    if (status === 'IN_PROGRESS') return 'in-progress';
    return 'planned';
  }

  private defaultStatusForGrade(level: number): CourseStatus {
    const effectiveCurrentGradeLevel = this.effectiveCurrentGradeLevel;
    if (level === effectiveCurrentGradeLevel) return 'IN_PROGRESS';
    if (level < effectiveCurrentGradeLevel) return 'COMPLETED';
    return 'PLANNED';
  }

  private applyCourseSuggestion(course: CourseDraft, suggestion: CourseCatalogEntry): void {
    course.courseCode = suggestion.code;
    this.closeCourseSuggestions();
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
    const payload = event.dataTransfer?.getData('text/plain')?.trim();
    if (!payload) return null;
    const [gradeText, courseText] = payload.split(':');
    const sourceGradeId = Number(gradeText);
    const courseId = Number(courseText);
    if (!Number.isInteger(sourceGradeId) || !Number.isInteger(courseId)) return null;
    return { sourceGradeId, courseId };
  }

  private inferCurrentGradeLevel(): number {
    const graduationDate = this.parseDate(this.expectedGraduationDate);
    if (!graduationDate) {
      return this.graduationGradeLevel;
    }

    const now = new Date();
    const graduationSchoolYear = this.resolveAcademicYearStart(graduationDate);
    const currentSchoolYear = this.resolveAcademicYearStart(now);
    const yearDelta = graduationSchoolYear - currentSchoolYear;
    const inferredGrade = this.graduationGradeLevel - yearDelta;

    return this.clampGradeLevel(inferredGrade);
  }

  private resolveAcademicYearStart(value: Date): number {
    const month = value.getMonth();
    const year = value.getFullYear();
    return month >= 8 ? year : year - 1;
  }

  private clampGradeLevel(level: number): number {
    const allLevels = this.grades.map((grade) => grade.level);
    const min = Math.min(...allLevels);
    const max = Math.max(...allLevels);
    return Math.min(max, Math.max(min, Math.trunc(level)));
  }

  private clampToVisibleGrade(level: number): number {
    const visibleLevels = this.visibleGrades.map((grade) => grade.level);
    const min = Math.min(...visibleLevels);
    const max = Math.max(...visibleLevels);
    return Math.min(max, Math.max(min, Math.trunc(level)));
  }

  private buildDefaultGraduationDate(): string {
    const now = new Date();
    const graduationYear = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear() + 1;
    return `${graduationYear}-06-30`;
  }

  private parseDate(value: string): Date | null {
    const text = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    const parsed = new Date(`${text}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private createGrade(
    level: number,
    yearStructure: YearStructure,
    courses: CourseDraft[]
  ): GradePlanDraft {
    return { id: level, level, yearStructure, courses: [...courses] };
  }

  private createCourse(
    status: CourseStatus,
    courseCode: string,
    mark: string,
    semester: SemesterSlot = null
  ): CourseDraft {
    return {
      id: this.nextCourseId++,
      status,
      courseCode,
      mark,
      semester,
    };
  }
}
