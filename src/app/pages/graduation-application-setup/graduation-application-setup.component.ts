import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, of, timeout } from 'rxjs';

import {
  GraduationApplication,
  GraduationApplicationRequest,
  GraduationApplicationStageService,
  GraduationApplicationStatus,
} from '../../services/graduation-application-stage.service';
import {
  University,
  UniversityAspiration,
  UniversityAspirationService,
  UniversityProgram,
} from '../../services/university-aspiration.service';

interface ApplicationDraft extends GraduationApplication {
  selected: boolean;
}

@Component({
  selector: 'app-graduation-application-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './graduation-application-setup.component.html',
  styleUrl: './graduation-application-setup.component.scss',
})
export class GraduationApplicationSetupComponent implements OnInit {
  readonly statusOptions: GraduationApplicationStatus[] = [
    'PREPARING',
    'READY_TO_SUBMIT',
    'SUBMITTED',
    'WAITING_RESULT',
    'OFFER_RECEIVED',
  ];

  studentId = 0;
  loading = false;
  loadingMessage = '';
  saving = false;
  error = '';
  message = '';
  drafts: ApplicationDraft[] = [];
  universities: University[] = [];
  newUniversityName = '';
  newProgramName = '';
  newUniversityId: number | null = null;
  newProgramId: number | null = null;
  newProgramOptions: UniversityProgram[] = [];
  loadingPrograms = false;
  isAlreadyEnabled = false;
  addDialogOpen = false;
  addDialogError = '';
  editingDraftId: string | null = null;
  universitySuggestionsOpen = false;
  programSuggestionsOpen = false;
  draggedDraftId: string | null = null;
  dragOverDraftId: string | null = null;
  private readonly requestTimeoutMs = 12000;
  private draftLoadRequestId = 0;
  private draftLoadWatchdog: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private aspirationApi: UniversityAspirationService,
    public graduationStage: GraduationApplicationStageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.studentId = Math.trunc(Number(this.route.snapshot.paramMap.get('studentId')));
    if (!Number.isFinite(this.studentId) || this.studentId <= 0) {
      this.error = '缺少学生 ID，无法准备升学阶段。';
      return;
    }

