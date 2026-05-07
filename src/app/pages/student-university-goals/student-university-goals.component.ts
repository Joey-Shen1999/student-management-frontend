import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize, timeout } from 'rxjs/operators';

import { AuthService } from '../../services/auth.service';
import {
  type University,
  type UniversityAspiration,
  type UniversityAspirationRequest,
  UniversityAspirationService,
  type UniversityProgram,
} from '../../services/university-aspiration.service';

interface UniversityGoalFormModel {
  id: number | null;
  universityId: number | null;
  programId: number | null;
  notes: string;
}

@Component({
  selector: 'app-student-university-goals',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './student-university-goals.component.html',
  styleUrl: './student-university-goals.component.scss',
})
export class StudentUniversityGoalsComponent implements OnInit {
  private readonly loadTimeoutMs = 8000;

  studentId: number | null = null;
  teacherMode = false;
  invalidStudentId = false;

  universities: University[] = [];
  programs: UniversityProgram[] = [];
  goals: UniversityAspiration[] = [];

  universitySearch = '';
  programSearch = '';
  loading = false;
  catalogLoading = false;
  programsLoading = false;
  saving = false;
  error = '';
  successMessage = '';
  formOpen = false;
  dragIndex: number | null = null;
  form: UniversityGoalFormModel = this.defaultForm();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    private goalsApi: UniversityAspirationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.applyRouteContext();
    this.loadUniversities();
    this.loadGoals();
  }

  get filteredUniversities(): University[] {
    const keyword = this.toText(this.universitySearch).toLowerCase();
    if (!keyword) return this.universities;
    return this.universities.filter((university) =>
      [university.name, university.city, university.province, university.country]
        .map((value) => this.toText(value).toLowerCase())
        .some((value) => value.includes(keyword))
    );
  }

  get filteredPrograms(): UniversityProgram[] {
    const keyword = this.toText(this.programSearch).toLowerCase();
    if (!keyword) return this.programs;
    return this.programs.filter((program) =>
      [program.programName, program.facultyName, program.degreeType]
        .map((value) => this.toText(value).toLowerCase())
        .some((value) => value.includes(keyword))
    );
  }

  get pageSubtitle(): string {
    return this.teacherMode && this.studentId ? `学生 #${this.studentId}` : '';
  }

  goBack(): void {
    this.router.navigate([this.teacherMode ? '/teacher/students' : '/dashboard']);
  }

  refresh(): void {
    this.loadUniversities();
    this.loadGoals();
  }

  openAddForm(): void {
    if (this.invalidStudentId || this.saving) return;
    this.form = this.defaultForm();
    this.programs = [];
    this.universitySearch = '';
    this.programSearch = '';
    this.error = '';
    this.successMessage = '';
    this.formOpen = true;
  }

  openEditForm(goal: UniversityAspiration): void {
    const goalId = this.resolveGoalId(goal);
    const universityId = this.toOptionalNumber(goal.universityId);
    const programId = this.toOptionalNumber(goal.programId);
    if (!goalId || !universityId || !programId || this.saving) return;

    this.form = {
      id: goalId,
      universityId,
      programId,
      notes: this.toText(goal.notes),
    };
    this.programs = [];
    this.universitySearch = '';
    this.programSearch = '';
    this.error = '';
    this.successMessage = '';
    this.formOpen = true;
    this.loadProgramsForUniversity(universityId);
  }

  closeForm(): void {
    if (this.saving) return;
    this.formOpen = false;
    this.form = this.defaultForm();
    this.programs = [];
    this.universitySearch = '';
    this.programSearch = '';
  }

  onUniversityChange(value: unknown): void {
    const universityId = this.toOptionalNumber(value);
    this.form.universityId = universityId;
    this.form.programId = null;
    this.programs = [];
    this.programSearch = '';
    if (universityId) {
      this.loadProgramsForUniversity(universityId);
    }
  }

  saveGoal(): void {
    const studentId = this.studentId;
    if (!studentId) {
      this.error = '无法识别当前学生，不能保存大学目标。';
      this.cdr.detectChanges();
      return;
    }

    const payload = this.buildPayload();
    if (!payload) {
      this.cdr.detectChanges();
      return;
    }

    this.saving = true;
    this.error = '';
    this.successMessage = '';
    const request$ = this.form.id
      ? this.goalsApi.updateAspiration(this.form.id, payload)
      : this.goalsApi.createAspiration(studentId, payload);

    request$
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => {
          this.formOpen = false;
          this.form = this.defaultForm();
          this.successMessage = '大学目标已保存。';
          this.loadGoals();
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.extractErrorMessage(err) || '保存大学目标失败。';
        },
      });
  }

  deleteGoal(goal: UniversityAspiration): void {
    const goalId = this.resolveGoalId(goal);
    if (!goalId || this.saving) return;
    if (!confirm('确定删除这条大学目标吗？')) return;

    this.saving = true;
    this.error = '';
    this.successMessage = '';
    this.goalsApi
      .deleteAspiration(goalId)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => {
          this.successMessage = '大学目标已删除。';
          this.loadGoals();
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.extractErrorMessage(err) || '删除大学目标失败。';
        },
      });
  }

  onDragStart(index: number): void {
    if (this.saving || this.goals.length <= 1) return;
    this.dragIndex = index;
  }

  onDragOver(event: DragEvent): void {
    if (this.dragIndex === null) return;
    event.preventDefault();
  }

  onDrop(targetIndex: number): void {
    const sourceIndex = this.dragIndex;
    this.dragIndex = null;
    if (sourceIndex === null || sourceIndex === targetIndex) return;
    if (sourceIndex < 0 || sourceIndex >= this.goals.length) return;
    if (targetIndex < 0 || targetIndex >= this.goals.length) return;

    const reordered = [...this.goals];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    this.goals = reordered.map((item, index) => ({
      ...item,
      sortOrder: index + 1,
    }));
    this.saveOrder();
  }

  onDragEnd(): void {
    this.dragIndex = null;
  }

  trackGoal(_index: number, goal: UniversityAspiration): number | string {
    return this.resolveGoalId(goal) || `${goal.universityName}-${goal.programName}`;
  }

  displayUniversityLocation(university: University): string {
    return [university.city, university.province, university.country]
      .map((value) => this.toText(value))
      .filter(Boolean)
      .join(', ');
  }

  displayProgramMeta(goal: UniversityAspiration): string {
    return [goal.facultyName, goal.degreeType]
      .map((value) => this.toText(value))
      .filter(Boolean)
      .join(' / ');
  }

  displayText(value: unknown): string {
    return this.toText(value) || '-';
  }

  private applyRouteContext(): void {
    const routeStudentId = this.route.snapshot.paramMap.get('studentId');
    if (routeStudentId !== null) {
      const parsed = Number(routeStudentId);
      this.teacherMode = true;
      this.studentId = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
      this.invalidStudentId = !this.studentId;
      return;
    }

    this.teacherMode = false;
    this.studentId = this.toOptionalNumber(this.auth.getSession()?.studentId);
    this.invalidStudentId = !this.studentId;
  }

  private loadUniversities(): void {
    this.catalogLoading = true;
    this.goalsApi
      .listUniversities()
      .pipe(
        timeout({ first: this.loadTimeoutMs }),
        finalize(() => (this.catalogLoading = false))
      )
      .subscribe({
        next: (items) => {
          this.universities = this.normalizeUniversities(items);
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.extractErrorMessage(err) || '加载大学列表超时，请刷新重试。';
          this.universities = [];
        },
      });
  }

  private loadProgramsForUniversity(universityId: number): void {
    if (!universityId) return;
    const requestedUniversityId = universityId;
    this.programsLoading = true;
    this.goalsApi
      .listPrograms(universityId)
      .pipe(
        timeout({ first: this.loadTimeoutMs }),
        finalize(() => (this.programsLoading = false))
      )
      .subscribe({
        next: (items) => {
          if (this.form.universityId !== requestedUniversityId) return;
          this.programs = this.normalizePrograms(items);
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.extractErrorMessage(err) || '加载专业列表超时，请刷新重试。';
          this.programs = [];
        },
      });
  }

  private loadGoals(): void {
    const studentId = this.studentId;
    this.formOpen = false;
    this.form = this.defaultForm();
    this.programs = [];
    this.dragIndex = null;
    if (!studentId) {
      this.goals = [];
      this.loading = false;
      return;
    }

    this.loading = true;
    this.error = '';
    this.goalsApi
      .listAspirations(studentId)
      .pipe(
        timeout({ first: this.loadTimeoutMs }),
        finalize(() => (this.loading = false))
      )
      .subscribe({
        next: (items) => {
          this.goals = this.normalizeGoals(items);
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.extractErrorMessage(err) || '加载大学目标超时，请刷新重试。';
          this.goals = [];
        },
      });
  }

  private saveOrder(): void {
    const studentId = this.studentId;
    if (!studentId) return;

    const payload = this.goals
      .map((goal, index) => ({
        id: this.resolveGoalId(goal),
        sortOrder: index + 1,
      }))
      .filter((item): item is { id: number; sortOrder: number } => !!item.id);

    if (payload.length !== this.goals.length) {
      this.error = '排序保存失败：存在无效的大学目标记录。';
      this.loadGoals();
      return;
    }

    this.saving = true;
    this.error = '';
    this.successMessage = '';
    this.goalsApi
      .reorderAspirations(studentId, payload)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (items) => {
          this.goals = this.normalizeGoals(items);
          this.successMessage = '大学目标排序已保存。';
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.extractErrorMessage(err) || '保存大学目标排序失败。';
          this.loadGoals();
        },
      });
  }

  private buildPayload(): UniversityAspirationRequest | null {
    const universityId = this.toOptionalNumber(this.form.universityId);
    const programId = this.toOptionalNumber(this.form.programId);
    if (!universityId) {
      this.error = '请选择大学。';
      return null;
    }
    if (!programId) {
      this.error = '请选择专业/科系。';
      return null;
    }
    return {
      universityId,
      programId,
      notes: this.toText(this.form.notes),
    };
  }

  private normalizeUniversities(items: University[] | null | undefined): University[] {
    return [...(Array.isArray(items) ? items : [])]
      .filter((item) => this.toOptionalNumber(item.id))
      .sort((left, right) => this.toText(left.name).localeCompare(this.toText(right.name)));
  }

  private normalizePrograms(items: UniversityProgram[] | null | undefined): UniversityProgram[] {
    return [...(Array.isArray(items) ? items : [])]
      .filter((item) => this.toOptionalNumber(item.id))
      .sort((left, right) => this.toText(left.programName).localeCompare(this.toText(right.programName)));
  }

  private normalizeGoals(items: UniversityAspiration[] | null | undefined): UniversityAspiration[] {
    return [...(Array.isArray(items) ? items : [])].sort((left, right) => {
      const leftOrder = this.toOptionalNumber(left.sortOrder) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = this.toOptionalNumber(right.sortOrder) ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return (this.resolveGoalId(left) || 0) - (this.resolveGoalId(right) || 0);
    });
  }

  private defaultForm(): UniversityGoalFormModel {
    return {
      id: null,
      universityId: null,
      programId: null,
      notes: '',
    };
  }

  private resolveGoalId(goal: UniversityAspiration | null | undefined): number | null {
    return this.toOptionalNumber(goal?.aspirationId ?? goal?.id);
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const payload = error.error;
      if (typeof payload === 'string') return payload;
      if (payload && typeof payload === 'object') {
        const message = (payload as { message?: unknown; error?: unknown }).message ?? (payload as { error?: unknown }).error;
        return this.toText(message);
      }
      return this.toText(error.message);
    }
    return '';
  }

  private toOptionalNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : null;
  }

  private toText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : value === null || value === undefined ? '' : String(value).trim();
  }
}
