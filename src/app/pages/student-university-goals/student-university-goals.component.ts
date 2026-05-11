import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import {
  University,
  UniversityAspiration,
  UniversityAspirationService,
  UniversityProgram,
} from '../../services/university-aspiration.service';
import { TranslatePipe } from '../../shared/i18n/translate.pipe';
import { LocalizedText, uiText } from '../../shared/i18n/ui-translations';

interface UniversityChoice {
  id: number;
  universityId: number;
  universityName: string;
  programId: number;
  programName: string;
  sortOrder: number;
}

interface ChoiceDraft {
  universityName: string;
  programName: string;
}

@Component({
  selector: 'app-student-university-goals',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './student-university-goals.component.html',
  styleUrl: './student-university-goals.component.scss',
})
export class StudentUniversityGoalsComponent implements OnInit {
  private readonly storagePrefix = 'university-goals-ouac-prototype';
  private readonly defaultStudentKey = 'prototype';

  readonly fallbackUniversities: University[] = [
    { id: 1, name: '模拟多伦多大学' },
    { id: 2, name: '模拟大学 A' },
    { id: 3, name: '模拟大学 B' },
    { id: 4, name: '模拟大学 C' },
  ];

  readonly fallbackPrograms: UniversityProgram[] = [
    { id: 101, universityId: 1, programName: 'Education Studies' },
    { id: 102, universityId: 1, programName: 'Child Development' },
    { id: 103, universityId: 1, programName: 'Teaching and Learning' },
    { id: 201, universityId: 2, programName: 'Primary Education' },
    { id: 202, universityId: 2, programName: 'Language Education' },
    { id: 301, universityId: 3, programName: 'Educational Psychology' },
    { id: 302, universityId: 3, programName: 'Special Education' },
    { id: 401, universityId: 4, programName: 'Curriculum Studies' },
    { id: 402, universityId: 4, programName: 'Early Childhood Education' },
  ];

  readonly ui = {
    title: uiText('大学目标', 'University Goals'),
    back: uiText('返回', 'Back'),
    loadingGoals: uiText('正在加载大学目标...', 'Loading university goals...'),
    choice: uiText('Choice', 'Choice'),
    dragToReorder: uiText('拖动排序', 'Drag to reorder'),
    program: uiText('专业', 'Program'),
    edit: uiText('修改', 'Edit'),
    delete: uiText('删除', 'Delete'),
    addGoal: uiText('添加大学目标', 'Add University Goal'),
    editGoal: uiText('修改大学目标', 'Edit University Goal'),
    university: uiText('大学', 'University'),
    universityPlaceholder: uiText('输入或选择大学', 'Type or select a university'),
    programPlaceholder: uiText('输入或选择专业', 'Type or select a program'),
    cancel: uiText('取消', 'Cancel'),
    save: uiText('保存', 'Save'),
    saving: uiText('保存中...', 'Saving...'),
    universityRequired: uiText('请选择大学。', 'Please select a university.'),
    programRequired: uiText('请选择该大学下的专业。', 'Please select a program under this university.'),
    goalSaved: uiText('已保存大学目标。', 'University goal saved.'),
    goalDeleted: uiText('已删除大学目标。', 'University goal deleted.'),
    orderSaved: uiText('顺序已保存。', 'Order saved.'),
    saveFailed: uiText('保存失败，请稍后再试。', 'Save failed. Please try again later.'),
    deleteFailed: uiText('删除失败，请稍后再试。', 'Delete failed. Please try again later.'),
    reorderFailed: uiText('保存顺序失败，请刷新后重试。', 'Failed to save order. Please refresh and try again.'),
    loadFailed: uiText('加载大学目标失败。', 'Failed to load university goals.'),
  };

