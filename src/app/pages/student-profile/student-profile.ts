import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { forkJoin } from 'rxjs';

import {
  CanadianHighSchoolLookupItem,
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
  streetAddress: string;
  city: string;
  state: string;
  country: string;
  postal: string;
  startTime: string;
  endTime: string;
}

interface ExternalCourseModel {
  schoolName: string;
  streetAddress: string;
  city: string;
  state: string;
  country: string;
  postal: string;
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

const PRIORITY_CITIZENSHIP_OPTIONS = ['中国', '加拿大', '美国', '中国台湾', '中国香港'] as const;

const FALLBACK_CITIZENSHIP_OPTIONS = [
  'China',
  'Canada',
  'United States',
  'United Kingdom',
  'Australia',
  'New Zealand',
  'Japan',
  'South Korea',
  'Singapore',
  'India',
  'France',
  'Germany',
  'Italy',
  'Spain',
  'Netherlands',
  'Switzerland',
  'Sweden',
  'Norway',
  'Denmark',
  'Finland',
  'Ireland',
  'Belgium',
  'Austria',
  'Portugal',
  'Mexico',
  'Brazil',
  'Argentina',
  'Chile',
  'South Africa',
  'Egypt',
  'Saudi Arabia',
  'United Arab Emirates',
] as const;

const PRIORITY_FIRST_LANGUAGE_OPTIONS = [
  '\u4e2d\u6587',
  '\u82f1\u8bed',
  '\u6cd5\u8bed',
  '\u65e5\u8bed',
  '\u97e9\u8bed',
] as const;

const LANGUAGE_CODE_OPTIONS = [
  'zh',
  'en',
  'fr',
  'ja',
  'ko',
  'es',
  'de',
  'it',
  'pt',
  'ru',
  'ar',
  'hi',
  'vi',
  'th',
  'id',
  'ms',
  'tr',
  'nl',
  'sv',
  'no',
  'da',
  'fi',
  'pl',
  'uk',
  'he',
  'fa',
] as const;

const FALLBACK_FIRST_LANGUAGE_OPTIONS = [
  'Chinese',
  'English',
  'French',
  'Japanese',
  'Korean',
  'Spanish',
  'German',
  'Italian',
  'Portuguese',
  'Russian',
  'Arabic',
  'Hindi',
  'Vietnamese',
  'Thai',
  'Indonesian',
  'Malay',
  'Turkish',
  'Dutch',
  'Swedish',
  'Norwegian',
  'Danish',
  'Finnish',
  'Polish',
  'Ukrainian',
  'Hebrew',
  'Persian',
] as const;

const PRIORITY_CITY_OPTIONS = [
  'Toronto',
  'North York',
  'Scarborough',
  'Etobicoke',
  'Markham',
  'Richmond Hill',
  'Vaughan',
  'Mississauga',
  'Brampton',
  'Oakville',
  'Burlington',
  'Ajax',
  'Pickering',
  'Whitby',
  'Oshawa',
  'Aurora',
  'Newmarket',
  'Milton',
  'Caledon',
] as const;

const FALLBACK_CITY_OPTIONS = [
  'Ottawa',
  'Hamilton',
  'Kitchener',
  'Waterloo',
  'Cambridge',
  'Guelph',
  'London',
  'Windsor',
  'Kingston',
  'Barrie',
  'Peterborough',
  'Niagara Falls',
  'St. Catharines',
  'Thunder Bay',
  'Sudbury',
  'Sault Ste. Marie',
  'North Bay',
  'Montreal',
  'Quebec City',
  'Laval',
  'Longueuil',
  'Sherbrooke',
  'Trois-Rivieres',
  'Vancouver',
  'Burnaby',
  'Surrey',
  'Richmond',
  'Coquitlam',
  'Langley',
  'Abbotsford',
  'Kelowna',
  'Victoria',
  'Nanaimo',
  'Prince George',
  'Kamloops',
  'Calgary',
  'Edmonton',
  'Red Deer',
  'Lethbridge',
  'Winnipeg',
  'Regina',
  'Saskatoon',
  'Halifax',
  "St. John's",
  'Moncton',
  'Fredericton',
  'Charlottetown',
  'Whitehorse',
  'Yellowknife',
  'Iqaluit',
] as const;

const PRIORITY_PROVINCE_OPTIONS = ['Ontario'] as const;

const FALLBACK_PROVINCE_OPTIONS = [
  'Quebec',
  'British Columbia',
  'Alberta',
  'Manitoba',
  'Saskatchewan',
  'Nova Scotia',
  'New Brunswick',
  'Newfoundland and Labrador',
  'Prince Edward Island',
  'Northwest Territories',
  'Yukon',
  'Nunavut',
] as const;

const PRIORITY_COUNTRY_OPTIONS = ['Canada', 'China', 'United States'] as const;

const FALLBACK_COUNTRY_OPTIONS = [
  'United Kingdom',
  'Australia',
  'New Zealand',
  'Japan',
  'South Korea',
  'Singapore',
  'India',
  'France',
  'Germany',
  'Italy',
  'Spain',
  'Netherlands',
  'Switzerland',
  'Sweden',
  'Norway',
  'Denmark',
  'Finland',
  'Ireland',
  'Belgium',
  'Austria',
  'Portugal',
  'Mexico',
  'Brazil',
  'Argentina',
  'Chile',
  'South Africa',
  'Egypt',
  'Saudi Arabia',
  'United Arab Emirates',
] as const;

const COUNTRY_STANDARD_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ['canada', 'Canada'],
  ['\u52a0\u62ff\u5927', 'Canada'],
  ['china', 'China'],
  ['\u4e2d\u56fd', 'China'],
  ['pr china', 'China'],
  ['peoples republic of china', 'China'],
  ['united states', 'United States'],
  ['united states of america', 'United States'],
  ['usa', 'United States'],
  ['us', 'United States'],
  ['america', 'United States'],
  ['\u7f8e\u56fd', 'United States'],
  ['u s a', 'United States'],
  ['u s', 'United States'],
] as const;

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
  readonly citizenshipOptions: string[] = this.buildCitizenshipOptions();
  readonly firstLanguageOptions: string[] = this.buildFirstLanguageOptions();
  readonly cityOptions: string[] = this.buildCityOptions();
  readonly provinceOptions: string[] = this.buildProvinceOptions();
  readonly countryOptions: string[] = this.buildCountryOptions();

  statusInCanadaSelection = '';
  statusInCanadaOtherText = '';

  managedMode = false;
  managedStudentId: number | null = null;
  invalidManagedStudentId = false;

  loading = false;
  saving = false;
  saved = false;
  error = '';
  oenError = '';
  editing = false;

  model: StudentProfileModel = this.defaultModel();
  highSchoolLookupOptions: CanadianHighSchoolLookupItem[][] = [[]];
  highSchoolLookupLoading: boolean[] = [false];
  externalCourseProviderLookupOptions: CanadianHighSchoolLookupItem[][] = [];
  externalCourseProviderLookupLoading: boolean[] = [];
  private lastSavedPayloadDigest = '';
  private pendingAutoSave = false;
  private saveInProgress = false;
  private highSchoolLookupTimer: Record<number, ReturnType<typeof setTimeout> | undefined> = {};
  private externalCourseProviderLookupTimer: Record<number, ReturnType<typeof setTimeout> | undefined> = {};

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

  onPhoneInputChange(value: string): void {
    this.model.phone = this.formatPhoneForDisplay(value);
  }

  onPostalInputChange(value: string): void {
    this.model.address.postal = this.formatPostalForDisplay(value, this.model.address.country);
  }

  onCountryInputChange(value: string): void {
    const normalizedCountry = this.normalizeCountryToStandardEnglish(value);
    this.model.address.country = normalizedCountry;
    this.model.address.postal = this.formatPostalForDisplay(this.model.address.postal, normalizedCountry);
  }

  onOenInputChange(value: string): void {
    this.model.oenNumber = this.normalizeOenNumber(value);
    this.validateOenNumber();
  }

  onHighSchoolNameInputChange(index: number, value: string): void {
    const school = this.model.highSchools[index];
    if (!school) return;

    school.schoolName = this.toText(value);
    this.fetchHighSchoolLookupOptions(index, school.schoolName);
  }

  onHighSchoolPostalInputChange(index: number, value: string): void {
    const school = this.model.highSchools[index];
    if (!school) return;
    school.postal = this.formatPostalForDisplay(value, school.country || 'Canada');
  }

  onExternalCourseSchoolNameInputChange(index: number, value: string): void {
    const course = this.model.externalCourses[index];
    if (!course) return;

    course.schoolName = this.toText(value);
    this.fetchExternalCourseProviderLookupOptions(index, course.schoolName);
  }

  onExternalCoursePostalInputChange(index: number, value: string): void {
    const course = this.model.externalCourses[index];
    if (!course) return;
    course.postal = this.formatPostalForDisplay(value, course.country || 'Canada');
  }

  onExternalCourseCountryInputChange(index: number, value: string): void {
    const course = this.model.externalCourses[index];
    if (!course) return;
    const normalizedCountry = this.normalizeCountryToStandardEnglish(value);
    course.country = normalizedCountry;
    course.postal = this.formatPostalForDisplay(course.postal, normalizedCountry);
  }

  getHighSchoolLookupOptions(index: number): CanadianHighSchoolLookupItem[] {
    return this.highSchoolLookupOptions[index] || [];
  }

  getExternalCourseProviderLookupOptions(index: number): CanadianHighSchoolLookupItem[] {
    return this.externalCourseProviderLookupOptions[index] || [];
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

  displaySchoolAddress(school: HighSchoolModel): string {
    const parts = [
      this.toText(school.streetAddress),
      this.toText(school.city),
      this.toText(school.state),
      this.toText(school.country),
      this.toText(school.postal),
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : '-';
  }

  displayExternalCourseSchoolAddress(course: ExternalCourseModel): string {
    const parts = [
      this.toText(course.streetAddress),
      this.toText(course.city),
      this.toText(course.state),
      this.toText(course.country),
      this.toText(course.postal),
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : '-';
  }

  getExternalCoursePostalPlaceholder(index: number): string {
    const course = this.model.externalCourses[index];
    const country = course ? course.country : '';
    const postalFormat = this.resolvePostalFormat(country);
    if (postalFormat === 'canada') return 'A1A 1A1';
    if (postalFormat === 'us') return '12345 or 12345-6789';
    if (postalFormat === 'china') return '6 digits';
    return 'Postal Code';
  }

  addHighSchool(): void {
    this.model.highSchools.push(this.createPastHighSchool());
    this.highSchoolLookupOptions.push([]);
    this.highSchoolLookupLoading.push(false);
  }

  removeHighSchool(index: number): void {
    // Keep one default current school entry at all times.
    if (index <= 0) return;
    if (index >= this.model.highSchools.length) return;
    this.model.highSchools.splice(index, 1);
    this.highSchoolLookupOptions.splice(index, 1);
    this.highSchoolLookupLoading.splice(index, 1);
    this.clearHighSchoolLookupTimer(index);
    this.triggerAutoSave();
  }

  addExternalCourse(): void {
    this.model.externalCourses.push({
      schoolName: '',
      streetAddress: '',
      city: '',
      state: '',
      country: 'Canada',
      postal: '',
      courseCode: '',
      mark: null,
      gradeLevel: null,
      startTime: '',
      endTime: '',
    });
    this.externalCourseProviderLookupOptions.push([]);
    this.externalCourseProviderLookupLoading.push(false);
  }

  removeExternalCourse(index: number): void {
    if (index < 0 || index >= this.model.externalCourses.length) return;
    this.model.externalCourses.splice(index, 1);
    this.externalCourseProviderLookupOptions.splice(index, 1);
    this.externalCourseProviderLookupLoading.splice(index, 1);
    this.clearExternalCourseProviderLookupTimer(index);
    this.syncExternalCourseProviderLookupState();
    this.triggerAutoSave();
  }

  private fetchHighSchoolLookupOptions(index: number, keyword: string): void {
    this.clearHighSchoolLookupTimer(index);

    const text = this.toText(keyword);
    if (text.length < 2) {
      this.highSchoolLookupOptions[index] = [];
      this.highSchoolLookupLoading[index] = false;
      return;
    }

    this.highSchoolLookupLoading[index] = true;
    this.highSchoolLookupTimer[index] = setTimeout(() => {
      delete this.highSchoolLookupTimer[index];
      const expectedName = this.toText(this.model.highSchools[index]?.schoolName).toLowerCase();
      this.profileApi.searchCanadianHighSchools(text).subscribe({
        next: (options) => {
          const currentName = this.toText(this.model.highSchools[index]?.schoolName).toLowerCase();
          if (currentName !== expectedName) return;
          this.highSchoolLookupOptions[index] = options;
          this.highSchoolLookupLoading[index] = false;
          this.tryApplyHighSchoolLookup(index, this.model.highSchools[index]?.schoolName || '');
          this.cdr.detectChanges();
        },
        error: () => {
          this.highSchoolLookupOptions[index] = [];
          this.highSchoolLookupLoading[index] = false;
          this.cdr.detectChanges();
        },
      });
    }, 300);
  }

  private tryApplyHighSchoolLookup(index: number, schoolName: string): void {
    const school = this.model.highSchools[index];
    if (!school) return;

    const matched = this.findExactHighSchoolLookup(index, schoolName);
    if (!matched) return;

    this.applyHighSchoolLookup(index, matched);
  }

  private findExactHighSchoolLookup(
    index: number,
    schoolName: string
  ): CanadianHighSchoolLookupItem | null {
    const inputText = this.normalizeLookupText(schoolName);
    if (!inputText) return null;

    const options = this.getHighSchoolLookupOptions(index);
    if (options.length === 0) return null;
    for (const option of options) {
      const optionName = this.normalizeLookupText(option.name);
      if (optionName === inputText) {
        return option;
      }
    }
    return null;
  }

  private normalizeLookupText(value: string): string {
    return value
      .toLowerCase()
      .replace(/[&.,/\\()\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private applyHighSchoolLookup(index: number, option: CanadianHighSchoolLookupItem): void {
    const school = this.model.highSchools[index];
    if (!school) return;

    school.schoolName = this.toText(option.name) || school.schoolName;
    school.streetAddress = this.toText(option.streetAddress);
    school.city = this.toText(option.city);
    school.state = this.toText(option.state);
    school.country = this.normalizeCountryToStandardEnglish(option.country || 'Canada');
    school.postal = this.formatPostalForDisplay(option.postal, school.country);
  }

  private syncHighSchoolLookupState(): void {
    const options = this.model.highSchools.map((_, index) => this.highSchoolLookupOptions[index] || []);
    const loading = this.model.highSchools.map((_, index) => this.highSchoolLookupLoading[index] || false);

    this.highSchoolLookupOptions = options;
    this.highSchoolLookupLoading = loading;

    for (const key of Object.keys(this.highSchoolLookupTimer)) {
      const index = Number(key);
      if (!Number.isInteger(index) || index < this.model.highSchools.length) continue;
      this.clearHighSchoolLookupTimer(index);
    }
  }

  private clearHighSchoolLookupTimer(index: number): void {
    const timer = this.highSchoolLookupTimer[index];
    if (timer === undefined) return;
    clearTimeout(timer);
    delete this.highSchoolLookupTimer[index];
  }

  private fetchExternalCourseProviderLookupOptions(index: number, keyword: string): void {
    this.clearExternalCourseProviderLookupTimer(index);

    const text = this.toText(keyword);
    if (text.length < 2) {
      this.externalCourseProviderLookupOptions[index] = [];
      this.externalCourseProviderLookupLoading[index] = false;
      return;
    }

    this.externalCourseProviderLookupLoading[index] = true;
    this.externalCourseProviderLookupTimer[index] = setTimeout(() => {
      delete this.externalCourseProviderLookupTimer[index];
      const expectedName = this.toText(this.model.externalCourses[index]?.schoolName).toLowerCase();
      forkJoin({
        highSchools: this.profileApi.searchCanadianHighSchools(text),
        providers: this.profileApi.searchOntarioCourseProviders(text),
      }).subscribe({
        next: ({ highSchools, providers }) => {
          const currentName = this.toText(this.model.externalCourses[index]?.schoolName).toLowerCase();
          if (currentName !== expectedName) {
            this.externalCourseProviderLookupLoading[index] = false;
            return;
          }
          this.externalCourseProviderLookupOptions[index] = this.mergeExternalCourseLookupOptions(highSchools, providers);
          this.externalCourseProviderLookupLoading[index] = false;
          this.tryApplyExternalCourseProviderLookup(index, this.model.externalCourses[index]?.schoolName || '');
          this.cdr.detectChanges();
        },
        error: () => {
          this.externalCourseProviderLookupOptions[index] = [];
          this.externalCourseProviderLookupLoading[index] = false;
          this.cdr.detectChanges();
        },
      });
    }, 300);
  }

  private tryApplyExternalCourseProviderLookup(index: number, schoolName: string): void {
    const course = this.model.externalCourses[index];
    if (!course) return;

    const matched = this.findExactExternalCourseProviderLookup(index, schoolName);
    if (!matched) return;

    this.applyExternalCourseProviderLookup(index, matched);
  }

  private applyExternalCourseProviderLookup(index: number, option: CanadianHighSchoolLookupItem): void {
    const course = this.model.externalCourses[index];
    if (!course) return;

    course.schoolName = this.toText(option.name) || course.schoolName;
    course.streetAddress = this.toText(option.streetAddress);
    course.city = this.toText(option.city);
    course.state = this.toText(option.state);
    course.country = this.normalizeCountryToStandardEnglish(option.country || 'Canada');
    course.postal = this.formatPostalForDisplay(option.postal, course.country);
  }

  private mergeExternalCourseLookupOptions(
    highSchools: CanadianHighSchoolLookupItem[],
    providers: CanadianHighSchoolLookupItem[]
  ): CanadianHighSchoolLookupItem[] {
    const merged = [...highSchools, ...providers];
    const deduped: CanadianHighSchoolLookupItem[] = [];
    const seen = new Set<string>();
    for (const option of merged) {
      const key = `${this.normalizeLookupText(option.name)}|${this.normalizeLookupText(option.streetAddress)}|${this.normalizeLookupText(option.postal)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(option);
    }
    return deduped;
  }

  private findExactExternalCourseProviderLookup(
    index: number,
    schoolName: string
  ): CanadianHighSchoolLookupItem | null {
    const inputText = this.normalizeLookupText(schoolName);
    if (!inputText) return null;

    const options = this.getExternalCourseProviderLookupOptions(index);
    if (options.length === 0) return null;
    for (const option of options) {
      const optionName = this.normalizeLookupText(option.name);
      if (optionName === inputText) {
        return option;
      }
    }
    return null;
  }

  private syncExternalCourseProviderLookupState(): void {
    const options = this.model.externalCourses.map((_, index) => this.externalCourseProviderLookupOptions[index] || []);
    const loading = this.model.externalCourses.map((_, index) => this.externalCourseProviderLookupLoading[index] || false);

    this.externalCourseProviderLookupOptions = options;
    this.externalCourseProviderLookupLoading = loading;

    for (const key of Object.keys(this.externalCourseProviderLookupTimer)) {
      const index = Number(key);
      if (!Number.isInteger(index) || index < this.model.externalCourses.length) continue;
      this.clearExternalCourseProviderLookupTimer(index);
    }
  }

  private clearExternalCourseProviderLookupTimer(index: number): void {
    const timer = this.externalCourseProviderLookupTimer[index];
    if (timer === undefined) return;
    clearTimeout(timer);
    delete this.externalCourseProviderLookupTimer[index];
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
          this.syncHighSchoolLookupState();
          this.syncExternalCourseProviderLookupState();
          this.syncStatusInCanadaControls();
          this.validateOenNumber();
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
    if (!this.validateOenNumber()) {
      this.error = this.oenError;
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
            this.syncHighSchoolLookupState();
            this.syncExternalCourseProviderLookupState();
          }

          this.syncStatusInCanadaControls();
          this.validateOenNumber();
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
      this.syncHighSchoolLookupState();
      this.syncExternalCourseProviderLookupState();
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
      highSchools: [this.createCurrentHighSchool()],
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
    const normalizedCountry = this.normalizeCountryToStandardEnglish(rawAddress.country || defaults.address.country);
    const rawCourses = this.resolveExternalCourses(source);
    const rawSchools = this.resolveSchoolRecords(source, rawCourses);

    return {
      legalFirstName: this.toText(source.legalFirstName || source.firstName),
      legalLastName: this.toText(source.legalLastName || source.lastName),
      preferredName: this.toText(source.preferredName || source.nickName),
      gender: this.normalizeGender(source.gender),
      birthday: this.normalizeDate(source.birthday),
      phone: this.formatPhoneForDisplay(source.phone),
      email: this.toText(source.email),

      statusInCanada: this.toText(source.statusInCanada),
      citizenship: this.toText(source.citizenship),
      firstLanguage: this.toText(source.firstLanguage),
      firstBoardingDate: this.normalizeDate(
        source.firstEntryDateInCanada ||
          source.firstEntryDate ||
          source.firstArrivalDateInCanada ||
          source.firstBoardingDate
      ),

      address: {
        streetAddress: this.toText(rawAddress.streetAddress),
        streetAddressLine2: this.toText(rawAddress.streetAddressLine2),
        city: this.toText(rawAddress.city),
        state: this.toText(rawAddress.state),
        country: normalizedCountry,
        postal: this.formatPostalForDisplay(rawAddress.postal, normalizedCountry),
      },

      oenNumber: this.normalizeOenNumber(source.oenNumber),
      ib: this.toText(source.ib),
      ap: this.toBoolean(source.ap),
      identityFileNote: this.toText(source.identityFileNote),

      highSchools: this.normalizeHighSchools(rawSchools.map((school: unknown) => this.normalizeHighSchool(school))),
      externalCourses: rawCourses.map((course: unknown) => this.normalizeExternalCourse(course)),
    };
  }

  private normalizeHighSchool(value: unknown): HighSchoolModel {
    const source: any = value && typeof value === 'object' ? value : {};
    const schoolNode = source.school && typeof source.school === 'object' ? source.school : {};
    const rawAddress = source.address && typeof source.address === 'object'
      ? source.address
      : schoolNode.address && typeof schoolNode.address === 'object'
        ? schoolNode.address
        : {};
    const schoolTypeRaw = String(source.schoolType || '')
      .trim()
      .toUpperCase();
    const schoolType: SchoolType = schoolTypeRaw === 'MAIN' || schoolTypeRaw === 'OTHER' ? schoolTypeRaw : '';
    const country = this.normalizeCountryToStandardEnglish(
      source.country || rawAddress.country || 'Canada'
    );

    return {
      schoolType,
      schoolName: this.toText(source.schoolName || schoolNode.name),
      streetAddress: this.toText(source.streetAddress || rawAddress.streetAddress),
      city: this.toText(source.city || rawAddress.city),
      state: this.toText(source.state || rawAddress.state),
      country,
      postal: this.formatPostalForDisplay(source.postal || rawAddress.postal, country),
      startTime: this.normalizeDate(source.startTime),
      endTime: this.normalizeDate(source.endTime),
    };
  }

  private createCurrentHighSchool(): HighSchoolModel {
    return {
      schoolType: 'MAIN',
      schoolName: '',
      streetAddress: '',
      city: '',
      state: '',
      country: 'Canada',
      postal: '',
      startTime: '',
      endTime: '',
    };
  }

  private createPastHighSchool(): HighSchoolModel {
    return {
      schoolType: 'OTHER',
      schoolName: '',
      streetAddress: '',
      city: '',
      state: '',
      country: 'Canada',
      postal: '',
      startTime: '',
      endTime: '',
    };
  }

  private normalizeHighSchools(schools: HighSchoolModel[]): HighSchoolModel[] {
    if (!Array.isArray(schools) || schools.length === 0) {
      return [this.createCurrentHighSchool()];
    }

    const normalized = schools.map((school) => {
      const country = this.normalizeCountryToStandardEnglish(school.country || 'Canada');
      return {
        schoolType: school.schoolType,
        schoolName: this.toText(school.schoolName),
        streetAddress: this.toText(school.streetAddress),
        city: this.toText(school.city),
        state: this.toText(school.state),
        country,
        postal: this.formatPostalForDisplay(school.postal, country),
        startTime: this.normalizeDate(school.startTime),
        endTime: this.normalizeDate(school.endTime),
      };
    });

    const mainIndex = normalized.findIndex((school) => school.schoolType === 'MAIN');
    const currentIndex = mainIndex >= 0 ? mainIndex : 0;
    const currentSchool: HighSchoolModel = {
      ...normalized[currentIndex],
      schoolType: 'MAIN',
    };

    const otherSchools: HighSchoolModel[] = normalized
      .filter((_, index) => index !== currentIndex)
      .map((school) => ({
        ...school,
        schoolType: 'OTHER',
      }));

    return [currentSchool, ...otherSchools];
  }

  private normalizeExternalCourse(value: unknown): ExternalCourseModel {
    const source: any = value && typeof value === 'object' ? value : {};
    const rawAddress = source.address && typeof source.address === 'object' ? source.address : {};
    const country = this.normalizeCountryToStandardEnglish(
      source.country || rawAddress.country || 'Canada'
    );

    return {
      schoolName: this.toText(source.schoolName),
      streetAddress: this.toText(source.streetAddress || rawAddress.streetAddress),
      city: this.toText(source.city || rawAddress.city),
      state: this.toText(source.state || rawAddress.state),
      country,
      postal: this.formatPostalForDisplay(source.postal || rawAddress.postal, country),
      courseCode: this.toText(source.courseCode),
      mark: this.toOptionalNumber(source.mark),
      gradeLevel: this.toOptionalNumber(source.gradeLevel),
      startTime: this.normalizeDate(source.startTime),
      endTime: this.normalizeDate(source.endTime),
    };
  }

  private toPayload(model: StudentProfileModel): StudentProfilePayload {
    const firstEntryDateInCanada = this.normalizeDate(model.firstBoardingDate);
    const normalizedCountry = this.normalizeCountryToStandardEnglish(model.address.country);

    return {
      legalFirstName: this.toText(model.legalFirstName),
      legalLastName: this.toText(model.legalLastName),
      preferredName: this.toText(model.preferredName),
      gender: model.gender,
      birthday: this.normalizeDate(model.birthday),
      phone: this.normalizePhoneForPayload(model.phone),
      email: this.toText(model.email),
      statusInCanada: this.toText(model.statusInCanada),
      citizenship: this.toText(model.citizenship),
      firstLanguage: this.toText(model.firstLanguage),
      firstBoardingDate: firstEntryDateInCanada,
      firstEntryDateInCanada,
      address: {
        streetAddress: this.toText(model.address.streetAddress),
        streetAddressLine2: this.toText(model.address.streetAddressLine2),
        city: this.toText(model.address.city),
        state: this.toText(model.address.state),
        country: normalizedCountry,
        postal: this.formatPostalForDisplay(model.address.postal, normalizedCountry),
      },
      oenNumber: this.normalizeOenNumber(model.oenNumber),
      ib: this.toText(model.ib),
      ap: !!model.ap,
      identityFileNote: this.toText(model.identityFileNote),
      schools: this.normalizeHighSchools(model.highSchools).map((school, index) => {
        const schoolCountry = this.normalizeCountryToStandardEnglish(school.country || 'Canada');
        const schoolPostal = this.formatPostalForDisplay(school.postal, schoolCountry);
        return {
          schoolType: index === 0 ? 'MAIN' : 'OTHER',
          schoolName: this.toText(school.schoolName),
          address: {
            streetAddress: this.toText(school.streetAddress),
            city: this.toText(school.city),
            state: this.toText(school.state),
            country: schoolCountry,
            postal: schoolPostal,
          },
          streetAddress: this.toText(school.streetAddress),
          city: this.toText(school.city),
          state: this.toText(school.state),
          country: schoolCountry,
          postal: schoolPostal,
          startTime: this.normalizeDate(school.startTime),
          endTime: this.normalizeDate(school.endTime),
        };
      }),
      otherCourses: model.externalCourses.map((course) => ({
        schoolType: 'OTHER',
        schoolName: this.toText(course.schoolName),
        address: {
          streetAddress: this.toText(course.streetAddress),
          city: this.toText(course.city),
          state: this.toText(course.state),
          country: this.normalizeCountryToStandardEnglish(course.country || 'Canada'),
          postal: this.formatPostalForDisplay(
            course.postal,
            this.normalizeCountryToStandardEnglish(course.country || 'Canada')
          ),
        },
        streetAddress: this.toText(course.streetAddress),
        city: this.toText(course.city),
        state: this.toText(course.state),
        country: this.normalizeCountryToStandardEnglish(course.country || 'Canada'),
        postal: this.formatPostalForDisplay(
          course.postal,
          this.normalizeCountryToStandardEnglish(course.country || 'Canada')
        ),
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

    // 鍚戝悗鍏煎锛氳€佹暟鎹彲鑳芥妸瀛︽牎淇℃伅娣峰湪 otherCourses 閲?
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
        streetAddress: '',
        city: '',
        state: '',
        country: 'Canada',
        postal: '',
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

  private buildCitizenshipOptions(): string[] {
    const options: string[] = [];
    const seen = new Set<string>();
    const append = (value: unknown): void => {
      const text = this.toText(value);
      if (!text || seen.has(text)) return;
      seen.add(text);
      options.push(text);
    };

    PRIORITY_CITIZENSHIP_OPTIONS.forEach(append);
    this.buildRegionCitizenshipOptions().forEach(append);
    FALLBACK_CITIZENSHIP_OPTIONS.forEach(append);

    return options;
  }

  private buildRegionCitizenshipOptions(): string[] {
    try {
      if (typeof Intl === 'undefined' || typeof Intl.DisplayNames !== 'function') {
        return [];
      }
      const displayNames = new Intl.DisplayNames(['zh-Hans-CN', 'zh-Hans', 'en'], {
        type: 'region',
      });
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

  private buildFirstLanguageOptions(): string[] {
    const options: string[] = [];
    const seen = new Set<string>();
    const append = (value: unknown): void => {
      const text = this.toText(value);
      if (!text || seen.has(text)) return;
      seen.add(text);
      options.push(text);
    };

    PRIORITY_FIRST_LANGUAGE_OPTIONS.forEach(append);
    this.buildLanguageDisplayNameOptions().forEach(append);
    FALLBACK_FIRST_LANGUAGE_OPTIONS.forEach(append);

    return options;
  }

  private buildLanguageDisplayNameOptions(): string[] {
    try {
      if (typeof Intl === 'undefined' || typeof Intl.DisplayNames !== 'function') {
        return [];
      }

      const displayNames = new Intl.DisplayNames(['zh-Hans-CN', 'zh-Hans', 'en'], {
        type: 'language',
      });
      const options: string[] = [];
      for (const code of LANGUAGE_CODE_OPTIONS) {
        const name = displayNames.of(code);
        if (!name || name === code) continue;
        options.push(String(name));
      }
      return options;
    } catch {
      return [];
    }
  }

  private buildCityOptions(): string[] {
    const options: string[] = [];
    const seen = new Set<string>();
    const append = (value: unknown): void => {
      const text = this.toText(value);
      if (!text) return;
      const key = text.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      options.push(text);
    };

    PRIORITY_CITY_OPTIONS.forEach(append);
    FALLBACK_CITY_OPTIONS.forEach(append);

    return options;
  }

  private buildProvinceOptions(): string[] {
    const options: string[] = [];
    const seen = new Set<string>();
    const append = (value: unknown): void => {
      const text = this.toText(value);
      if (!text) return;
      const key = text.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      options.push(text);
    };

    PRIORITY_PROVINCE_OPTIONS.forEach(append);
    FALLBACK_PROVINCE_OPTIONS.forEach(append);

    return options;
  }

  private buildCountryOptions(): string[] {
    const options: string[] = [];
    const seen = new Set<string>();
    const append = (value: unknown): void => {
      const text = this.toText(value);
      if (!text) return;
      const key = text.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      options.push(text);
    };

    PRIORITY_COUNTRY_OPTIONS.forEach(append);
    this.buildRegionCountryOptions().forEach(append);
    FALLBACK_COUNTRY_OPTIONS.forEach(append);

    return options;
  }

  private buildRegionCountryOptions(): string[] {
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

  private normalizeCountryToStandardEnglish(value: unknown): string {
    const rawText = this.toText(value);
    if (!rawText) return '';

    const normalizedKey = rawText
      .toLowerCase()
      .replace(/[.]/g, '')
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
      .trim();

    for (const [alias, canonical] of COUNTRY_STANDARD_ALIASES) {
      if (normalizedKey === alias) return canonical;
    }

    const matched = this.countryOptions.find((option) => option.toLowerCase() === rawText.toLowerCase());
    return matched || rawText;
  }

  get postalPlaceholder(): string {
    const postalFormat = this.resolvePostalFormat(this.model.address.country);
    if (postalFormat === 'canada') return 'A1A 1A1';
    if (postalFormat === 'us') return '12345 or 12345-6789';
    if (postalFormat === 'china') return '6 digits';
    return 'Postal Code';
  }

  private formatPostalForDisplay(value: unknown, country: unknown): string {
    const postalFormat = this.resolvePostalFormat(country);

    if (postalFormat === 'canada') {
      const normalized = String(value ?? '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6);

      if (normalized.length <= 3) return normalized;
      return `${normalized.slice(0, 3)} ${normalized.slice(3)}`;
    }

    if (postalFormat === 'us') {
      const digits = String(value ?? '')
        .replace(/\D/g, '')
        .slice(0, 9);
      if (digits.length <= 5) return digits;
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }

    if (postalFormat === 'china') {
      return String(value ?? '')
        .replace(/\D/g, '')
        .slice(0, 6);
    }

    return this.toText(value);
  }

  private resolvePostalFormat(country: unknown): 'canada' | 'us' | 'china' | 'other' {
    const normalizedCountry = this.normalizeCountryToStandardEnglish(country);
    const key = normalizedCountry.toLowerCase();
    if (key === 'canada') return 'canada';
    if (key === 'united states') return 'us';
    if (key === 'china') return 'china';
    return 'other';
  }

  private normalizeOenNumber(value: unknown): string {
    return String(value ?? '')
      .replace(/\D/g, '')
      .slice(0, 9);
  }

  private validateOenNumber(): boolean {
    const oen = this.normalizeOenNumber(this.model.oenNumber);
    this.model.oenNumber = oen;
    if (!oen) {
      this.oenError = '';
      return true;
    }
    if (/^\d{9}$/.test(oen)) {
      this.oenError = '';
      return true;
    }

    this.oenError = 'OEN 蹇呴』涓?9 浣嶇函鏁板瓧';
    return false;
  }

  private extractPhoneDigits(value: unknown): string {
    return String(value ?? '').replace(/\D/g, '');
  }

  private normalizePhoneForPayload(value: unknown): string {
    const digits = this.extractPhoneDigits(value);
    if (digits.length === 11 && digits.startsWith('1')) {
      return digits.slice(1);
    }

    return digits.slice(0, 10);
  }

  private formatPhoneForDisplay(value: unknown): string {
    const digits = this.normalizePhoneForPayload(value);
    if (!digits) return '';
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
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

