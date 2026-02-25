import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import {
  StudentProfilePayload,
  StudentProfileService,
} from '../../services/student-profile.service';

type Gender = '' | 'Male' | 'Female' | 'Other';

type SchoolType = '' | 'MAIN' | 'OTHER';

interface AddressModel {
  streetAddress: string;
  streetAddressLine2: string;
  city: string;
  state: string;
  country: string;
  postal: string;
}

interface HighSchoolModel {
  schoolType: SchoolType;
  schoolName: string;
  startTime: string;
  endTime: string;
}

interface ExternalCourseModel {
  schoolName: string;
  courseCode: string;
  mark: number | null;
  gradeLevel: number | null;
  startTime: string;
  endTime: string;
}

interface StudentProfileModel {
  legalFirstName: string;
  legalLastName: string;
  preferredName: string;
  gender: Gender;
  birthday: string;
  phone: string;
  email: string;

  statusInCanada: string;
  citizenship: string;
  firstLanguage: string;
  firstBoardingDate: string;

  address: AddressModel;

  oenNumber: string;
  ib: string;
  ap: boolean;

  identityFileNote: string;

  highSchools: HighSchoolModel[];
  externalCourses: ExternalCourseModel[];
}

interface SaveOptions {
  exitEditMode?: boolean;
  skipIfUnchanged?: boolean;
  showSavedFeedback?: boolean;
  syncModelOnSuccess?: boolean;
  background?: boolean;
}

@Component({
  selector: 'app-student-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './student-profile.html',
})
export class StudentProfile implements OnInit {
  readonly statusInCanadaPresetOptions: string[] = [
    '留学生(Study permit)',
    '移民(Permanent residence)',
    '公民(Citizen)',
    '难民(Refugee)',
    '外交(Diplomatic)',
    '访问(Visitor)',
  ];
  readonly statusInCanadaOtherOptionValue = '__OTHER__';

  statusInCanadaSelection = '';
  statusInCanadaOtherText = '';

  managedMode = false;
  managedStudentId: number | null = null;
  invalidManagedStudentId = false;

  loading = false;
  saving = false;
  saved = false;
  error = '';
  editing = false;