  studentKey = this.defaultStudentKey;
  studentId: number | null = null;
  teacherMode = false;
  loading = false;
  saving = false;
  usingLocalDraft = false;
  universities: University[] = [];
  programsByUniversityId = new Map<number, UniversityProgram[]>();
  choices: UniversityChoice[] = [];
  draft: ChoiceDraft = this.createEmptyDraft();
  modalOpen = false;
  editingChoiceId: number | null = null;
  message: string | LocalizedText = '';
  error: string | LocalizedText = '';
  dragIndex: number | null = null;
  universitySuggestionsOpen = false;
  programSuggestionsOpen = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    private universityApi: UniversityAspirationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.resolveContext();
    this.loadCatalog();
    this.loadChoices();
  }

  get selectedUniversity(): University | null {
    const universityName = this.draft.universityName.trim();
    if (!universityName) return null;
    return (
      this.rankedUniversityMatches(universityName).find((item) =>
        this.isExactUniversityMatch(universityName, item)
      ) ?? null
    );
  }

  get visibleUniversities(): University[] {
    const keyword = this.draft.universityName.trim();
    if (!keyword) return this.universities;
    return this.rankedUniversityMatches(keyword);
  }

  get visiblePrograms(): UniversityProgram[] {
    const university = this.selectedUniversity;
    if (!university) return [];
    const keyword = this.draft.programName.trim();
    const programs = this.programsByUniversityId.get(university.id) ?? [];
    return programs.filter((item) => {
      return this.matchesSearch(keyword, [item.programName, item.facultyName, item.degreeType]);
    });
  }

  get selectedProgram(): UniversityProgram | null {
    const university = this.selectedUniversity;
    if (!university) return null;
    const programName = this.draft.programName.trim();
    if (!programName) return null;
    const normalizedProgramName = this.normalizeSearchText(programName);
    return (
      (this.programsByUniversityId.get(university.id) ?? []).find(
        (item) =>
          item.universityId === university.id &&
          this.normalizeSearchText(item.programName) === normalizedProgramName
      ) ?? null
    );
  }

  goBack(): void {
    this.router.navigate([this.teacherMode ? '/teacher/students' : '/dashboard']);
  }

  openModal(): void {
    this.draft = this.createEmptyDraft();
    this.editingChoiceId = null;
    this.message = '';
    this.error = '';
    this.universitySuggestionsOpen = false;
    this.programSuggestionsOpen = false;
    this.modalOpen = true;
  }

  openEditModal(choice: UniversityChoice): void {
    this.editingChoiceId = choice.id;
    this.draft = {
      universityName: choice.universityName,
      programName: choice.programName,
    };
    this.message = '';
    this.error = '';
    this.universitySuggestionsOpen = false;
    this.programSuggestionsOpen = false;
    this.modalOpen = true;
    this.ensureProgramsLoaded(choice.universityId);
  }

  closeModal(): void {
    if (this.saving) return;
    this.modalOpen = false;
    this.editingChoiceId = null;
    this.universitySuggestionsOpen = false;
    this.programSuggestionsOpen = false;
  }

  onUniversityInput(): void {
    this.draft.programName = '';
    const university = this.selectedUniversity;
    this.universitySuggestionsOpen = !!this.draft.universityName.trim() && !university;
    this.programSuggestionsOpen = !!university;
    if (university) {
      this.ensureProgramsLoaded(university.id);
    }
  }

  selectUniversity(university: University): void {
    this.draft.universityName = university.name;
    this.draft.programName = '';
    this.universitySuggestionsOpen = false;
    this.programSuggestionsOpen = true;
    this.ensureProgramsLoaded(university.id);
  }

  onProgramInput(): void {
    this.programSuggestionsOpen = !!this.selectedUniversity && !this.selectedProgram;
  }

  selectProgram(program: UniversityProgram): void {
    this.draft.programName = program.programName;
    this.programSuggestionsOpen = false;
  }

  addChoice(): void {
    const university = this.selectedUniversity;
    const program = this.selectedProgram;

    if (!university) {
      this.error = this.ui.universityRequired;
      return;
    }
    if (!program || program.universityId !== university.id) {
      this.error = this.ui.programRequired;
      return;
    }

    if (!this.studentId || this.usingLocalDraft) {
      this.saveLocalChoice(university, program);
      return;
    }

    this.saving = true;
    this.error = '';
    const payload = {
      universityId: university.id,
      programId: program.id,
    };
    const request = this.editingChoiceId
      ? this.universityApi.updateAspiration(this.editingChoiceId, payload)
      : this.universityApi.createAspiration(this.studentId, payload);

    request
      .pipe(finalize(() => {
        this.saving = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (saved) => {
          const savedChoice = this.toChoice(saved);
          this.choices = this.reorder(
            this.editingChoiceId
              ? this.choices.map((choice) => (choice.id === this.editingChoiceId ? savedChoice : choice))
              : [...this.choices, savedChoice]
          );
          this.modalOpen = false;
          this.editingChoiceId = null;
          this.message = this.ui.goalSaved;
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.extractErrorMessage(err) || this.ui.saveFailed;
        },
      });
  }

  removeChoice(choice: UniversityChoice): void {
    if (!this.studentId || this.usingLocalDraft) {
      this.choices = this.reorder(this.choices.filter((item) => item.id !== choice.id));
      this.saveLocalChoices();
      this.message = this.ui.goalDeleted;
      return;
    }

    this.saving = true;
    this.error = '';
    this.universityApi
      .deleteAspiration(choice.id)
      .pipe(finalize(() => {
        this.saving = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => {
          this.choices = this.reorder(this.choices.filter((item) => item.id !== choice.id));
          this.message = this.ui.goalDeleted;
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.extractErrorMessage(err) || this.ui.deleteFailed;
        },
      });
  }

  onDragStart(index: number): void {
    this.dragIndex = index;
  }

  onDragOver(event: DragEvent): void {
    if (this.dragIndex === null || this.saving) return;
    event.preventDefault();
  }

  onDrop(targetIndex: number): void {
    const sourceIndex = this.dragIndex;
    this.dragIndex = null;
    if (sourceIndex === null || sourceIndex === targetIndex || this.saving) return;

    const next = [...this.choices];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    this.choices = this.reorder(next);

    if (!this.studentId || this.usingLocalDraft) {
      this.saveLocalChoices();
      this.message = this.ui.orderSaved;
      return;
    }

    this.saving = true;
    this.error = '';
    this.universityApi
      .reorderAspirations(
        this.studentId,
        this.choices.map((choice) => ({ id: choice.id, sortOrder: choice.sortOrder }))
      )
      .pipe(finalize(() => {
        this.saving = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (rows) => {
          this.choices = this.reorder(rows.map((row) => this.toChoice(row)));
          this.message = this.ui.orderSaved;
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.extractErrorMessage(err) || this.ui.reorderFailed;
          this.loadChoices();
        },
      });
  }

  onDragEnd(): void {
    this.dragIndex = null;
  }

  trackChoice(_index: number, choice: UniversityChoice): number {
    return choice.id;
  }

  private resolveContext(): void {
    const routeStudentId = Number(this.route.snapshot.paramMap.get('studentId'));
    if (Number.isFinite(routeStudentId) && routeStudentId > 0) {
      this.teacherMode = true;
      this.studentId = Math.trunc(routeStudentId);
      this.studentKey = String(this.studentId);
      return;
    }

    const sessionStudentId = Number(this.auth.getSession()?.studentId);
    if (Number.isFinite(sessionStudentId) && sessionStudentId > 0) {
      this.studentId = Math.trunc(sessionStudentId);
      this.studentKey = String(this.studentId);
      return;
    }

    this.studentKey = this.defaultStudentKey;
    this.usingLocalDraft = true;
  }

  private loadCatalog(): void {
    this.universities = this.fallbackUniversities;
    for (const program of this.fallbackPrograms) {
      const universityId = Number(program.universityId);
      this.programsByUniversityId.set(universityId, [
        ...(this.programsByUniversityId.get(universityId) ?? []),
        program,
      ]);
    }

    this.universityApi.listUniversities().subscribe({
      next: (rows) => {
        if (!Array.isArray(rows) || rows.length === 0) return;
        this.universities = rows;
        this.programsByUniversityId.clear();
        for (const university of rows.slice(0, 8)) {
          this.ensureProgramsLoaded(university.id);
        }
      },
      error: () => {
        this.usingLocalDraft = !this.studentId;
      },
    });
  }

  private loadChoices(): void {
    if (!this.studentId) {
      this.loadLocalChoices();
      return;
    }

    this.loading = true;
    this.error = '';
    this.universityApi
      .listAspirations(this.studentId)
      .pipe(finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (rows) => {
          this.choices = this.reorder((rows || []).map((row) => this.toChoice(row)));
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.extractErrorMessage(err) || this.ui.loadFailed;
          this.usingLocalDraft = true;
          this.loadLocalChoices();
        },
      });
  }

  private ensureProgramsLoaded(universityId: number): void {
    if (!Number.isFinite(universityId) || universityId <= 0 || this.programsByUniversityId.has(universityId)) {
      return;
    }

    this.universityApi.listPrograms(universityId).subscribe({
      next: (rows) => {
        this.programsByUniversityId.set(universityId, Array.isArray(rows) ? rows : []);
        this.cdr.detectChanges();
      },
      error: () => {
        this.programsByUniversityId.set(universityId, []);
      },
    });
  }

  private saveLocalChoice(university: University, program: UniversityProgram): void {
    if (this.editingChoiceId) {
      this.choices = this.reorder(
        this.choices.map((choice) =>
          choice.id === this.editingChoiceId
            ? {
                ...choice,
                universityId: university.id,
                universityName: university.name,
                programId: program.id,
                programName: program.programName,
              }
            : choice
        )
      );
      this.saveLocalChoices();
      this.modalOpen = false;
      this.editingChoiceId = null;
      this.message = this.ui.goalSaved;
      return;
    }

    const nextChoice: UniversityChoice = {
      id: Date.now(),
      universityId: university.id,
      universityName: university.name,
      programId: program.id,
      programName: program.programName,
      sortOrder: this.choices.length + 1,
    };

    this.choices = this.reorder([...this.choices, nextChoice]);
    this.saveLocalChoices();
    this.modalOpen = false;
    this.editingChoiceId = null;
    this.message = this.ui.goalSaved;
  }

  private loadLocalChoices(): void {
    const raw = window.localStorage.getItem(this.storageKey());
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as UniversityChoice[];
        if (Array.isArray(parsed)) {
          this.choices = this.reorder(parsed);
          return;
        }
      } catch {
        this.choices = [];
      }
    }

    this.choices = this.createStarterChoices();
    this.saveLocalChoices();
  }

  private saveLocalChoices(): void {
    window.localStorage.setItem(this.storageKey(), JSON.stringify(this.choices));
  }

  private createStarterChoices(): UniversityChoice[] {
    return [
      {
        id: 1001,
        universityId: 1,
        universityName: '模拟多伦多大学',
        programId: 101,
        programName: 'Education Studies',
        sortOrder: 1,
      },
      {
        id: 1002,
        universityId: 2,
        universityName: '模拟大学 A',
        programId: 201,
        programName: 'Primary Education',
        sortOrder: 2,
      },
    ];
  }

  private toChoice(row: UniversityAspiration): UniversityChoice {
    return {
      id: Number(row.aspirationId ?? row.id),
      universityId: Number(row.universityId),
      universityName: String(row.universityName || ''),
      programId: Number(row.programId),
      programName: String(row.programName || ''),
      sortOrder: Number(row.sortOrder || 0),
    };
  }

  private reorder(items: UniversityChoice[]): UniversityChoice[] {
    return items
      .filter((item) => Number.isFinite(item.id) && item.id > 0)
      .map((item, index) => ({
        ...item,
        sortOrder: index + 1,
      }));
  }

  private createEmptyDraft(): ChoiceDraft {
    return {
      universityName: '',
      programName: '',
    };
  }

  private storageKey(): string {
    return `${this.storagePrefix}-${this.studentKey}`;
  }

  private universitySearchValues(university: University): Array<string | null | undefined> {
    const name = university.name || '';
    return [
      name,
      university.city,
      university.province,
      university.country,
      university.website,
      ...this.generatedUniversityAliases(name),
      ...this.knownUniversityAliases(name),
    ];
  }

  private rankedUniversityMatches(query: string): University[] {
    return this.universities
      .filter((item) => this.matchesSearch(query, this.universitySearchValues(item)))
      .sort((left, right) => {
        const scoreDiff = this.universityMatchScore(query, right) - this.universityMatchScore(query, left);
        if (scoreDiff !== 0) return scoreDiff;
        return String(left.name || '').localeCompare(String(right.name || ''));
      });
  }

  private isExactUniversityMatch(query: string, university: University): boolean {
    const normalizedQuery = this.normalizeSearchText(query);
    const compactQuery = this.compactSearchText(query);
    return this.universitySearchValues(university).some((value) => {
      const normalizedValue = this.normalizeSearchText(value);
      return normalizedValue === normalizedQuery || this.compactSearchText(normalizedValue) === compactQuery;
    });
  }

  private universityMatchScore(query: string, university: University): number {
    const normalizedQuery = this.normalizeSearchText(query);
    const compactQuery = this.compactSearchText(query);
    const normalizedName = this.normalizeSearchText(university.name);
    const compactName = this.compactSearchText(university.name);
    const aliases = this.knownUniversityAliases(university.name || '');
    const generatedAliases = this.generatedUniversityAliases(university.name || '');
    const aliasValues = [...aliases, ...generatedAliases];
    const exactAlias = aliasValues.some((alias) => {
      const normalizedAlias = this.normalizeSearchText(alias);
      return normalizedAlias === normalizedQuery || this.compactSearchText(normalizedAlias) === compactQuery;
    });

    let score = 0;
    if (normalizedName === normalizedQuery || compactName === compactQuery) score += 1000;
    if (exactAlias) score += 850;
    if (normalizedName.startsWith(normalizedQuery) || compactName.startsWith(compactQuery)) score += 350;
    if (normalizedName.includes(normalizedQuery) || compactName.includes(compactQuery)) score += 200;
    score += this.universityCampusPriority(university);
    return score;
  }

  private universityCampusPriority(university: University): number {
    const name = this.normalizeSearchText(university.name);
    if (name === 'university of toronto st george campus') return 80;
    if (name === 'university of toronto mississauga') return 50;
    if (name === 'university of toronto scarborough') return 40;
    return 0;
  }

  private generatedUniversityAliases(name: string): string[] {
    const normalizedName = this.normalizeSearchText(name);
    const compactName = this.compactSearchText(name);
    const words = normalizedName
      .split(' ')
      .filter((word) => word && !['and', 'at', 'de', 'of', 'the'].includes(word));
    const acronym = words.map((word) => word[0]).join('');
    const withoutUniversity = normalizedName
      .replace(/\buniversity\b/g, '')
      .replace(/\bcampus\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return Array.from(new Set([acronym, compactName, withoutUniversity])).filter(Boolean);
  }

  private knownUniversityAliases(name: string): string[] {
    const key = this.normalizeSearchText(name);
    const aliases: Record<string, string[]> = {
      'university of toronto st george campus': [
        'uoft',
        'u of t',
        'university of toronto',
        'utsg',
        'st george',
        'saint george',
        'toronto st george',
        'u toronto',
        'toronto main campus',
        'uoft main campus',
      ],
      'university of toronto mississauga': ['uoft', 'u of t', 'utm', 'uoft mississauga', 'u of t mississauga'],
      'university of toronto scarborough': ['uoft', 'u of t', 'utsc', 'uoft scarborough', 'u of t scarborough'],
      'university of waterloo': ['uw', 'u waterloo', 'waterloo'],
      'western university': ['western', 'uwo', 'western u', 'university of western ontario'],
      'mcmaster university': ['mac', 'macmaster', 'mcmaster', 'mcmaster u'],
      'queen s university': ['queens', "queen's", 'queens u'],
      'university of british columbia': ['ubc'],
      'simon fraser university': ['sfu'],
      'university of victoria': ['uvic'],
      'university of alberta': ['ualberta', 'uofa', 'u of a'],
      'university of calgary': ['ucalgary', 'uofc', 'u of c'],
      'university of ottawa': ['uottawa', 'u of o'],
      'carleton university': ['carleton', 'cu'],
      'york university': ['york', 'yorku'],
      'toronto metropolitan university': ['tmu', 'ryerson'],
      'wilfrid laurier university': ['laurier', 'wlu'],
      'university of guelph': ['guelph', 'uog'],
      'brock university': ['brock'],
      'trent university': ['trent'],
      'ontario tech university': ['ontario tech', 'uoit'],
      'university of windsor': ['uwindsor', 'windsor'],
      'lakehead university': ['lakehead'],
      'laurentian university': ['laurentian'],
      'nipissing university': ['nipissing'],
      'ocad university': ['ocad'],
      'emily carr university of art and design': ['ecuad', 'emily carr'],
      'concordia university': ['concordia'],
      'mcgill university': ['mcgill'],
      'university of montreal': ['udem', 'montreal', 'universite de montreal'],
      'university of laval': ['laval', 'ulaval'],
    };

    return aliases[key] ?? [];
  }

  private matchesSearch(query: string, values: Array<string | null | undefined>): boolean {
    const tokens = this.searchTokens(query);
    if (tokens.length === 0) return true;

    const normalizedValues = values.map((value) => this.normalizeSearchText(value)).filter(Boolean);
    const joined = normalizedValues.join(' ');
    const compactJoined = this.compactSearchText(joined);

    return tokens.every((token) => {
      const normalizedToken = this.normalizeSearchText(token);
      const compactToken = this.compactSearchText(normalizedToken);
      return (
        joined.includes(normalizedToken) ||
        compactJoined.includes(compactToken) ||
        normalizedValues.some((value) => value.includes(normalizedToken))
      );
    });
  }

  private searchTokens(value: string | null | undefined): string[] {
    return this.normalizeSearchText(value).split(' ').filter(Boolean);
  }

  private normalizeSearchText(value: string | null | undefined): string {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private compactSearchText(value: string | null | undefined): string {
    return this.normalizeSearchText(value).replace(/\s+/g, '');
  }

  private extractErrorMessage(error: HttpErrorResponse): string {
    const body = error?.error;
    if (typeof body === 'string') return body;
    if (body?.message) return String(body.message);
    if (body?.error) return String(body.error);
    return '';
  }
}