    this.loadUniversities();
    this.loadDrafts();
  }

  get selectedCount(): number {
    return this.drafts.filter((item) => item.selected).length;
  }

  get selectedDrafts(): ApplicationDraft[] {
    return this.drafts.filter((item) => item.selected);
  }

  get removedDrafts(): ApplicationDraft[] {
    return this.drafts.filter((item) => !item.selected);
  }

  get selectedNewUniversity(): University | null {
    const name = this.newUniversityName.trim();
    if (!name) return null;
    const normalized = this.normalizeSearchText(name);
    return this.universities.find((item) => this.normalizeSearchText(item.name) === normalized) ?? null;
  }

  get visibleNewUniversities(): University[] {
    const keyword = this.newUniversityName.trim();
    if (!keyword) return this.universities;
    return this.universities.filter((item) =>
      this.matchesSearch(keyword, [item.name, item.city, item.province, item.country, item.website])
    );
  }

  get selectedNewProgram(): UniversityProgram | null {
    const university = this.selectedNewUniversity;
    const name = this.newProgramName.trim();
    if (!university || !name) return null;
    const normalized = this.normalizeSearchText(name);
    return (
      this.newProgramOptions.find((item) => {
        const belongsToUniversity = !item.universityId || Number(item.universityId) === university.id;
        return belongsToUniversity && this.normalizeSearchText(item.programName) === normalized;
      }) ?? null
    );
  }

  get visibleNewPrograms(): UniversityProgram[] {
    if (!this.selectedNewUniversity) return [];
    const keyword = this.newProgramName.trim();
    if (!keyword) return this.newProgramOptions;
    return this.newProgramOptions.filter((item) =>
      this.matchesSearch(keyword, [item.programName, item.facultyName, item.degreeType])
    );
  }

  goBack(): void {
    this.router.navigate(['/teacher/students']);
  }

  loadDrafts(): void {
    const requestId = ++this.draftLoadRequestId;
    this.loading = true;
    this.loadingMessage = '正在读取申请资料...';
    this.error = '';
    this.message = '';
    this.startDraftLoadWatchdog(requestId);

    this.graduationStage
      .listApplications(this.studentId)
      .pipe(timeout(this.requestTimeoutMs))
      .subscribe({
        next: (existing) => {
          if (!this.isLatestDraftLoad(requestId)) return;
          if ((existing || []).length > 0) {
            this.finishDraftLoading(requestId);
            this.isAlreadyEnabled = true;
            this.drafts = existing.map((item) => ({ ...item, selected: true }));
            this.markViewForCheck();
            return;
          }

          this.isAlreadyEnabled = false;
          this.markViewForCheck();
          this.loadDraftsFromAspirations(requestId);
        },
        error: (err: unknown) => {
          if (!this.isLatestDraftLoad(requestId)) return;
          this.debugLoadError('读取正式申请失败，改为读取大学目标草稿', err);
          this.isAlreadyEnabled = false;
          this.markViewForCheck();
          this.loadDraftsFromAspirations(requestId);
        },
      });
  }

  addDraft(): void {
    const university = this.selectedNewUniversity;
    const program = this.selectedNewProgram;
    if (!university) {
      this.addDialogError = '请先选择大学。';
      this.universitySuggestionsOpen = true;
      this.markViewForCheck();
      return;
    }
    if (!program || (program.universityId && Number(program.universityId) !== university.id)) {
      this.addDialogError = '请选择该大学下的专业。';
      this.programSuggestionsOpen = true;
      this.markViewForCheck();
      return;
    }

    const updatedAt = new Date().toISOString();
    if (this.editingDraftId) {
      this.drafts = this.drafts.map((item) =>
        String(item.id) === this.editingDraftId
          ? {
              ...item,
              universityId: university.id,
              universityName: university.name,
              programId: program.id,
              programName: program.programName,
              facultyName: program.facultyName,
              degreeType: program.degreeType,
              sourceAspirationId: undefined,
              updatedAt,
            }
          : item
      );
    } else {
      const sortOrder = this.drafts.length + 1;
      this.drafts = [
        ...this.drafts,
        {
          id: `student-${this.studentId}-manual-${Date.now()}`,
          studentId: this.studentId,
          universityId: university.id,
          universityName: university.name,
          programId: program.id,
          programName: program.programName,
          facultyName: program.facultyName,
          degreeType: program.degreeType,
          status: 'PREPARING',
          sortOrder,
          updatedAt,
          selected: true,
        },
      ];
    }
    this.error = '';
    this.addDialogError = '';
    this.closeAddDraftDialog();
    this.markViewForCheck();
  }

  openAddDraftDialog(): void {
    this.addDialogOpen = true;
    this.addDialogError = '';
    this.editingDraftId = null;
    this.resetNewDraftForm();
    this.markViewForCheck();
  }

  openEditDraftDialog(draft: ApplicationDraft): void {
    this.editingDraftId = String(draft.id);
    this.addDialogOpen = true;
    this.addDialogError = '';
    this.newUniversityName = draft.universityName || '';
    this.newUniversityId = Math.trunc(Number(draft.universityId)) || null;
    this.newProgramName = draft.programName || '';
    this.newProgramId = Math.trunc(Number(draft.programId)) || null;
    this.newProgramOptions = [];
    this.universitySuggestionsOpen = false;
    this.programSuggestionsOpen = false;
    if (this.newUniversityId) {
      this.loadNewPrograms(this.newUniversityId);
    }
    this.markViewForCheck();
  }

  closeAddDraftDialog(): void {
    this.addDialogOpen = false;
    this.addDialogError = '';
    this.editingDraftId = null;
    this.resetNewDraftForm();
    this.markViewForCheck();
  }

  removeDraft(target: ApplicationDraft): void {
    this.setDraftSelected(target, false);
  }

  restoreDraft(target: ApplicationDraft): void {
    this.setDraftSelected(target, true);
  }

  setDraftSelected(target: ApplicationDraft, selected: boolean): void {
    const targetId = String(target.id);
    const selectedRows = this.drafts.filter((item) => item.selected && String(item.id) !== targetId);
    const removedRows = this.drafts.filter((item) => !item.selected && String(item.id) !== targetId);
    const nextTarget = { ...target, selected };
    const next = selected
      ? [...selectedRows, nextTarget, ...removedRows]
      : [...selectedRows, ...removedRows, nextTarget];
    this.applyDraftOrder(next);
  }

  moveDraft(target: ApplicationDraft, direction: -1 | 1): void {
    const currentIndex = this.drafts.findIndex((item) => item.id === target.id);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= this.drafts.length) return;

    const next = [...this.drafts];
    const [item] = next.splice(currentIndex, 1);
    next.splice(nextIndex, 0, item);
    this.applyDraftOrder(next);
  }

  onDraftDragStart(event: DragEvent, draft: ApplicationDraft): void {
    if (!draft.selected || this.selectedDrafts.length <= 1) return;
    if (this.shouldIgnoreDraftDrag(event.target)) {
      event.preventDefault();
      this.clearDraftDragState();
      return;
    }

    this.draggedDraftId = String(draft.id);
    this.dragOverDraftId = null;
    event.dataTransfer?.setData('text/plain', this.draggedDraftId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
    this.markViewForCheck();
  }

  onDraftDragOver(event: DragEvent, target: ApplicationDraft): void {
    if (!target.selected) return;
    if (!this.draggedDraftId || this.draggedDraftId === String(target.id)) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dragOverDraftId = String(target.id);
    this.markViewForCheck();
  }

  onDraftDrop(event: DragEvent, target: ApplicationDraft): void {
    event.preventDefault();
    const sourceId = this.draggedDraftId || event.dataTransfer?.getData('text/plain') || '';
    this.reorderDraftByIds(sourceId, String(target.id));
    this.clearDraftDragState();
  }

  onDraftDragEnd(): void {
    this.clearDraftDragState();
  }

  confirmGraduationStage(): void {
    const selected = this.drafts.filter((item) => item.selected);
    if (selected.length === 0) {
      this.error = '请至少选择一条正式申请。';
      return;
    }

    const payload = selected.map((item) => this.toRequest(item));
    if (payload.some((item) => !item)) {
      this.error = '正式申请必须包含有效的大学和专业。';
      return;
    }

    this.saving = true;
    this.error = '';
    this.message = '';
    this.graduationStage
      .confirmStage(this.studentId, payload.filter((item): item is GraduationApplicationRequest => item !== null))
      .pipe(
        finalize(() => {
          this.saving = false;
          this.markViewForCheck();
        })
      )
      .subscribe({
        next: (saved) => {
          this.isAlreadyEnabled = saved.length > 0;
          this.drafts = saved.map((item) => ({ ...item, selected: true }));
          this.message = `已确认进入升学阶段，共 ${saved.length} 条正式申请。`;
          this.markViewForCheck();
          this.router.navigate(['/teacher/students', String(this.studentId), 'graduation-applications']);
        },
        error: (err: unknown) => {
          this.error = this.extractErrorMessage(err) || '保存正式申请失败。';
          this.markViewForCheck();
        },
      });
  }

  onNewUniversityChange(): void {
    this.newProgramId = null;
    this.newProgramName = '';
    this.newProgramOptions = [];
    this.addDialogError = '';
    const universityId = Math.trunc(Number(this.newUniversityId));
    if (!Number.isFinite(universityId) || universityId <= 0) return;

    this.loadNewPrograms(universityId);
  }

  onNewUniversityInput(): void {
    this.newProgramName = '';
    this.newProgramId = null;
    this.newProgramOptions = [];
    this.addDialogError = '';
    const university = this.selectedNewUniversity;
    this.newUniversityId = university?.id ?? null;
    this.universitySuggestionsOpen = !!this.newUniversityName.trim() && !university;
    this.programSuggestionsOpen = !!university;
    if (university) {
      this.loadNewPrograms(university.id);
    }
    this.markViewForCheck();
  }

  onNewUniversityFocus(): void {
    this.universitySuggestionsOpen = !this.selectedNewUniversity;
    this.markViewForCheck();
  }

  selectNewUniversity(university: University): void {
    this.newUniversityName = university.name;
    this.newUniversityId = university.id;
    this.newProgramName = '';
    this.newProgramId = null;
    this.addDialogError = '';
    this.universitySuggestionsOpen = false;
    this.programSuggestionsOpen = true;
    this.loadNewPrograms(university.id);
    this.markViewForCheck();
  }

  onNewProgramInput(): void {
    this.newProgramId = this.selectedNewProgram?.id ?? null;
    this.addDialogError = '';
    this.programSuggestionsOpen = !!this.selectedNewUniversity && !this.selectedNewProgram;
    this.markViewForCheck();
  }

  onNewProgramFocus(): void {
    this.programSuggestionsOpen = !!this.selectedNewUniversity && !this.selectedNewProgram;
    this.markViewForCheck();
  }

  selectNewProgram(program: UniversityProgram): void {
    this.newProgramName = program.programName;
    this.newProgramId = program.id;
    this.addDialogError = '';
    this.programSuggestionsOpen = false;
    this.markViewForCheck();
  }

  trackDraft(_index: number, draft: ApplicationDraft): string {
    return String(draft.id);
  }

  trackUniversity(_index: number, university: University): number {
    return university.id;
  }

  trackProgram(_index: number, program: UniversityProgram): number {
    return program.id;
  }

  isDraftDragging(draft: ApplicationDraft): boolean {
    return this.draggedDraftId === String(draft.id);
  }

  isDraftDragOver(draft: ApplicationDraft): boolean {
    return this.dragOverDraftId === String(draft.id) && !this.isDraftDragging(draft);
  }

  private reorderDraftByIds(sourceId: string, targetId: string): void {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const activeDrafts = this.selectedDrafts;
    const sourceIndex = activeDrafts.findIndex((item) => String(item.id) === sourceId);
    const targetIndex = activeDrafts.findIndex((item) => String(item.id) === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const next = [...activeDrafts];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    this.applyDraftOrder([...next, ...this.removedDrafts]);
  }

  private applyDraftOrder(next: ApplicationDraft[]): void {
    this.drafts = next.map((row, index) => ({ ...row, sortOrder: index + 1 }));
    this.markViewForCheck();
  }

  private clearDraftDragState(): void {
    this.draggedDraftId = null;
    this.dragOverDraftId = null;
    this.markViewForCheck();
  }

  private resetNewDraftForm(): void {
    this.newUniversityName = '';
    this.newProgramName = '';
    this.newUniversityId = null;
    this.newProgramId = null;
    this.newProgramOptions = [];
    this.universitySuggestionsOpen = false;
    this.programSuggestionsOpen = false;
  }

  private shouldIgnoreDraftDrag(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return !!target.closest('button,input,select,textarea,label,a');
  }

  private loadUniversities(): void {
    this.aspirationApi
      .listUniversities()
      .pipe(
        timeout(this.requestTimeoutMs),
        catchError((err: unknown) => {
          this.debugLoadError('读取大学列表失败', err);
          return of([]);
        })
      )
      .subscribe({
        next: (rows) => {
          this.universities = rows || [];
          this.markViewForCheck();
        },
      });
  }

  private loadNewPrograms(universityId: number): void {
    if (!Number.isFinite(universityId) || universityId <= 0) return;
    if (this.newUniversityId === universityId && this.loadingPrograms) return;
    if (this.newUniversityId !== universityId) {
      this.newProgramOptions = [];
    }
    this.newUniversityId = universityId;
    this.loadingPrograms = true;
    this.aspirationApi
      .listPrograms(universityId)
      .pipe(
        timeout(this.requestTimeoutMs),
        finalize(() => {
          this.loadingPrograms = false;
          this.markViewForCheck();
        })
      )
      .subscribe({
        next: (rows) => {
          this.newProgramOptions = rows || [];
          this.markViewForCheck();
        },
        error: (err: unknown) => {
          this.debugLoadError('读取专业列表失败', err);
          this.newProgramOptions = [];
          this.addDialogError = '读取专业列表失败。';
          this.markViewForCheck();
        },
      });
  }

  private matchesSearch(keyword: string, values: Array<string | null | undefined>): boolean {
    const normalizedKeyword = this.normalizeSearchText(keyword);
    if (!normalizedKeyword) return true;
    const compactKeyword = this.compactSearchText(keyword);
    return values.some((value) => {
      const text = String(value || '');
      return (
        this.normalizeSearchText(text).includes(normalizedKeyword) ||
        (!!compactKeyword && this.compactSearchText(text).includes(compactKeyword))
      );
    });
  }

  private normalizeSearchText(value: string): string {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private compactSearchText(value: string): string {
    return this.normalizeSearchText(value).replace(/\s+/g, '');
  }

  private loadDraftsFromAspirations(requestId: number): void {
    if (!this.isLatestDraftLoad(requestId)) return;
    this.loading = true;
    this.loadingMessage = '正在读取大学目标...';
    this.startDraftLoadWatchdog(requestId);
    this.aspirationApi
      .listAspirations(this.studentId)
      .pipe(
        timeout(this.requestTimeoutMs),
        finalize(() => this.finishDraftLoading(requestId))
      )
      .subscribe({
        next: (rows) => {
          if (!this.isLatestDraftLoad(requestId)) return;
          const drafts = (rows || [])
            .map((row, index) => this.createDraftFromAspiration(row, index))
            .filter((item): item is ApplicationDraft => item !== null);
          this.drafts = drafts;
          if (drafts.length === 0) {
            this.message = '暂无大学目标';
          }
          this.markViewForCheck();
        },
        error: (err: unknown) => {
          if (!this.isLatestDraftLoad(requestId)) return;
          this.debugLoadError('读取大学目标失败', err);
          this.error = this.resolveDraftLoadErrorMessage(
            err,
            '读取大学目标失败。'
          );
          this.drafts = [];
          this.markViewForCheck();
        },
      });
  }

  private startDraftLoadWatchdog(requestId: number): void {
    this.clearDraftLoadWatchdog();
    this.draftLoadWatchdog = setTimeout(() => {
      if (!this.isLatestDraftLoad(requestId) || !this.loading) return;
      this.loading = false;
      this.loadingMessage = '';
      this.error = '读取申请资料超时。请确认后端服务已启动，且当前老师有权限访问该学生。';
      this.debugLoadError('读取申请资料超时', { studentId: this.studentId });
      this.markViewForCheck();
    }, this.requestTimeoutMs + 1000);
  }

  private finishDraftLoading(requestId: number): void {
    if (!this.isLatestDraftLoad(requestId)) return;
    this.clearDraftLoadWatchdog();
    this.loading = false;
    this.loadingMessage = '';
    this.markViewForCheck();
  }

  private clearDraftLoadWatchdog(): void {
    if (this.draftLoadWatchdog === null) return;
    clearTimeout(this.draftLoadWatchdog);
    this.draftLoadWatchdog = null;
  }

  private isLatestDraftLoad(requestId: number): boolean {
    return requestId === this.draftLoadRequestId;
  }

  private debugLoadError(stage: string, error: unknown): void {
    console.warn(`[GraduationApplicationSetup] ${stage}`, error);
  }

  private markViewForCheck(): void {
    this.cdr.markForCheck();
  }

  private createDraftFromAspiration(
    aspiration: UniversityAspiration,
    index: number
  ): ApplicationDraft | null {
    const created = this.graduationStage.createFromAspiration(this.studentId, aspiration, index);
    return created ? { ...created, selected: true } : null;
  }

  private toRequest(draft: ApplicationDraft): GraduationApplicationRequest | null {
    const universityId = Math.trunc(Number(draft.universityId));
    const programId = Math.trunc(Number(draft.programId));
    if (!Number.isFinite(universityId) || universityId <= 0 || !Number.isFinite(programId) || programId <= 0) {
      return null;
    }
    return {
      universityId,
      programId,
      status: draft.status || 'PREPARING',
      sourceAspirationId: Number.isFinite(Number(draft.sourceAspirationId))
        ? Math.trunc(Number(draft.sourceAspirationId))
        : undefined,
    };
  }

  private extractErrorMessage(error: unknown): string {
    if (typeof error === 'string') return error;
    if (!error || typeof error !== 'object') return '';
    const source = error as { error?: unknown; message?: unknown };
    if (source.error && typeof source.error === 'object') {
      const nested = source.error as { message?: unknown; error?: unknown; details?: unknown };
      const detailText = Array.isArray(nested.details) ? nested.details.join('；') : '';
      return String(nested.message || nested.error || detailText || '').trim();
    }
    return String(source.message || source.error || '').trim();
  }

  private resolveDraftLoadErrorMessage(error: unknown, fallback: string): string {
    const source = error as { status?: unknown; error?: unknown; name?: unknown; message?: unknown } | null | undefined;
    const status = Number(source?.status);
    const code =
      source?.error && typeof source.error === 'object'
        ? String((source.error as { code?: unknown }).code || '')
        : '';
    const rawMessage = this.extractErrorMessage(error);

    if (source?.name === 'TimeoutError' || rawMessage === 'Timeout has occurred') {
      return '读取申请资料超时。请确认后端服务已启动，且当前老师有权限访问该学生。';
    }

    if (status === 403 || code === 'FORBIDDEN') {
      return '当前老师没有权限访问该学生。请从学生列表中的升学阶段入口进入，或确认该学生已分配给当前老师。';
    }

    return rawMessage || fallback;
  }
}