  model: StudentProfileModel = this.defaultModel();
  private lastSavedPayloadDigest = '';
  private pendingAutoSave = false;
  private saveInProgress = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private profileApi: StudentProfileService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params: ParamMap) => {
      this.applyRouteContext(params);
    });
  }

  back(): void {
    this.router.navigate([this.managedMode ? '/teacher/students' : '/dashboard']);
  }

  enterEditMode(): void {
    if (this.invalidManagedStudentId || this.loading || this.saving) return;

    this.syncStatusInCanadaControls();
    this.saved = false;
    this.error = '';
    this.editing = true;
    this.cdr.detectChanges();
  }

  onFormFocusOut(event: FocusEvent): void {
    if (!this.editing || this.loading || this.invalidManagedStudentId) return;
    if (!this.shouldAutoSaveTarget(event.target)) return;

    this.triggerAutoSave();
  }

  onStatusInCanadaSelectionChange(value: string): void {
    this.statusInCanadaSelection = String(value ?? '');
    if (this.statusInCanadaSelection === this.statusInCanadaOtherOptionValue) {
      this.model.statusInCanada = this.toText(this.statusInCanadaOtherText);
      return;
    }

    this.statusInCanadaOtherText = '';
    this.model.statusInCanada = this.toText(this.statusInCanadaSelection);
  }

  onStatusInCanadaOtherTextChange(value: string): void {
    this.statusInCanadaOtherText = String(value ?? '');
    if (this.statusInCanadaSelection !== this.statusInCanadaOtherOptionValue) return;

    this.model.statusInCanada = this.toText(this.statusInCanadaOtherText);
  }

  displayText(value: unknown): string {
    const text = this.toText(value);
    return text || '-';
  }

  displayNumber(value: number | null | undefined): string {
    if (value === null || value === undefined) return '-';
    return String(value);
  }

  displayBoolean(value: boolean): string {
    return value ? '是' : '否';
  }

  displaySchoolType(value: SchoolType): string {
    if (value === 'MAIN') return '主读学校（MAIN）';
    if (value === 'OTHER') return '其他学校（OTHER）';
    return '-';
  }

  addHighSchool(): void {
    this.model.highSchools.push({
      schoolType: '',
      schoolName: '',
      startTime: '',
      endTime: '',
    });
  }

  removeHighSchool(index: number): void {
    this.model.highSchools.splice(index, 1);
    this.triggerAutoSave();
  }

  addExternalCourse(): void {
    this.model.externalCourses.push({
      schoolName: '',
      courseCode: '',
      mark: null,
      gradeLevel: null,
      startTime: '',
      endTime: '',
    });
  }

  removeExternalCourse(index: number): void {
    this.model.externalCourses.splice(index, 1);
    this.triggerAutoSave();
  }

  loadProfile(): void {
    if (this.invalidManagedStudentId) return;
    if (this.loading) return;

    this.loading = true;
    this.error = '';
    this.saved = false;
    this.cdr.detectChanges();

    const request$ =
      this.managedMode && this.managedStudentId
        ? this.profileApi.getStudentProfileForTeacher(this.managedStudentId)
        : this.profileApi.getMyProfile();

    request$
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (resp) => {
          this.model = this.normalizeModel(this.unwrapProfile(resp));
          this.syncStatusInCanadaControls();
          this.lastSavedPayloadDigest = this.buildPayloadDigest(this.model);
          this.pendingAutoSave = false;
          this.editing = false;
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.extractErrorMessage(err) || '加载档案失败。';
          this.cdr.detectChanges();
        },
      });
  }

  save(options: SaveOptions = {}): void {
    const exitEditMode = options.exitEditMode ?? true;
    const skipIfUnchanged = options.skipIfUnchanged ?? false;
    const showSavedFeedback = options.showSavedFeedback ?? true;
    const syncModelOnSuccess = options.syncModelOnSuccess ?? true;
    const background = options.background ?? false;
    if (this.invalidManagedStudentId || (this.managedMode && !this.managedStudentId)) {
      this.error = '路由中的学生 ID 无效。';
      this.cdr.detectChanges();
      return;
    }
    const payload = this.toPayload(this.model);
    const payloadDigest = JSON.stringify(payload);

    if (skipIfUnchanged && payloadDigest === this.lastSavedPayloadDigest) {
      this.pendingAutoSave = false;
      return;
    }

    if (this.saveInProgress || this.loading) {
      if (background) {
        this.pendingAutoSave = true;
      }
      return;
    }

    if (!background) {
      this.error = '';
      if (showSavedFeedback) {
        this.saved = false;
      }
    }
    this.pendingAutoSave = false;
    this.saveInProgress = true;
    if (!background) {
      this.saving = true;
      this.cdr.detectChanges();
    }

    const request$ =
      this.managedMode && this.managedStudentId
        ? this.profileApi.saveStudentProfileForTeacher(this.managedStudentId, payload)
        : this.profileApi.saveMyProfile(payload);

    request$
      .pipe(
        finalize(() => {
          this.saveInProgress = false;
          if (!background) {
            this.saving = false;
          }
          const shouldRunPendingAutoSave = this.pendingAutoSave && this.editing;
          this.pendingAutoSave = false;
          if (!background) {
            this.cdr.detectChanges();
          }

          if (shouldRunPendingAutoSave) {
            this.triggerAutoSave();
          }
        })
      )
      .subscribe({
        next: (resp) => {
          if (syncModelOnSuccess) {
            const resolved = this.unwrapProfile(resp);
            const hasResolvedData = Object.keys(resolved).length > 0;
            this.model = this.normalizeModel(hasResolvedData ? resolved : payload);
          }

          this.syncStatusInCanadaControls();
          this.lastSavedPayloadDigest = this.buildPayloadDigest(this.model);
          if (showSavedFeedback) {
            this.saved = true;
          }
          if (exitEditMode) {
            this.editing = false;
          }
          if (!background) {
            this.cdr.detectChanges();
          }
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.extractErrorMessage(err) || '保存档案失败。';
          this.cdr.detectChanges();
        },
      });
  }

  private triggerAutoSave(): void {
    if (!this.editing || this.loading || this.invalidManagedStudentId) {
      this.pendingAutoSave = false;
      return;
    }

    this.save({
      exitEditMode: false,
      skipIfUnchanged: true,
      showSavedFeedback: false,
      syncModelOnSuccess: false,
      background: true,
    });
  }

  private shouldAutoSaveTarget(target: EventTarget | null): boolean {
    if (!target) return false;

    if (target instanceof HTMLInputElement) {
      const type = String(target.type || '')
        .trim()
        .toLowerCase();
      if (type === 'button' || type === 'submit' || type === 'reset') return false;
      return true;
    }

    return target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
  }

  private buildPayloadDigest(model: StudentProfileModel): string {
    return JSON.stringify(this.toPayload(model));
  }

  private syncStatusInCanadaControls(): void {
    const currentValue = this.toText(this.model.statusInCanada);
    if (!currentValue) {
      this.statusInCanadaSelection = '';
      this.statusInCanadaOtherText = '';
      return;
    }

    if (this.statusInCanadaPresetOptions.includes(currentValue)) {
      this.statusInCanadaSelection = currentValue;
      this.statusInCanadaOtherText = '';
      return;
    }

    this.statusInCanadaSelection = this.statusInCanadaOtherOptionValue;
    this.statusInCanadaOtherText = currentValue;
  }

  private applyRouteContext(params: ParamMap): void {
    const routeStudentId = params.get('studentId');
    if (routeStudentId === null) {
      this.managedMode = false;
      this.managedStudentId = null;
      this.invalidManagedStudentId = false;
      this.editing = false;
      this.pendingAutoSave = false;
      this.loadProfile();
      return;
    }

    this.managedMode = true;
    const parsedStudentId = Number(routeStudentId);
    if (!Number.isInteger(parsedStudentId) || parsedStudentId <= 0) {
      this.managedStudentId = null;
      this.invalidManagedStudentId = true;
      this.model = this.defaultModel();
      this.syncStatusInCanadaControls();
      this.loading = false;
      this.saved = false;
      this.editing = false;
      this.pendingAutoSave = false;
      this.lastSavedPayloadDigest = '';
      this.error = '路由中的学生 ID 无效。';
      this.cdr.detectChanges();
      return;
    }

    this.managedStudentId = parsedStudentId;
    this.invalidManagedStudentId = false;
    this.editing = false;
    this.pendingAutoSave = false;
    this.loadProfile();
  }

  private defaultModel(): StudentProfileModel {
    return {
      legalFirstName: '',
      legalLastName: '',
      preferredName: '',
      gender: '',
      birthday: '',
      phone: '',
      email: '',

      statusInCanada: '',
      citizenship: '',
      firstLanguage: '',
      firstBoardingDate: '',

      address: {
        streetAddress: '',
        streetAddressLine2: '',
        city: '',
        state: '',
        country: 'Canada',
        postal: '',
      },

      oenNumber: '',
      ib: '',
      ap: false,
      identityFileNote: '',
      highSchools: [],
      externalCourses: [],
    };
  }

  private unwrapProfile(
    payload: StudentProfilePayload | { profile?: StudentProfilePayload } | null | undefined
  ): StudentProfilePayload {
    if (payload && typeof payload === 'object' && payload.profile && typeof payload.profile === 'object') {
      return payload.profile;
    }
    return (payload || {}) as StudentProfilePayload;
  }

  private normalizeModel(payload: StudentProfilePayload): StudentProfileModel {
    const defaults = this.defaultModel();
    const source: any = payload || {};
    const rawAddress = source.address && typeof source.address === 'object' ? source.address : {};
    const rawCourses = this.resolveExternalCourses(source);
    const rawSchools = this.resolveSchoolRecords(source, rawCourses);

    return {
      legalFirstName: this.toText(source.legalFirstName || source.firstName),
      legalLastName: this.toText(source.legalLastName || source.lastName),
      preferredName: this.toText(source.preferredName || source.nickName),
      gender: this.normalizeGender(source.gender),
      birthday: this.normalizeDate(source.birthday),
      phone: this.toText(source.phone),
      email: this.toText(source.email),

      statusInCanada: this.toText(source.statusInCanada),
      citizenship: this.toText(source.citizenship),
      firstLanguage: this.toText(source.firstLanguage),
      firstBoardingDate: this.normalizeDate(source.firstBoardingDate),

      address: {
        streetAddress: this.toText(rawAddress.streetAddress),
        streetAddressLine2: this.toText(rawAddress.streetAddressLine2),
        city: this.toText(rawAddress.city),
        state: this.toText(rawAddress.state),
        country: this.toText(rawAddress.country || defaults.address.country),
        postal: this.toText(rawAddress.postal),
      },

      oenNumber: this.toText(source.oenNumber),
      ib: this.toText(source.ib),
      ap: this.toBoolean(source.ap),
      identityFileNote: this.toText(source.identityFileNote),

      highSchools: rawSchools.map((school: unknown) => this.normalizeHighSchool(school)),
      externalCourses: rawCourses.map((course: unknown) => this.normalizeExternalCourse(course)),
    };
  }

  private normalizeHighSchool(value: unknown): HighSchoolModel {
    const source: any = value && typeof value === 'object' ? value : {};
    const schoolTypeRaw = String(source.schoolType || '')
      .trim()
      .toUpperCase();
    const schoolType: SchoolType = schoolTypeRaw === 'MAIN' || schoolTypeRaw === 'OTHER' ? schoolTypeRaw : '';

    return {
      schoolType,
      schoolName: this.toText(source.schoolName),
      startTime: this.normalizeDate(source.startTime),
      endTime: this.normalizeDate(source.endTime),
    };
  }

  private normalizeExternalCourse(value: unknown): ExternalCourseModel {
    const source: any = value && typeof value === 'object' ? value : {};

    return {
      schoolName: this.toText(source.schoolName),
      courseCode: this.toText(source.courseCode),
      mark: this.toOptionalNumber(source.mark),
      gradeLevel: this.toOptionalNumber(source.gradeLevel),
      startTime: this.normalizeDate(source.startTime),
      endTime: this.normalizeDate(source.endTime),
    };
  }

  private toPayload(model: StudentProfileModel): StudentProfilePayload {
    return {
      legalFirstName: this.toText(model.legalFirstName),
      legalLastName: this.toText(model.legalLastName),
      preferredName: this.toText(model.preferredName),
      gender: model.gender,
      birthday: this.normalizeDate(model.birthday),
      phone: this.toText(model.phone),
      email: this.toText(model.email),
      statusInCanada: this.toText(model.statusInCanada),
      citizenship: this.toText(model.citizenship),
      firstLanguage: this.toText(model.firstLanguage),
      firstBoardingDate: this.normalizeDate(model.firstBoardingDate),
      address: {
        streetAddress: this.toText(model.address.streetAddress),
        streetAddressLine2: this.toText(model.address.streetAddressLine2),
        city: this.toText(model.address.city),
        state: this.toText(model.address.state),
        country: this.toText(model.address.country),
        postal: this.toText(model.address.postal),
      },
      oenNumber: this.toText(model.oenNumber),
      ib: this.toText(model.ib),
      ap: !!model.ap,
      identityFileNote: this.toText(model.identityFileNote),
      schools: model.highSchools.map((school) => ({
        schoolType: school.schoolType || undefined,
        schoolName: this.toText(school.schoolName),
        startTime: this.normalizeDate(school.startTime),
        endTime: this.normalizeDate(school.endTime),
      })),
      otherCourses: model.externalCourses.map((course) => ({
        // 校外课程固定按 OTHER 提交，避免和高中学校经历混淆
        schoolType: 'OTHER',
        schoolName: this.toText(course.schoolName),
        courseCode: this.toText(course.courseCode),
        mark: this.toOptionalNumber(course.mark),
        gradeLevel: this.toOptionalNumber(course.gradeLevel),
        startTime: this.normalizeDate(course.startTime),
        endTime: this.normalizeDate(course.endTime),
      })),
    };
  }

  private resolveExternalCourses(source: any): unknown[] {
    if (Array.isArray(source?.otherCourses)) {
      return source.otherCourses;
    }
    if (Array.isArray(source?.externalCourses)) {
      return source.externalCourses;
    }
    return [];
  }

  private resolveSchoolRecords(source: any, rawCourses: unknown[]): unknown[] {
    if (Array.isArray(source?.schools)) {
      return source.schools;
    }
    if (Array.isArray(source?.schoolRecords)) {
      return source.schoolRecords;
    }

    // 向后兼容：老数据可能把学校信息混在 otherCourses 里
    const unique = new Map<string, HighSchoolModel>();
    for (const item of rawCourses) {
      const sourceItem: any = item && typeof item === 'object' ? item : {};
      const schoolName = this.toText(sourceItem.schoolName);
      const schoolTypeRaw = String(sourceItem.schoolType || '')
        .trim()
        .toUpperCase();
      const schoolType: SchoolType = schoolTypeRaw === 'MAIN' || schoolTypeRaw === 'OTHER' ? schoolTypeRaw : '';

      if (!schoolName && !schoolType) continue;

      const startTime = this.normalizeDate(sourceItem.startTime);
      const endTime = this.normalizeDate(sourceItem.endTime);
      const key = `${schoolType}|${schoolName}|${startTime}|${endTime}`;
      if (unique.has(key)) continue;

      unique.set(key, {
        schoolType,
        schoolName,
        startTime,
        endTime,
      });
    }

    return Array.from(unique.values());
  }

  private normalizeGender(value: unknown): Gender {
    const normalized = this.toText(value).toLowerCase();
    if (normalized === 'male') return 'Male';
    if (normalized === 'female') return 'Female';
    if (normalized === 'other') return 'Other';
    return '';
  }

  private toOptionalNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toText(value: unknown): string {
    return String(value ?? '').trim();
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  private normalizeDate(value: unknown): string {
    const text = this.toText(value);
    if (!text) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

    const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : text;
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    const payload = err?.error;

    if (payload && typeof payload === 'object') {
      return String((payload as any).message || (payload as any).error || '');
    }

    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        return String(parsed?.message || parsed?.error || payload);
      } catch {
        return payload;
      }
    }

    return err?.message || '';
  }
}
