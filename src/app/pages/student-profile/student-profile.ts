import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { concatMap, finalize, tap, toArray } from 'rxjs/operators';
import { forkJoin, from } from 'rxjs';

import {
  CanadianHighSchoolLookupItem,
  EDUCATION_BOARD_LIBRARY_OPTIONS,
  ProfileChangeSource,
  StudentIdentityFilePayload,
  StudentProfileHistoryEntry,
  StudentProfileHistoryFieldChange,
  StudentProfileHistoryResponse,
  StudentProfilePayload,
  StudentSchoolTranscriptPayload,
  SchoolTranscriptUploadOptions,
  StudentProfileService,
} from '../../services/student-profile.service';

type Gender = '' | 'Male' | 'Female' | 'Other';
type StudentRegion =
  | ''
  | 'Ontario'
  | 'British Columbia'
  | 'Alberta'
  | 'Saskatchewan'
  | 'Manitoba'
  | 'Quebec'
  | 'New Brunswick'
  | 'Nova Scotia'
  | 'Prince Edward Island'
  | 'Newfoundland and Labrador'
  | 'Yukon'
  | 'Northwest Territories'
  | 'Nunavut'
  | 'China'
  | 'United States';

type SchoolType = '' | 'MAIN' | 'OTHER';
type AcademicRecordType = 'Transcript' | 'Report Card';
type IdentityDocumentType = 'Passport' | 'Study Permit / Visa' | 'PR Card' | 'Other';

interface AddressModel {
  streetAddress: string;
  streetAddressLine2: string;
  city: string;
  state: string;
  country: string;
  postal: string;
}

interface HighSchoolModel {
  schoolRecordId: number | null;
  schoolType: SchoolType;
  schoolName: string;
  schoolBoard: string;
  streetAddress: string;
  city: string;
  state: string;
  country: string;
  postal: string;
  startTime: string;
  endTime: string;
  transcriptFileName: string;
  transcriptSizeBytes: number | null;
  transcriptUploadedAt: string;
  hasTranscript: boolean;
  transcripts: SchoolTranscriptModel[];
}

interface SchoolTranscriptModel {
  transcriptFileName: string;
  transcriptSizeBytes: number | null;
  transcriptUploadedAt: string;
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
  genderOther: string;
  birthday: string;
  phone: string;
  email: string;

  statusInCanada: string;
  citizenship: string;
  firstLanguage: string;
  firstBoardingDate: string;

  address: AddressModel;

  studentRegion: StudentRegion;
  oenNumber: string;
  penNumber: string;
  ib: string;
  ap: boolean;
  serviceItems: string[];
  identityFiles: IdentityFileModel[];

  highSchools: HighSchoolModel[];
  externalCourses: ExternalCourseModel[];
}

interface IdentityFileModel {
  identityFileId: number | null;
  identityFileName: string;
  identityFileSizeBytes: number | null;
  identityFileUploadedAt: string;
}

interface SaveOptions {
  exitEditMode?: boolean;
  skipIfUnchanged?: boolean;
  showSavedFeedback?: boolean;
  syncModelOnSuccess?: boolean;
  background?: boolean;
  changeSource?: ProfileChangeSource;
}

interface SchoolUploadHint {
  schoolType: SchoolType;
  schoolName: string;
  startTime: string;
  endTime: string;
  city: string;
  postal: string;
}

interface SchoolUploadTarget {
  index: number;
  schoolRecordId: number;
}

const TRANSCRIPT_UPLOAD_RETRY_DELAY_MS = 120;
const TRANSCRIPT_UPLOAD_RETRY_LIMIT = 25;
const IDENTITY_UPLOAD_RETRY_DELAY_MS = 120;
const IDENTITY_UPLOAD_RETRY_LIMIT = 25;

const PRIORITY_CITIZENSHIP_OPTIONS = [
  'China (Mainland)',
  'Canada',
  'United States',
  'China (Taiwan)',
  'China (Hong Kong)',
] as const;

const FALLBACK_CITIZENSHIP_OPTIONS = [
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

const CITIZENSHIP_STANDARD_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ['china', 'China (Mainland)'],
  ['china mainland', 'China (Mainland)'],
  ['pr china', 'China (Mainland)'],
  ['peoples republic of china', 'China (Mainland)'],
  ['中国', 'China (Mainland)'],
  ['中国大陆', 'China (Mainland)'],
  ['中华人民共和国', 'China (Mainland)'],
  ['canada', 'Canada'],
  ['加拿大', 'Canada'],
  ['united states', 'United States'],
  ['united states of america', 'United States'],
  ['usa', 'United States'],
  ['us', 'United States'],
  ['u s a', 'United States'],
  ['u s', 'United States'],
  ['america', 'United States'],
  ['美国', 'United States'],
  ['taiwan', 'China (Taiwan)'],
  ['中国台湾', 'China (Taiwan)'],
  ['台湾', 'China (Taiwan)'],
  ['china taiwan', 'China (Taiwan)'],
  ['hong kong', 'China (Hong Kong)'],
  ['hong kong sar china', 'China (Hong Kong)'],
  ['中国香港', 'China (Hong Kong)'],
  ['香港', 'China (Hong Kong)'],
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
  ['china mainland', 'China'],
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

const STUDENT_REGION_OPTIONS: ReadonlyArray<Readonly<{ value: StudentRegion; label: string }>> = [
  { value: 'Ontario', label: 'Ontario' },
  { value: 'British Columbia', label: 'British Columbia' },
  { value: 'Alberta', label: 'Alberta' },
  { value: 'Saskatchewan', label: 'Saskatchewan' },
  { value: 'Manitoba', label: 'Manitoba' },
  { value: 'Quebec', label: 'Quebec' },
  { value: 'New Brunswick', label: 'New Brunswick' },
  { value: 'Nova Scotia', label: 'Nova Scotia' },
  { value: 'Prince Edward Island', label: 'Prince Edward Island' },
  { value: 'Newfoundland and Labrador', label: 'Newfoundland and Labrador' },
  { value: 'Yukon', label: 'Yukon' },
  { value: 'Northwest Territories', label: 'Northwest Territories' },
  { value: 'Nunavut', label: 'Nunavut' },
  { value: 'China', label: 'China' },
  { value: 'United States', label: 'United States' },
] as const;

const STUDENT_REGION_ALIASES: ReadonlyArray<readonly [string, StudentRegion]> = [
  ['on', 'Ontario'],
  ['ontario', 'Ontario'],
  ['ca-on', 'Ontario'],
  ['bc', 'British Columbia'],
  ['b c', 'British Columbia'],
  ['british columbia', 'British Columbia'],
  ['ca-bc', 'British Columbia'],
  ['ab', 'Alberta'],
  ['a b', 'Alberta'],
  ['alberta', 'Alberta'],
  ['sk', 'Saskatchewan'],
  ['s k', 'Saskatchewan'],
  ['saskatchewan', 'Saskatchewan'],
  ['mb', 'Manitoba'],
  ['m b', 'Manitoba'],
  ['manitoba', 'Manitoba'],
  ['qc', 'Quebec'],
  ['q c', 'Quebec'],
  ['quebec', 'Quebec'],
  ['nb', 'New Brunswick'],
  ['n b', 'New Brunswick'],
  ['new brunswick', 'New Brunswick'],
  ['ns', 'Nova Scotia'],
  ['n s', 'Nova Scotia'],
  ['nova scotia', 'Nova Scotia'],
  ['pei', 'Prince Edward Island'],
  ['p e i', 'Prince Edward Island'],
  ['prince edward island', 'Prince Edward Island'],
  ['nl', 'Newfoundland and Labrador'],
  ['n l', 'Newfoundland and Labrador'],
  ['newfoundland and labrador', 'Newfoundland and Labrador'],
  ['yt', 'Yukon'],
  ['y t', 'Yukon'],
  ['yukon', 'Yukon'],
  ['nt', 'Northwest Territories'],
  ['n t', 'Northwest Territories'],
  ['northwest territories', 'Northwest Territories'],
  ['nu', 'Nunavut'],
  ['n u', 'Nunavut'],
  ['nunavut', 'Nunavut'],
  ['cn', 'China'],
  ['china', 'China'],
  ['prc', 'China'],
  ['us', 'United States'],
  ['usa', 'United States'],
  ['united states', 'United States'],
  ['united states of america', 'United States'],
] as const;

const SERVICE_ITEM_OPTIONS = [
  '面试辅导',
  '雅思A类全科班',
  'SAT全科班',
  '数学竞赛类班课',
  '3U&4U阅写及文学素养',
  '雅思VIP 20小时包',
  '雅思VIP 50小时包',
  '学科VIP 20小时包',
  '学科VIP 50小时包',
  'AP/IB/数学竞赛VIP 50小时包',
  '一对一辅导',
] as const;

const IDENTITY_DOCUMENT_TYPE_OPTIONS: ReadonlyArray<IdentityDocumentType> = [
  'Passport',
  'Study Permit / Visa',
  'PR Card',
  'Other',
] as const;

const ACADEMIC_RECORD_TYPE_OPTIONS: ReadonlyArray<AcademicRecordType> = [
  'Transcript',
  'Report Card',
] as const;

const REPORT_MONTH_OPTIONS: ReadonlyArray<string> = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const VALIDATION_COLLECTION_LABELS: Record<string, string> = {
  schools: '高中学校',
  schoolRecords: '高中学校',
  otherCourses: '校外课程',
  externalCourses: '校外课程',
  identityFiles: '身份证明文件',
};

const VALIDATION_FIELD_LABELS: Record<string, string> = {
  legalFirstName: '法定名字',
  legalLastName: '法定姓氏',
  preferredName: '常用名',
  gender: '性别',
  genderOther: '其他性别说明',
  birthday: '生日',
  phone: '联系电话',
  email: '邮箱',
  statusInCanada: '在加身份',
  citizenship: '国籍',
  firstLanguage: '第一语言',
  firstBoardingDate: '首次入境加拿大时间',
  firstEntryDateInCanada: '首次入境加拿大时间',
  studentRegion: '高中毕业地区',
  student_region: '高中毕业地区',
  oenNumber: 'OEN',
  oen: 'OEN',
  pen: 'PEN',
  penNumber: 'PEN',
  ib: 'IB',
  ap: 'AP',
  serviceItems: '服务项目',
  address: '联系地址',
  streetAddress: '街道地址',
  streetAddressLine2: '地址第二行',
  city: '城市',
  state: '省/州',
  country: '国家',
  postal: '邮编',
  schools: '高中学校',
  schoolRecords: '高中学校',
  schoolName: '学校名称',
  schoolBoard: '所属教育局',
  boardName: '所属教育局',
  educationBureau: '所属教育局',
  schoolType: '学校类型',
  startTime: '开始日期',
  endTime: '结束日期',
  transcriptFileName: '成绩单文件名',
  transcriptSizeBytes: '成绩单文件大小',
  transcriptUploadedAt: '成绩单上传时间',
  hasTranscript: '成绩单状态',
  transcripts: '成绩单列表',
  otherCourses: '校外课程',
  externalCourses: '校外课程',
  courseCode: '课程代码',
  mark: '分数',
  gradeLevel: '年级',
  identityFiles: '身份证明文件',
  identityFileName: '身份证明文件名',
  identityFileSizeBytes: '身份证明文件大小',
  identityFileUploadedAt: '身份证明上传时间',
};

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
  readonly studentRegionOptions = STUDENT_REGION_OPTIONS;
  readonly schoolBoardOptions: string[] = [...EDUCATION_BOARD_LIBRARY_OPTIONS];
  readonly serviceItemOptions: readonly string[] = [...SERVICE_ITEM_OPTIONS];
  readonly identityDocumentTypeOptions: readonly IdentityDocumentType[] = [...IDENTITY_DOCUMENT_TYPE_OPTIONS];
  readonly academicRecordTypeOptions: readonly AcademicRecordType[] = [...ACADEMIC_RECORD_TYPE_OPTIONS];
  readonly reportMonthOptions: readonly string[] = [...REPORT_MONTH_OPTIONS];
  readonly historyPageSize = 20;

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
  penError = '';
  editing = false;
  historyPanelOpen = false;
  historyLoading = false;
  historyError = '';
  historyEntries: StudentProfileHistoryEntry[] = [];
  historyTotal = 0;
  historyPage = 0;
  historySize = this.historyPageSize;
  profileVersion: number | null = null;

  model: StudentProfileModel = this.defaultModel();
  highSchoolLookupOptions: CanadianHighSchoolLookupItem[][] = [[]];
  highSchoolLookupLoading: boolean[] = [false];
  highSchoolTranscriptUploading: boolean[] = [false];
  highSchoolTranscriptTypeSelection: AcademicRecordType[] = ['Transcript'];
  highSchoolReportYearSelection: string[] = [''];
  highSchoolReportMonthSelection: string[] = [''];
  identityFileUploading = false;
  identityDocumentTypeSelection: IdentityDocumentType = 'Other';
  externalCourseProviderLookupOptions: CanadianHighSchoolLookupItem[][] = [];
  externalCourseProviderLookupLoading: boolean[] = [];
  private lastSavedPayloadDigest = '';
  private pendingAutoSave = false;
  private saveInProgress = false;
  private pendingSelfOnboardingEdit = false;
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
    if (this.shouldSkipAutoSaveForNextTarget(event.relatedTarget)) return;
    if (!this.shouldAutoSaveTarget(event.target)) return;

    this.triggerAutoSave();
  }

  onStatusInCanadaSelectionChange(value: string): void {
    this.statusInCanadaSelection = String(value ?? '');
    if (this.statusInCanadaSelection === this.statusInCanadaOtherOptionValue) {
      this.model.statusInCanada = this.toText(this.statusInCanadaOtherText);
      if (!this.model.statusInCanada) return;
      this.triggerAutoSave();
      return;
    }

    this.statusInCanadaOtherText = '';
    this.model.statusInCanada = this.toText(this.statusInCanadaSelection);
    this.triggerAutoSave();
  }

  onStatusInCanadaOtherTextChange(value: string): void {
    this.statusInCanadaOtherText = String(value ?? '');
    if (this.statusInCanadaSelection !== this.statusInCanadaOtherOptionValue) return;

    this.model.statusInCanada = this.toText(this.statusInCanadaOtherText);
  }

  onPhoneInputChange(value: string): void {
    this.model.phone = this.formatPhoneForDisplay(value);
  }

  onCitizenshipInputChange(value: string): void {
    this.model.citizenship = this.normalizeCitizenshipToStandardEnglish(value);
  }

  onGenderSelectionChange(value: string): void {
    const normalized = this.normalizeGender(value);
    this.model.gender = normalized;
    if (normalized !== 'Other') {
      this.model.genderOther = '';
    }
  }

  onGenderOtherInputChange(value: string): void {
    this.model.genderOther = this.toText(value);
    if (this.model.gender !== 'Other' && this.model.genderOther) {
      this.model.gender = 'Other';
    }
  }

  onPostalInputChange(value: string): void {
    this.model.address.postal = this.formatPostalForDisplay(value, this.model.address.country);
  }

  onCountryInputChange(value: string): void {
    const normalizedCountry = this.normalizeCountryToStandardEnglish(value);
    this.model.address.country = normalizedCountry;
    this.model.address.postal = this.formatPostalForDisplay(this.model.address.postal, normalizedCountry);
  }

  onStudentRegionChange(value: string): void {
    this.model.studentRegion = this.resolveStudentRegionForPayload(value) || 'Ontario';
    this.applyLocalStudentNumberVisibilityRules();
    this.validateLocalStudentNumbers();
    this.triggerAutoSave();
  }

  onOenInputChange(value: string): void {
    this.model.oenNumber = this.normalizeOenNumber(value);
    this.validateLocalStudentNumbers();
  }

  onPenInputChange(value: string): void {
    this.model.penNumber = this.normalizePenNumber(value);
    this.validateLocalStudentNumbers();
  }

  onServiceItemSelectionChange(item: string, checked: boolean): void {
    const nextItems = checked
      ? [...this.model.serviceItems, item]
      : this.model.serviceItems.filter((selected) => selected !== item);
    this.model.serviceItems = this.normalizeServiceItems(nextItems);
    this.triggerAutoSave();
  }

  onHighSchoolNameInputChange(index: number, value: string): void {
    const school = this.model.highSchools[index];
    if (!school) return;

    school.schoolName = this.toText(value);
    this.fetchHighSchoolLookupOptions(index, school.schoolName);
  }

  onHighSchoolBoardInputChange(index: number, value: string): void {
    const school = this.model.highSchools[index];
    if (!school) return;

    school.schoolBoard = this.toText(value);
  }

  onHighSchoolPostalInputChange(index: number, value: string): void {
    const school = this.model.highSchools[index];
    if (!school) return;
    school.postal = this.formatPostalForDisplay(value, school.country || 'Canada');
  }

  onHighSchoolCountryInputChange(index: number, value: string): void {
    const school = this.model.highSchools[index];
    if (!school) return;
    const normalizedCountry = this.normalizeCountryToStandardEnglish(value);
    school.country = normalizedCountry;
    school.postal = this.formatPostalForDisplay(school.postal, normalizedCountry);
  }

  getHighSchoolTranscriptType(index: number): AcademicRecordType {
    return this.highSchoolTranscriptTypeSelection[index] || 'Transcript';
  }

  onHighSchoolTranscriptTypeChange(index: number, value: string): void {
    const normalizedType: AcademicRecordType = value === 'Report Card' ? 'Report Card' : 'Transcript';
    this.highSchoolTranscriptTypeSelection[index] = normalizedType;
    if (normalizedType !== 'Report Card') {
      this.highSchoolReportYearSelection[index] = '';
      this.highSchoolReportMonthSelection[index] = '';
    }
  }

  shouldShowReportCardDateFields(index: number): boolean {
    return this.getHighSchoolTranscriptType(index) === 'Report Card';
  }

  onHighSchoolTranscriptFileSelected(index: number, event: Event): void {
    const school = this.model.highSchools[index];
    if (!school) return;

    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;

    const uploadOptions = this.buildSchoolTranscriptUploadOptions(index);
    if (!uploadOptions) {
      if (input) input.value = '';
      this.cdr.detectChanges();
      return;
    }

    if (this.isProfileBusyForTranscriptUpload()) {
      this.retrySchoolTranscriptUploadWhenIdle(index, file, input, 0, uploadOptions);
      return;
    }

    const schoolRecordId = this.toOptionalNumber(school.schoolRecordId);
    if (schoolRecordId === null) {
      this.persistProfileThenUploadSchoolTranscript(index, file, input, 0, uploadOptions);
      return;
    }

    this.uploadSchoolTranscript(index, schoolRecordId, file, input, true, uploadOptions);
  }

  onIdentityFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const files = Array.from(input?.files ?? []);
    if (files.length <= 0) return;

    if (this.isProfileBusyForIdentityUpload()) {
      this.retryIdentityFileUploadWhenIdle(files, input);
      return;
    }

    this.uploadIdentityFiles(files, input);
  }

  private uploadIdentityFiles(files: File[], input: HTMLInputElement | null): void {
    if (files.length <= 0) return;
    this.identityFileUploading = true;
    this.error = '';
    this.cdr.detectChanges();

    const identityDocumentType: IdentityDocumentType =
      this.identityDocumentTypeOptions.find(
        (option) =>
          this.toText(option).toLowerCase() === this.toText(this.identityDocumentTypeSelection).toLowerCase()
      ) || 'Other';

    const uploadOne = (file: File) =>
      this.managedMode && this.managedStudentId
        ? this.profileApi.uploadStudentIdentityFileForTeacher(
            this.managedStudentId,
            file,
            identityDocumentType
          )
        : this.profileApi.uploadMyIdentityFile(file, identityDocumentType);

    from(files)
      .pipe(
        concatMap((file) =>
          uploadOne(file).pipe(
            tap((payload) => {
              this.applyIdentityFilePayload(payload);
            })
          )
        ),
        toArray(),
        finalize(() => {
          this.identityFileUploading = false;
          if (input) input.value = '';
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: () => {
          this.saved = true;
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          const totalSizeBytes = files.reduce((sum, item) => sum + (item?.size || 0), 0);
          if ((err.status === 0 || err.status === 413) && totalSizeBytes > 1024 * 1024) {
            this.saved = false;
            this.error = `上传失败：当前文件总大小 ${this.formatBytes(totalSizeBytes)}，当前服务端上传上限过小（常见为 1MB）。请联系后端调大后再试。`;
            this.cdr.detectChanges();
            return;
          }
          this.saved = false;
          this.error = this.extractErrorMessage(err) || '上传身份证明文件失败。';
          this.cdr.detectChanges();
        },
      });
  }

  private isProfileBusyForIdentityUpload(): boolean {
    return this.loading || this.saving || this.saveInProgress || this.identityFileUploading;
  }

  private retryIdentityFileUploadWhenIdle(
    files: File[],
    input: HTMLInputElement | null,
    retryAttempt = 0
  ): void {
    if (retryAttempt >= IDENTITY_UPLOAD_RETRY_LIMIT) {
      if (input) input.value = '';
      this.error = '档案仍在保存中，身份证明文件上传未开始，请稍后重试。';
      this.cdr.detectChanges();
      return;
    }

    setTimeout(() => {
      if (this.isProfileBusyForIdentityUpload()) {
        this.retryIdentityFileUploadWhenIdle(files, input, retryAttempt + 1);
        return;
      }

      this.uploadIdentityFiles(files, input);
    }, IDENTITY_UPLOAD_RETRY_DELAY_MS);
  }

  downloadHighSchoolTranscript(index: number, transcriptIndex = 0): void {
    const school = this.model.highSchools[index];
    if (!school || !school.schoolRecordId || !school.hasTranscript) return;
    if (this.loading || this.saving) return;

    const selectedTranscript =
      transcriptIndex >= 0 && transcriptIndex < school.transcripts.length
        ? school.transcripts[transcriptIndex]
        : null;

    const request$ =
      this.managedMode && this.managedStudentId
        ? this.profileApi.downloadStudentSchoolTranscriptForTeacher(this.managedStudentId, school.schoolRecordId)
        : this.profileApi.downloadMySchoolTranscript(school.schoolRecordId);

    request$.subscribe({
      next: (resp) => {
        const blob = resp.body;
        if (!blob) return;
        const contentDisposition = resp.headers.get('content-disposition');
        const fileName =
          this.resolveDownloadFileName(contentDisposition) ||
          this.toText(selectedTranscript?.transcriptFileName) ||
          this.toText(school.transcriptFileName) ||
          'school-transcript.bin';
        this.triggerBlobDownload(blob, fileName);
      },
      error: (err: HttpErrorResponse) => {
        this.error = this.extractErrorMessage(err) || '下载成绩单失败。';
        this.cdr.detectChanges();
      },
    });
  }

  downloadIdentityFile(index: number): void {
    const identityFile = this.model.identityFiles[index];
    if (!identityFile) return;
    if (!identityFile.identityFileId) return;
    if (this.loading || this.saving || this.identityFileUploading) return;

    const request$ =
      this.managedMode && this.managedStudentId
        ? this.profileApi.downloadStudentIdentityFileForTeacher(
            this.managedStudentId,
            identityFile.identityFileId
          )
        : this.profileApi.downloadMyIdentityFile(identityFile.identityFileId);

    request$.subscribe({
      next: (resp) => {
        const blob = resp.body;
        if (!blob) return;
        const contentDisposition = resp.headers.get('content-disposition');
        const fileName =
          this.resolveDownloadFileName(contentDisposition) ||
          this.toText(identityFile.identityFileName) ||
          'identity-file.bin';
        this.triggerBlobDownload(blob, fileName);
      },
      error: (err: HttpErrorResponse) => {
        this.error = this.extractErrorMessage(err) || '下载身份证明文件失败。';
        this.cdr.detectChanges();
      },
    });
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

  formatBytes(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return '-';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = value;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) {
      size /= 1024;
      index += 1;
    }
    return `${size >= 10 || index === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`;
  }

  displayBoolean(value: boolean): string {
    return value ? '是' : '否';
  }

  openHistory(): void {
    if (this.invalidManagedStudentId || this.historyLoading) return;

    this.historyPanelOpen = true;
    this.loadProfileHistory();
  }

  closeHistory(): void {
    this.historyPanelOpen = false;
    this.historyError = '';
  }

  refreshProfileHistory(): void {
    if (!this.historyPanelOpen || this.historyLoading) return;
    this.loadProfileHistory();
  }

  displayHistorySummary(): string {
    if (this.historyEntries.length <= 0) return '';

    const loaded = this.historyEntries.length;
    const total = this.historyTotal > 0 ? this.historyTotal : loaded;
    const size = this.historySize > 0 ? this.historySize : this.historyPageSize;

    if (total <= loaded) return `共 ${total} 条`;
    return `已显示 ${loaded} / 共 ${total} 条（每页 ${size} 条）`;
  }

  displayHistoryTimestamp(entry: StudentProfileHistoryEntry): string {
    const raw = this.toText(entry.changedAt || entry.createdAt || entry.timestamp);
    if (!raw) return '-';

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;

    const pad = (value: number) => String(value).padStart(2, '0');
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
    ].join('-') + ` ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  displayHistoryActor(entry: StudentProfileHistoryEntry): string {
    const role = this.displayHistoryRole(entry.actorRole || entry.changedByRole || entry.role);
    const name = this.toText(
      entry.actorName || entry.changedByName || entry.actorDisplayName || entry.changedBy
    );

    if (role && name) return `${role} ${name}`;
    return role || name || '未知用户';
  }

  displayHistorySource(entry: StudentProfileHistoryEntry): string {
    const source = this.toText(entry.changeSource || entry.source)
      .toLowerCase()
      .replace(/\s+/g, '_');

    if (source === 'autosave' || source === 'auto_save' || source.includes('auto')) return '自动保存';
    if (source === 'manual' || source === 'manual_save' || source.includes('manual')) return '手动保存';
    if (source === 'file' || source === 'file_upload' || source.includes('upload')) return '文件上传';
    if (source === 'restore' || source === 'version_restore' || source.includes('restore')) return '历史恢复';
    return source ? source : '档案修改';
  }

  displayHistoryVersion(entry: StudentProfileHistoryEntry): string {
    const fromVersion = this.toOptionalNumber(entry.fromVersion);
    const toVersion = this.toOptionalNumber(entry.toVersion || entry.version);

    if (fromVersion !== null && toVersion !== null) return `${fromVersion} -> ${toVersion}`;
    if (toVersion !== null) return String(toVersion);
    return '';
  }

  getHistoryChanges(entry: StudentProfileHistoryEntry): StudentProfileHistoryFieldChange[] {
    return Array.isArray(entry.changedFields) ? entry.changedFields : [];
  }

  displayHistoryField(change: StudentProfileHistoryFieldChange): string {
    const label = this.toText(change.label);
    if (label) return label;

    const path = this.toText(change.path || change.field || change.name);
    if (!path) return '字段';

    const lastPart = path.split('.').pop() || path;
    const key = lastPart.replace(/\[\d+\]/g, '');
    return VALIDATION_FIELD_LABELS[key] || VALIDATION_COLLECTION_LABELS[key] || path;
  }

  getHistoryBeforeValue(change: StudentProfileHistoryFieldChange): unknown {
    if (Object.prototype.hasOwnProperty.call(change, 'before')) return change.before;
    if (Object.prototype.hasOwnProperty.call(change, 'oldValue')) return change.oldValue;
    if (Object.prototype.hasOwnProperty.call(change, 'from')) return change.from;
    return undefined;
  }

  getHistoryAfterValue(change: StudentProfileHistoryFieldChange): unknown {
    if (Object.prototype.hasOwnProperty.call(change, 'after')) return change.after;
    if (Object.prototype.hasOwnProperty.call(change, 'newValue')) return change.newValue;
    if (Object.prototype.hasOwnProperty.call(change, 'to')) return change.to;
    return undefined;
  }

  displayHistoryValue(value: unknown): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return this.displayBoolean(value);
    if (typeof value === 'number') return String(value);

    if (Array.isArray(value)) {
      const items = value.map((item) => this.toText(item)).filter(Boolean);
      return items.length > 0 ? items.join('、') : '-';
    }

    if (typeof value === 'object') {
      return '已修改';
    }

    return this.displayText(value);
  }

  shouldShowOenField(): boolean {
    return this.model.studentRegion === 'Ontario';
  }

  shouldShowPenField(): boolean {
    return this.model.studentRegion === 'British Columbia';
  }

  displayStudentRegion(): string {
    const option = this.studentRegionOptions.find((candidate) => candidate.value === this.model.studentRegion);
    return option?.label || '-';
  }

  displayServiceItems(): string {
    return this.model.serviceItems.length > 0 ? this.model.serviceItems.join('、') : '-';
  }

  isServiceItemSelected(item: string): boolean {
    return this.model.serviceItems.some(
      (selected) => this.normalizeTextKey(selected) === this.normalizeTextKey(item)
    );
  }

  displayGender(): string {
    if (!this.model.gender) return '-';
    if (this.model.gender !== 'Other') return this.model.gender;
    const detail = this.toText(this.model.genderOther);
    return detail ? `Other (${detail})` : 'Other';
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

  displaySchoolTranscript(school: HighSchoolModel): string {
    const count = Array.isArray(school.transcripts) ? school.transcripts.length : 0;
    if (count <= 0) return '未上传';
    return `已上传 ${count} 份`;
  }

  displaySchoolTranscriptFileName(school: HighSchoolModel, transcriptIndex: number): string {
    const transcript = school.transcripts[transcriptIndex];
    const name = this.toText(transcript?.transcriptFileName);
    return name || `已上传文件 #${transcriptIndex + 1}`;
  }

  displaySchoolTranscriptMeta(school: HighSchoolModel, transcriptIndex: number): string {
    const transcript = school.transcripts[transcriptIndex];
    if (!transcript) return '';
    const size = this.formatBytes(transcript.transcriptSizeBytes);
    const uploadedAt = this.toText(transcript.transcriptUploadedAt);
    if (size !== '-') {
      if (uploadedAt) return `${size}, ${uploadedAt}`;
      return size;
    }
    if (uploadedAt) return uploadedAt;
    return '';
  }

  displayIdentityFilesSummary(): string {
    const count = Array.isArray(this.model.identityFiles) ? this.model.identityFiles.length : 0;
    if (count <= 0) return '未上传';
    return `已上传 ${count} 份`;
  }

  displayIdentityFileName(index: number): string {
    const file = this.model.identityFiles[index];
    const name = this.toText(file?.identityFileName);
    return name || `已上传文件 #${index + 1}`;
  }

  displayIdentityFileMeta(index: number): string {
    const file = this.model.identityFiles[index];
    if (!file) return '';
    const size = this.formatBytes(file.identityFileSizeBytes);
    const uploadedAt = this.toText(file.identityFileUploadedAt);
    if (size !== '-') {
      if (uploadedAt) return `${size}, ${uploadedAt}`;
      return size;
    }
    return uploadedAt;
  }

  removeIdentityFile(index: number): void {
    if (index < 0 || index >= this.model.identityFiles.length) return;
    this.model.identityFiles.splice(index, 1);
    this.error = '';
    this.saved = false;
    this.cdr.detectChanges();
    this.triggerAutoSave();
  }

  removeHighSchoolTranscript(index: number, transcriptIndex: number): void {
    const school = this.model.highSchools[index];
    if (!school) return;
    if (transcriptIndex < 0 || transcriptIndex >= school.transcripts.length) return;

    school.transcripts.splice(transcriptIndex, 1);
    this.syncSchoolTranscriptLegacyFields(school);
    this.error = '';
    this.saved = false;
    this.cdr.detectChanges();
    this.triggerAutoSave();
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
    this.highSchoolTranscriptUploading.push(false);
    this.highSchoolTranscriptTypeSelection.push('Transcript');
    this.highSchoolReportYearSelection.push('');
    this.highSchoolReportMonthSelection.push('');
  }

  removeHighSchool(index: number): void {
    // Keep one default current school entry at all times.
    if (index <= 0) return;
    if (index >= this.model.highSchools.length) return;
    this.model.highSchools.splice(index, 1);
    this.highSchoolLookupOptions.splice(index, 1);
    this.highSchoolLookupLoading.splice(index, 1);
    this.highSchoolTranscriptUploading.splice(index, 1);
    this.highSchoolTranscriptTypeSelection.splice(index, 1);
    this.highSchoolReportYearSelection.splice(index, 1);
    this.highSchoolReportMonthSelection.splice(index, 1);
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

  private uploadSchoolTranscript(
    index: number,
    schoolRecordId: number,
    file: File,
    input: HTMLInputElement | null,
    allowRefreshOnNotFound = true,
    uploadOptions: SchoolTranscriptUploadOptions = {}
  ): void {
    const uploadHint = this.buildSchoolUploadHint(index);
    this.highSchoolTranscriptUploading[index] = true;
    this.error = '';
    this.cdr.detectChanges();

    const request$ =
      this.managedMode && this.managedStudentId
        ? this.profileApi.uploadStudentSchoolTranscriptForTeacher(
            this.managedStudentId,
            schoolRecordId,
            file,
            uploadOptions
          )
        : this.profileApi.uploadMySchoolTranscript(schoolRecordId, file, uploadOptions);

    request$
      .pipe(
        finalize(() => {
          this.highSchoolTranscriptUploading[index] = false;
          if (input) input.value = '';
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (payload) => {
          const school = this.model.highSchools[index];
          if (!school) return;
          this.applySchoolTranscriptPayload(school, payload);
          this.saved = true;
        },
        error: (err: HttpErrorResponse) => {
          if (allowRefreshOnNotFound && err.status === 404) {
            this.refreshProfileThenUploadSchoolTranscript(index, uploadHint, file, input, uploadOptions);
            return;
          }
          if ((err.status === 0 || err.status === 413) && file.size > 1024 * 1024) {
            this.saved = false;
            this.error = `上传失败：当前文件 ${this.formatBytes(file.size)}，当前服务端上传上限过小（常见为 1MB）。请联系后端调大后再试。`;
            return;
          }
          this.saved = false;
          this.error = this.extractErrorMessage(err) || '上传成绩单失败。';
        },
      });
  }

  private persistProfileThenUploadSchoolTranscript(
    index: number,
    file: File,
    input: HTMLInputElement | null,
    retryAttempt = 0,
    uploadOptions: SchoolTranscriptUploadOptions = {}
  ): void {
    if (this.invalidManagedStudentId || (this.managedMode && !this.managedStudentId)) {
      this.error = '路由中的学生 ID 无效。';
      if (input) input.value = '';
      this.cdr.detectChanges();
      return;
    }

    if (this.isProfileBusyForTranscriptUpload()) {
      this.retrySchoolTranscriptUploadWhenIdle(index, file, input, retryAttempt, uploadOptions);
      return;
    }

    if (!this.validateLocalStudentNumbers()) {
      this.error = this.oenError || this.penError;
      if (input) input.value = '';
      this.cdr.detectChanges();
      return;
    }
    if (!this.validateRequiredMainHighSchoolName()) {
      if (input) input.value = '';
      this.cdr.detectChanges();
      return;
    }

    const uploadHint = this.buildSchoolUploadHint(index);
    const payload = this.toPayload(this.model);
    this.error = '';
    this.saved = false;
    this.saveInProgress = true;
    this.saving = true;
    this.cdr.detectChanges();

    const request$ =
      this.managedMode && this.managedStudentId
        ? this.saveStudentProfileWithContext(this.managedStudentId, payload, 'file_upload')
        : this.saveMyProfileWithContext(payload, 'file_upload');

    request$
      .pipe(
        finalize(() => {
          this.saveInProgress = false;
          this.saving = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (resp) => {
          this.profileVersion = this.resolveProfileVersion(resp);
          const resolved = this.unwrapProfile(resp);
          const hasResolvedData = Object.keys(resolved).length > 0;
          this.model = this.normalizeModel(hasResolvedData ? resolved : payload);
          this.syncHighSchoolLookupState();
          this.syncExternalCourseProviderLookupState();
          this.syncStatusInCanadaControls();
          this.validateLocalStudentNumbers();
          this.lastSavedPayloadDigest = this.buildPayloadDigest(this.model);

          const uploadTarget = this.resolveSchoolUploadTarget(index, uploadHint);
          if (!uploadTarget) {
            this.refreshProfileThenUploadSchoolTranscript(index, uploadHint, file, input, uploadOptions);
            return;
          }

          this.uploadSchoolTranscript(
            uploadTarget.index,
            uploadTarget.schoolRecordId,
            file,
            input,
            true,
            uploadOptions
          );
        },
        error: (err: HttpErrorResponse) => {
          if (this.handleProfileVersionConflict(err)) {
            if (input) input.value = '';
            this.cdr.detectChanges();
            return;
          }
          this.saved = false;
          this.error = this.extractErrorMessage(err) || '保存学校信息失败，无法上传成绩单。';
          if (input) input.value = '';
          this.cdr.detectChanges();
        },
      });
  }

  private applySchoolTranscriptPayload(school: HighSchoolModel, payload: StudentSchoolTranscriptPayload): void {
    school.schoolRecordId =
      payload.schoolRecordId === null || payload.schoolRecordId === undefined
        ? school.schoolRecordId
        : Number(payload.schoolRecordId);
    const payloadTranscripts = this.extractSchoolTranscripts(payload);
    if (payloadTranscripts.length > 0) {
      const hasTranscriptListInPayload = Array.isArray((payload as any)?.transcripts);
      school.transcripts = hasTranscriptListInPayload
        ? payloadTranscripts
        : this.appendSchoolTranscripts(school.transcripts, payloadTranscripts);
    }
    this.syncSchoolTranscriptLegacyFields(school);
  }

  private applyIdentityFilePayload(payload: StudentIdentityFilePayload): void {
    const payloadIdentityFiles = this.extractIdentityFiles(payload);
    if (payloadIdentityFiles.length <= 0) return;

    const hasIdentityFileListInPayload = Array.isArray((payload as any)?.identityFiles);
    this.model.identityFiles = hasIdentityFileListInPayload
      ? payloadIdentityFiles
      : [...this.model.identityFiles, ...payloadIdentityFiles];
    this.model.identityFiles = this.normalizeIdentityFiles(this.model.identityFiles);
  }

  private extractIdentityFiles(source: unknown): IdentityFileModel[] {
    const node: any = source && typeof source === 'object' ? source : {};
    const rawIdentityFiles = Array.isArray(node.identityFiles)
      ? node.identityFiles
      : Array.isArray(node.identityDocuments)
        ? node.identityDocuments
        : Array.isArray(node.files)
          ? node.files
          : [];

    const listFromArray = rawIdentityFiles
      .map((item: unknown) => this.normalizeIdentityFile(item))
      .filter((item: IdentityFileModel | null): item is IdentityFileModel => item !== null);
    if (listFromArray.length > 0) {
      return this.normalizeIdentityFiles(listFromArray);
    }

    const single = this.normalizeIdentityFile(node);
    if (!single) return [];
    return [single];
  }

  private normalizeIdentityFile(value: unknown): IdentityFileModel | null {
    const source: any = value && typeof value === 'object' ? value : {};
    const fileName = this.toText(
      source.identityFileName || source.originalFilename || source.fileName || source.name
    );
    if (!fileName) return null;

    return {
      identityFileId: this.toOptionalNumber(source.identityFileId ?? source.fileId ?? source.id),
      identityFileName: fileName,
      identityFileSizeBytes: this.toOptionalNumber(
        source.identityFileSizeBytes ?? source.sizeBytes ?? source.size
      ),
      identityFileUploadedAt: this.toText(
        source.identityFileUploadedAt || source.uploadedAt || source.uploadTime || source.createdAt
      ),
    };
  }

  private normalizeIdentityFiles(files: IdentityFileModel[]): IdentityFileModel[] {
    return files.map((file) => ({
      identityFileId: this.toOptionalNumber(file.identityFileId),
      identityFileName: this.toText(file.identityFileName),
      identityFileSizeBytes: this.toOptionalNumber(file.identityFileSizeBytes),
      identityFileUploadedAt: this.toText(file.identityFileUploadedAt),
    }));
  }

  private extractSchoolTranscripts(source: unknown): SchoolTranscriptModel[] {
    const node: any = source && typeof source === 'object' ? source : {};
    const rawTranscripts = Array.isArray(node.transcripts)
      ? node.transcripts
      : Array.isArray(node.files)
        ? node.files
        : Array.isArray(node.attachments)
          ? node.attachments
          : [];

    const listFromArray = rawTranscripts
      .map((item: unknown) => this.normalizeSchoolTranscript(item))
      .filter((item: SchoolTranscriptModel | null): item is SchoolTranscriptModel => item !== null);

    if (listFromArray.length > 0) {
      return listFromArray;
    }

    const single = this.normalizeSchoolTranscript(node);
    if (!single) return [];
    return [single];
  }

  private normalizeSchoolTranscript(value: unknown): SchoolTranscriptModel | null {
    const source: any = value && typeof value === 'object' ? value : {};
    const fileName = this.toText(
      source.transcriptFileName ||
        source.transcriptOriginalFilename ||
        source.fileName ||
        source.originalFilename ||
        source.name
    );
    if (!fileName) return null;

    return {
      transcriptFileName: fileName,
      transcriptSizeBytes: this.toOptionalNumber(
        source.transcriptSizeBytes ?? source.sizeBytes ?? source.size
      ),
      transcriptUploadedAt: this.toText(
        source.transcriptUploadedAt || source.uploadedAt || source.uploadTime || source.createdAt
      ),
    };
  }

  private appendSchoolTranscripts(
    current: SchoolTranscriptModel[],
    incoming: SchoolTranscriptModel[]
  ): SchoolTranscriptModel[] {
    const base = Array.isArray(current) ? current : [];
    return [...base, ...incoming].map((transcript) => ({
      transcriptFileName: this.toText(transcript.transcriptFileName),
      transcriptSizeBytes: this.toOptionalNumber(transcript.transcriptSizeBytes),
      transcriptUploadedAt: this.toText(transcript.transcriptUploadedAt),
    }));
  }

  private syncSchoolTranscriptLegacyFields(school: HighSchoolModel): void {
    const transcripts = (Array.isArray(school.transcripts) ? school.transcripts : []).map((transcript) => ({
      transcriptFileName: this.toText(transcript.transcriptFileName),
      transcriptSizeBytes: this.toOptionalNumber(transcript.transcriptSizeBytes),
      transcriptUploadedAt: this.toText(transcript.transcriptUploadedAt),
    }));
    school.transcripts = transcripts;

    const latest = transcripts.length > 0 ? transcripts[transcripts.length - 1] : null;
    school.transcriptFileName = this.toText(latest?.transcriptFileName);
    school.transcriptSizeBytes = this.toOptionalNumber(latest?.transcriptSizeBytes);
    school.transcriptUploadedAt = this.toText(latest?.transcriptUploadedAt);
    school.hasTranscript = transcripts.length > 0;
  }

  private refreshProfileThenUploadSchoolTranscript(
    fallbackIndex: number,
    uploadHint: SchoolUploadHint | null,
    file: File,
    input: HTMLInputElement | null,
    uploadOptions: SchoolTranscriptUploadOptions = {}
  ): void {
    const request$ =
      this.managedMode && this.managedStudentId
        ? this.profileApi.getStudentProfileForTeacher(this.managedStudentId)
        : this.profileApi.getMyProfile();

    request$.subscribe({
      next: (resp) => {
        this.model = this.normalizeModel(this.unwrapProfile(resp));
        this.syncHighSchoolLookupState();
        this.syncExternalCourseProviderLookupState();
        this.syncStatusInCanadaControls();
        this.validateLocalStudentNumbers();
        this.lastSavedPayloadDigest = this.buildPayloadDigest(this.model);

        const uploadTarget = this.resolveSchoolUploadTarget(fallbackIndex, uploadHint);
        if (!uploadTarget) {
          this.error = '保存后未获取学校记录 ID，请先点保存后再上传。';
          if (input) input.value = '';
          this.cdr.detectChanges();
          return;
        }

        this.uploadSchoolTranscript(
          uploadTarget.index,
          uploadTarget.schoolRecordId,
          file,
          input,
          false,
          uploadOptions
        );
      },
        error: (err: HttpErrorResponse) => {
          this.saved = false;
          this.error = this.extractErrorMessage(err) || '刷新学校信息失败，无法上传成绩单。';
          if (input) input.value = '';
          this.cdr.detectChanges();
        },
    });
  }

  private resolveSchoolUploadTarget(
    fallbackIndex: number,
    uploadHint: SchoolUploadHint | null
  ): SchoolUploadTarget | null {
    const fallbackSchool = this.model.highSchools[fallbackIndex];
    const fallbackSchoolRecordId = this.toOptionalNumber(fallbackSchool?.schoolRecordId);
    if (fallbackSchool && fallbackSchoolRecordId !== null) {
      return {
        index: fallbackIndex,
        schoolRecordId: fallbackSchoolRecordId,
      };
    }

    if (!uploadHint) return null;

    const normalizedHintName = this.normalizeLookupText(uploadHint.schoolName);
    const normalizedHintCity = this.normalizeLookupText(uploadHint.city);
    const normalizedHintPostal = this.normalizeLookupText(uploadHint.postal);
    for (let index = 0; index < this.model.highSchools.length; index += 1) {
      const school = this.model.highSchools[index];
      const schoolRecordId = this.toOptionalNumber(school?.schoolRecordId);
      if (!school || schoolRecordId === null) continue;
      if (school.schoolType !== uploadHint.schoolType) continue;

      const schoolNameMatches = this.normalizeLookupText(school.schoolName) === normalizedHintName;
      if (!schoolNameMatches) continue;

      const startMatches = this.normalizeDate(school.startTime) === uploadHint.startTime;
      const endMatches = this.normalizeDate(school.endTime) === uploadHint.endTime;
      if (startMatches && endMatches) {
        return { index, schoolRecordId };
      }

      const cityMatches = this.normalizeLookupText(school.city) === normalizedHintCity;
      const postalMatches = this.normalizeLookupText(school.postal) === normalizedHintPostal;
      if (cityMatches || postalMatches) {
        return { index, schoolRecordId };
      }
    }

    return null;
  }

  private buildSchoolUploadHint(index: number): SchoolUploadHint | null {
    const school = this.model.highSchools[index];
    if (!school) return null;

    return {
      schoolType: school.schoolType,
      schoolName: this.toText(school.schoolName),
      startTime: this.normalizeDate(school.startTime),
      endTime: this.normalizeDate(school.endTime),
      city: this.toText(school.city),
      postal: this.toText(school.postal),
    };
  }

  private buildSchoolTranscriptUploadOptions(index: number): SchoolTranscriptUploadOptions | null {
    const academicRecordType = this.getHighSchoolTranscriptType(index);
    if (academicRecordType !== 'Report Card') {
      this.highSchoolReportYearSelection[index] = '';
      this.highSchoolReportMonthSelection[index] = '';
      return { academicRecordType: 'Transcript' };
    }

    const reportYearText = this.toText(this.highSchoolReportYearSelection[index]);
    const reportYear = Number(reportYearText);
    if (!Number.isFinite(reportYear) || reportYear <= 0) {
      this.error = '请先填写 Report Card 的年份。';
      return null;
    }

    const normalizedReportMonth = this.resolveReportMonth(this.highSchoolReportMonthSelection[index]);
    if (!normalizedReportMonth) {
      this.error = '请先选择 Report Card 的月份。';
      return null;
    }

    this.highSchoolReportYearSelection[index] = String(Math.trunc(reportYear));
    this.highSchoolReportMonthSelection[index] = normalizedReportMonth;
    return {
      academicRecordType: 'Report Card',
      reportYear: Math.trunc(reportYear),
      reportMonth: normalizedReportMonth,
    };
  }

  private resolveReportMonth(value: unknown): string {
    const text = this.toText(value);
    if (!text) return '';
    const normalized = text.toLowerCase();
    const matched = this.reportMonthOptions.find((month) => month.toLowerCase() === normalized);
    return matched || '';
  }

  private isProfileBusyForTranscriptUpload(): boolean {
    return this.saveInProgress || this.loading || this.saving;
  }

  private retrySchoolTranscriptUploadWhenIdle(
    index: number,
    file: File,
    input: HTMLInputElement | null,
    retryAttempt = 0,
    uploadOptions: SchoolTranscriptUploadOptions = {}
  ): void {
    if (retryAttempt >= TRANSCRIPT_UPLOAD_RETRY_LIMIT) {
      this.error = '档案正在保存中，请稍后重试上传。';
      if (input) input.value = '';
      this.cdr.detectChanges();
      return;
    }

    setTimeout(() => {
      const school = this.model.highSchools[index];
      if (!school) {
        if (input) input.value = '';
        return;
      }

      if (this.isProfileBusyForTranscriptUpload()) {
        this.retrySchoolTranscriptUploadWhenIdle(index, file, input, retryAttempt + 1, uploadOptions);
        return;
      }

      const schoolRecordId = this.toOptionalNumber(school.schoolRecordId);
      if (schoolRecordId !== null) {
        this.uploadSchoolTranscript(index, schoolRecordId, file, input, true, uploadOptions);
        return;
      }

      this.persistProfileThenUploadSchoolTranscript(index, file, input, retryAttempt + 1, uploadOptions);
    }, TRANSCRIPT_UPLOAD_RETRY_DELAY_MS);
  }

  private triggerBlobDownload(blob: Blob, fileName: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName || 'download.bin';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
  }

  private resolveDownloadFileName(contentDisposition: string | null): string {
    const header = this.toText(contentDisposition);
    if (!header) return '';

    const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match && utf8Match[1]) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch {
        return utf8Match[1];
      }
    }

    const asciiMatch = header.match(/filename="?([^\";]+)"?/i);
    if (asciiMatch && asciiMatch[1]) return asciiMatch[1];
    return '';
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
      forkJoin({
        highSchools: this.profileApi.searchCanadianHighSchools(text),
        providers: this.profileApi.searchOntarioCourseProviders(text),
      }).subscribe({
        next: ({ highSchools, providers }) => {
          const currentName = this.toText(this.model.highSchools[index]?.schoolName).toLowerCase();
          if (currentName !== expectedName) {
            this.highSchoolLookupLoading[index] = false;
            return;
          }
          this.highSchoolLookupOptions[index] = this.mergeHighSchoolLookupOptions(highSchools, providers);
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

  private mergeHighSchoolLookupOptions(
    highSchools: CanadianHighSchoolLookupItem[],
    providers: CanadianHighSchoolLookupItem[]
  ): CanadianHighSchoolLookupItem[] {
    const merged = [...highSchools, ...providers];
    const dedupedByKey = new Map<string, CanadianHighSchoolLookupItem>();

    for (const option of merged) {
      const key = `${this.normalizeLookupText(option.name)}|${this.normalizeLookupText(option.streetAddress)}|${this.normalizeLookupText(option.postal)}`;
      const existing = dedupedByKey.get(key);
      if (!existing) {
        dedupedByKey.set(key, { ...option });
        continue;
      }

      if (!this.toText(existing.boardName) && this.toText(option.boardName)) {
        existing.boardName = this.toText(option.boardName);
      }
      if (!this.toText(existing.schoolSpecialConditions) && this.toText(option.schoolSpecialConditions)) {
        existing.schoolSpecialConditions = this.toText(option.schoolSpecialConditions);
      }
      if (!this.toText(existing.streetAddress) && this.toText(option.streetAddress)) {
        existing.streetAddress = this.toText(option.streetAddress);
      }
      if (!this.toText(existing.city) && this.toText(option.city)) {
        existing.city = this.toText(option.city);
      }
      if (!this.toText(existing.state) && this.toText(option.state)) {
        existing.state = this.toText(option.state);
      }
      if (!this.toText(existing.country) && this.toText(option.country)) {
        existing.country = this.toText(option.country);
      }
      if (!this.toText(existing.postal) && this.toText(option.postal)) {
        existing.postal = this.toText(option.postal);
      }
      if (!this.toText(existing.displayAddress) && this.toText(option.displayAddress)) {
        existing.displayAddress = this.toText(option.displayAddress);
      }
    }

    return Array.from(dedupedByKey.values());
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
    const exactMatches = options.filter(
      (option) => this.normalizeLookupText(option.name) === inputText
    );
    if (exactMatches.length <= 0) return null;

    const merged = { ...exactMatches[0] };
    for (const option of exactMatches.slice(1)) {
      if (!this.toText(merged.boardName) && this.toText(option.boardName)) {
        merged.boardName = this.toText(option.boardName);
      }
      if (!this.toText(merged.schoolSpecialConditions) && this.toText(option.schoolSpecialConditions)) {
        merged.schoolSpecialConditions = this.toText(option.schoolSpecialConditions);
      }
      if (!this.toText(merged.streetAddress) && this.toText(option.streetAddress)) {
        merged.streetAddress = this.toText(option.streetAddress);
      }
      if (!this.toText(merged.city) && this.toText(option.city)) {
        merged.city = this.toText(option.city);
      }
      if (!this.toText(merged.state) && this.toText(option.state)) {
        merged.state = this.toText(option.state);
      }
      if (!this.toText(merged.country) && this.toText(option.country)) {
        merged.country = this.toText(option.country);
      }
      if (!this.toText(merged.postal) && this.toText(option.postal)) {
        merged.postal = this.toText(option.postal);
      }
      if (!this.toText(merged.displayAddress) && this.toText(option.displayAddress)) {
        merged.displayAddress = this.toText(option.displayAddress);
      }
      if (!this.toText(merged.lookupKey) && this.toText(option.lookupKey)) {
        merged.lookupKey = this.toText(option.lookupKey);
      }
    }
    return merged;
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
    const normalizedBoardName = this.toText(option.boardName);
    if (normalizedBoardName) {
      school.schoolBoard = normalizedBoardName;
    }
    school.streetAddress = this.toText(option.streetAddress);
    school.city = this.toText(option.city);
    school.state = this.toText(option.state);
    school.country = this.normalizeCountryToStandardEnglish(option.country || 'Canada');
    school.postal = this.formatPostalForDisplay(option.postal, school.country);
  }

  private syncHighSchoolLookupState(): void {
    const options = this.model.highSchools.map((_, index) => this.highSchoolLookupOptions[index] || []);
    const loading = this.model.highSchools.map((_, index) => this.highSchoolLookupLoading[index] || false);
    const transcriptUploading = this.model.highSchools.map(
      (_, index) => this.highSchoolTranscriptUploading[index] || false
    );
    const transcriptTypeSelection = this.model.highSchools.map((_, index) =>
      this.highSchoolTranscriptTypeSelection[index] === 'Report Card' ? 'Report Card' : 'Transcript'
    );
    const reportYearSelection = this.model.highSchools.map((_, index) =>
      this.toText(this.highSchoolReportYearSelection[index])
    );
    const reportMonthSelection = this.model.highSchools.map((_, index) =>
      this.resolveReportMonth(this.highSchoolReportMonthSelection[index])
    );

    this.highSchoolLookupOptions = options;
    this.highSchoolLookupLoading = loading;
    this.highSchoolTranscriptUploading = transcriptUploading;
    this.highSchoolTranscriptTypeSelection = transcriptTypeSelection;
    this.highSchoolReportYearSelection = reportYearSelection;
    this.highSchoolReportMonthSelection = reportMonthSelection;

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

  private loadProfileHistory(): void {
    if (this.invalidManagedStudentId || (this.managedMode && !this.managedStudentId)) return;

    this.historyLoading = true;
    this.historyError = '';
    this.cdr.detectChanges();

    const request$ =
      this.managedMode && this.managedStudentId
        ? this.profileApi.getStudentProfileHistoryForTeacher(this.managedStudentId, { size: this.historyPageSize })
        : this.profileApi.getMyProfileHistory({ size: this.historyPageSize });

    request$
      .pipe(
        finalize(() => {
          this.historyLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (resp) => {
          const history = this.normalizeHistoryPayload(resp);
          this.historyEntries = history.items;
          this.historyTotal = history.total;
          this.historyPage = history.page;
          this.historySize = history.size;
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.historyEntries = [];
          this.historyTotal = 0;
          this.historyPage = 0;
          this.historySize = this.historyPageSize;
          this.historyError = this.resolveHistoryLoadError(err);
          this.cdr.detectChanges();
        },
      });
  }

  private resolveHistoryLoadError(err: HttpErrorResponse): string {
    if (err?.status === 404) {
      return '修改记录接口暂未开通（后端返回 404）。';
    }
    return this.extractErrorMessage(err) || '加载修改记录失败。';
  }

  private normalizeHistoryPayload(
    payload: StudentProfileHistoryResponse | StudentProfileHistoryEntry[] | null | undefined
  ): { items: StudentProfileHistoryEntry[]; total: number; page: number; size: number } {
    const items = this.normalizeHistoryEntries(payload);

    if (Array.isArray(payload) || !payload || typeof payload !== 'object') {
      return {
        items,
        total: items.length,
        page: 0,
        size: this.historyPageSize,
      };
    }

    const total = this.toOptionalNumber(payload.total);
    const page = this.toOptionalNumber(payload.page);
    const size = this.toOptionalNumber(payload.size);

    return {
      items,
      total: total !== null && total >= 0 ? total : items.length,
      page: page !== null && page >= 0 ? page : 0,
      size: size !== null && size > 0 ? size : this.historyPageSize,
    };
  }

  private normalizeHistoryEntries(
    payload: StudentProfileHistoryResponse | StudentProfileHistoryEntry[] | null | undefined
  ): StudentProfileHistoryEntry[] {
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.entries)
          ? payload.entries
          : Array.isArray(payload?.history)
            ? payload.history
            : [];

    return rows.map((entry, index) => {
      const source: any = entry && typeof entry === 'object' ? entry : {};
      return {
        ...source,
        id: source.id ?? source.eventId ?? `${source.changedAt || source.createdAt || 'history'}-${index}`,
        changedFields: this.normalizeHistoryChanges(source),
      };
    });
  }

  private normalizeHistoryChanges(source: any): StudentProfileHistoryFieldChange[] {
    const rawChanges: unknown[] = Array.isArray(source?.changedFields)
      ? source.changedFields
      : Array.isArray(source?.changes)
        ? source.changes
        : Array.isArray(source?.fields)
          ? source.fields
          : Array.isArray(source?.changedPaths)
            ? source.changedPaths
            : [];

    return rawChanges
      .map((change: unknown) => this.normalizeHistoryChange(change))
      .filter(
        (change: StudentProfileHistoryFieldChange | null): change is StudentProfileHistoryFieldChange =>
          change !== null
      );
  }

  private normalizeHistoryChange(change: unknown): StudentProfileHistoryFieldChange | null {
    if (typeof change === 'string') {
      const path = this.toText(change);
      return path ? { path } : null;
    }

    if (!change || typeof change !== 'object') return null;
    const source: any = change;
    const path = this.toText(source.path || source.field || source.fieldPath || source.name);

    return {
      ...source,
      path,
      label: this.toText(source.label),
      before: Object.prototype.hasOwnProperty.call(source, 'before')
        ? source.before
        : Object.prototype.hasOwnProperty.call(source, 'oldValue')
          ? source.oldValue
          : source.from,
      after: Object.prototype.hasOwnProperty.call(source, 'after')
        ? source.after
        : Object.prototype.hasOwnProperty.call(source, 'newValue')
          ? source.newValue
          : source.to,
    };
  }

  private displayHistoryRole(value: unknown): string {
    const role = this.toText(value).toUpperCase();
    if (role === 'STUDENT') return '学生';
    if (role === 'TEACHER') return '老师';
    if (role === 'ADMIN') return '管理员';
    return this.toText(value);
  }

  private resetProfileHistoryState(): void {
    this.historyPanelOpen = false;
    this.historyLoading = false;
    this.historyError = '';
    this.historyEntries = [];
    this.historyTotal = 0;
    this.historyPage = 0;
    this.historySize = this.historyPageSize;
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
          this.profileVersion = this.resolveProfileVersion(resp);
          this.model = this.normalizeModel(this.unwrapProfile(resp));
          this.syncHighSchoolLookupState();
          this.syncExternalCourseProviderLookupState();
          this.syncStatusInCanadaControls();
          this.validateLocalStudentNumbers();
          this.lastSavedPayloadDigest = this.buildPayloadDigest(this.model);
          this.pendingAutoSave = false;
          if (this.pendingSelfOnboardingEdit && !this.managedMode && !this.invalidManagedStudentId) {
            this.saved = false;
            this.error = '';
            this.editing = true;
          } else {
            this.editing = false;
          }
          this.pendingSelfOnboardingEdit = false;
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.profileVersion = null;
          this.pendingSelfOnboardingEdit = false;
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
    const changeSource = options.changeSource || (background ? 'auto_save' : 'manual_save');
    if (this.invalidManagedStudentId || (this.managedMode && !this.managedStudentId)) {
      this.error = '路由中的学生 ID 无效。';
      this.cdr.detectChanges();
      return;
    }
    if (!this.validateLocalStudentNumbers()) {
      this.error = this.oenError || this.penError;
      this.cdr.detectChanges();
      return;
    }
    if (!this.validateRequiredMainHighSchoolName({ showError: !background })) {
      if (background) {
        this.pendingAutoSave = false;
      } else {
        this.cdr.detectChanges();
      }
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
        ? this.saveStudentProfileWithContext(this.managedStudentId, payload, changeSource)
        : this.saveMyProfileWithContext(payload, changeSource);

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
          this.profileVersion = this.resolveProfileVersion(resp);
          if (syncModelOnSuccess) {
            const resolved = this.unwrapProfile(resp);
            const hasResolvedData = Object.keys(resolved).length > 0;
            this.model = this.normalizeModel(hasResolvedData ? resolved : payload);
            this.syncHighSchoolLookupState();
            this.syncExternalCourseProviderLookupState();
          }

          this.syncStatusInCanadaControls();
          this.validateLocalStudentNumbers();
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
          if (this.handleProfileVersionConflict(err)) {
            this.cdr.detectChanges();
            return;
          }
          this.saved = false;
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
      syncModelOnSuccess: true,
      background: true,
      changeSource: 'auto_save',
    });
  }

  private saveMyProfileWithContext(
    payload: StudentProfilePayload,
    changeSource: ProfileChangeSource
  ) {
    this.applyProfileSaveRequestContext(changeSource);
    return this.profileApi.saveMyProfile(payload);
  }

  private saveStudentProfileWithContext(
    studentId: number,
    payload: StudentProfilePayload,
    changeSource: ProfileChangeSource
  ) {
    this.applyProfileSaveRequestContext(changeSource);
    return this.profileApi.saveStudentProfileForTeacher(studentId, payload);
  }

  private applyProfileSaveRequestContext(changeSource: ProfileChangeSource): void {
    const api = this.profileApi as any;
    if (typeof api.setProfileSaveContext !== 'function') return;
    api.setProfileSaveContext({
      ifMatchVersion: this.profileVersion,
      changeSource,
    });
  }

  private handleProfileVersionConflict(err: HttpErrorResponse): boolean {
    const payload: any = err?.error && typeof err.error === 'object' ? err.error : {};
    const code = String(payload.code || '')
      .trim()
      .toUpperCase();
    if (err?.status !== 409 || code !== 'PROFILE_VERSION_CONFLICT') return false;

    const currentVersion = this.toOptionalNumber(payload.currentVersion);
    if (currentVersion !== null && currentVersion >= 0) {
      this.profileVersion = Math.trunc(currentVersion);
      this.error = `档案版本冲突（最新版本 ${this.profileVersion}）。请点击“重新加载”后重试。`;
    } else {
      this.error = '档案版本冲突，请点击“重新加载”后重试。';
    }
    this.saved = false;
    return true;
  }

  private shouldSkipAutoSaveForNextTarget(target: EventTarget | null): boolean {
    if (!target) return false;

    if (target instanceof HTMLButtonElement) {
      const buttonType = String(target.type || '')
        .trim()
        .toLowerCase();
      if (buttonType === 'submit') {
        return true;
      }

      return target.dataset?.['skipAutosave'] === 'true';
    }

    if (target instanceof HTMLInputElement) {
      const inputType = String(target.type || '')
        .trim()
        .toLowerCase();
      return inputType === 'file' || inputType === 'button' || inputType === 'submit' || inputType === 'reset';
    }

    return false;
  }

  private shouldAutoSaveTarget(target: EventTarget | null): boolean {
    if (!target) return false;

    if (target instanceof HTMLInputElement) {
      const type = String(target.type || '')
        .trim()
        .toLowerCase();
      if (type === 'file' || type === 'button' || type === 'submit' || type === 'reset') return false;
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
      this.profileVersion = null;
      this.editing = false;
      this.pendingAutoSave = false;
      this.resetProfileHistoryState();
      this.pendingSelfOnboardingEdit = this.shouldOpenSelfProfileInEditMode();
      this.loadProfile();
      return;
    }

    this.managedMode = true;
    const parsedStudentId = Number(routeStudentId);
    if (!Number.isInteger(parsedStudentId) || parsedStudentId <= 0) {
      this.managedStudentId = null;
      this.invalidManagedStudentId = true;
      this.profileVersion = null;
      this.model = this.defaultModel();
      this.syncHighSchoolLookupState();
      this.syncExternalCourseProviderLookupState();
      this.syncStatusInCanadaControls();
      this.loading = false;
      this.saved = false;
      this.editing = false;
      this.pendingAutoSave = false;
      this.resetProfileHistoryState();
      this.pendingSelfOnboardingEdit = false;
      this.lastSavedPayloadDigest = '';
      this.error = '路由中的学生 ID 无效。';
      this.cdr.detectChanges();
      return;
    }

    this.managedStudentId = parsedStudentId;
    this.invalidManagedStudentId = false;
    this.profileVersion = null;
    this.editing = false;
    this.pendingAutoSave = false;
    this.resetProfileHistoryState();
    this.pendingSelfOnboardingEdit = false;
    this.loadProfile();
  }

  private shouldOpenSelfProfileInEditMode(): boolean {
    const queryParamMap = (this.route as any)?.snapshot?.queryParamMap;
    const raw = this.toText(queryParamMap?.get?.('onboarding') || queryParamMap?.get?.('setupProfile'));
    if (!raw) return false;

    const normalized = raw.toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }

  private defaultModel(): StudentProfileModel {
    return {
      legalFirstName: '',
      legalLastName: '',
      preferredName: '',
      gender: '',
      genderOther: '',
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

      studentRegion: 'Ontario',
      oenNumber: '',
      penNumber: '',
      ib: '',
      ap: false,
      serviceItems: [],
      identityFiles: [],
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

  private resolveProfileVersion(payload: unknown): number | null {
    if (!payload || typeof payload !== 'object') return null;
    const source: any = payload;
    const candidates = [
      source.version,
      source.currentVersion,
      source.profileVersion,
      source.profile?.version,
      source.profile?.currentVersion,
      source.profile?.profileVersion,
    ];

    for (const candidate of candidates) {
      const parsed = this.toOptionalNumber(candidate);
      if (parsed !== null && parsed >= 0) {
        return Math.trunc(parsed);
      }
    }

    return null;
  }

  private normalizeModel(payload: StudentProfilePayload): StudentProfileModel {
    const defaults = this.defaultModel();
    const source: any = payload || {};
    const normalizedGender = this.normalizeGenderValue(source.gender, source.genderOther);
    const rawAddress = source.address && typeof source.address === 'object' ? source.address : {};
    const normalizedCountry = this.normalizeCountryToStandardEnglish(rawAddress.country || defaults.address.country);
    const rawCourses = this.resolveExternalCourses(source);
    const rawSchools = this.resolveSchoolRecords(source, rawCourses);
    const normalizedOen = this.normalizeOenNumber(source.oenNumber ?? source.oen);
    const normalizedPen = this.normalizePenNumber(source.penNumber ?? source.pen);
    const normalizedStudentRegion = this.resolveInitialStudentRegion(source, normalizedOen, normalizedPen);

    return {
      legalFirstName: this.toText(source.legalFirstName || source.firstName),
      legalLastName: this.toText(source.legalLastName || source.lastName),
      preferredName: this.toText(source.preferredName || source.nickName),
      gender: normalizedGender.gender,
      genderOther: normalizedGender.genderOther,
      birthday: this.normalizeDate(source.birthday),
      phone: this.formatPhoneForDisplay(source.phone),
      email: this.toText(source.email),

      statusInCanada: this.toText(source.statusInCanada),
      citizenship: this.normalizeCitizenshipToStandardEnglish(source.citizenship),
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

      studentRegion: normalizedStudentRegion,
      oenNumber: normalizedStudentRegion === 'Ontario' ? normalizedOen : '',
      penNumber: normalizedStudentRegion === 'British Columbia' ? normalizedPen : '',
      ib: this.toText(source.ib),
      ap: this.toBoolean(source.ap),
      serviceItems: this.normalizeServiceItems(this.extractServiceItems(source)),
      identityFiles: this.normalizeIdentityFiles(this.extractIdentityFiles(source)),

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
    const transcripts = this.extractSchoolTranscripts(source);
    const school: HighSchoolModel = {
      schoolRecordId: source.schoolRecordId === null || source.schoolRecordId === undefined
        ? this.toOptionalNumber(source.id)
        : this.toOptionalNumber(source.schoolRecordId),
      schoolType,
      schoolName: this.toText(source.schoolName || schoolNode.name),
      schoolBoard: this.toText(
        source.schoolBoard ||
          source.boardName ||
          source.educationBureau ||
          schoolNode.schoolBoard ||
          schoolNode.boardName
      ),
      streetAddress: this.toText(source.streetAddress || rawAddress.streetAddress),
      city: this.toText(source.city || rawAddress.city),
      state: this.toText(source.state || rawAddress.state),
      country,
      postal: this.formatPostalForDisplay(source.postal || rawAddress.postal, country),
      startTime: this.normalizeDate(source.startTime),
      endTime: this.normalizeDate(source.endTime),
      transcriptFileName: '',
      transcriptSizeBytes: null,
      transcriptUploadedAt: '',
      hasTranscript: this.toBoolean(source.hasTranscript) || this.toBoolean(source.transcriptAvailable),
      transcripts,
    };
    this.syncSchoolTranscriptLegacyFields(school);
    return school;
  }

  private createCurrentHighSchool(): HighSchoolModel {
    return {
      schoolRecordId: null,
      schoolType: 'MAIN',
      schoolName: '',
      schoolBoard: '',
      streetAddress: '',
      city: '',
      state: '',
      country: 'Canada',
      postal: '',
      startTime: '',
      endTime: '',
      transcriptFileName: '',
      transcriptSizeBytes: null,
      transcriptUploadedAt: '',
      hasTranscript: false,
      transcripts: [],
    };
  }

  private createPastHighSchool(): HighSchoolModel {
    return {
      schoolRecordId: null,
      schoolType: 'OTHER',
      schoolName: '',
      schoolBoard: '',
      streetAddress: '',
      city: '',
      state: '',
      country: 'Canada',
      postal: '',
      startTime: '',
      endTime: '',
      transcriptFileName: '',
      transcriptSizeBytes: null,
      transcriptUploadedAt: '',
      hasTranscript: false,
      transcripts: [],
    };
  }

  private normalizeHighSchools(schools: HighSchoolModel[]): HighSchoolModel[] {
    if (!Array.isArray(schools) || schools.length === 0) {
      return [this.createCurrentHighSchool()];
    }

    const normalized = schools.map((school) => {
      const country = this.normalizeCountryToStandardEnglish(school.country || 'Canada');
      const mapped: HighSchoolModel = {
        schoolRecordId: this.toOptionalNumber(school.schoolRecordId),
        schoolType: school.schoolType,
        schoolName: this.toText(school.schoolName),
        schoolBoard: this.toText(school.schoolBoard),
        streetAddress: this.toText(school.streetAddress),
        city: this.toText(school.city),
        state: this.toText(school.state),
        country,
        postal: this.formatPostalForDisplay(school.postal, country),
        startTime: this.normalizeDate(school.startTime),
        endTime: this.normalizeDate(school.endTime),
        transcriptFileName: this.toText(school.transcriptFileName),
        transcriptSizeBytes: this.toOptionalNumber(school.transcriptSizeBytes),
        transcriptUploadedAt: this.toText(school.transcriptUploadedAt),
        hasTranscript: this.toBoolean(school.hasTranscript) || !!this.toText(school.transcriptFileName),
        transcripts: this.extractSchoolTranscripts(school),
      };
      this.syncSchoolTranscriptLegacyFields(mapped);
      return mapped;
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
    const normalizedServiceItems = this.normalizeServiceItems(model.serviceItems);
    const normalizedStudentRegion = this.resolveStudentRegionForPayload(model.studentRegion) || 'Ontario';
    const normalizedOen = normalizedStudentRegion === 'Ontario' ? this.normalizeOenNumber(model.oenNumber) : '';
    const normalizedPen =
      normalizedStudentRegion === 'British Columbia' ? this.normalizePenNumber(model.penNumber) : '';

    return {
      legalFirstName: this.toText(model.legalFirstName),
      legalLastName: this.toText(model.legalLastName),
      preferredName: this.toText(model.preferredName),
      gender: model.gender,
      genderOther: model.gender === 'Other' ? this.toText(model.genderOther) : '',
      birthday: this.normalizeDate(model.birthday),
      phone: this.normalizePhoneForPayload(model.phone),
      email: this.toText(model.email),
      statusInCanada: this.toText(model.statusInCanada),
      citizenship: this.normalizeCitizenshipToStandardEnglish(model.citizenship),
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
      studentRegion: normalizedStudentRegion,
      oen: normalizedOen,
      oenNumber: normalizedOen,
      pen: normalizedPen,
      penNumber: normalizedPen,
      ib: this.toText(model.ib),
      ap: !!model.ap,
      serviceItems: normalizedServiceItems,
      serviceProjects: normalizedServiceItems,
      identityFiles: this.normalizeIdentityFiles(model.identityFiles).map((file) => ({
        identityFileId: this.toOptionalNumber(file.identityFileId),
        id: this.toOptionalNumber(file.identityFileId),
        identityFileName: this.toText(file.identityFileName),
        identityFileSizeBytes: this.toOptionalNumber(file.identityFileSizeBytes),
        identityFileUploadedAt: this.toText(file.identityFileUploadedAt),
      })),
      schools: this.normalizeHighSchools(model.highSchools).map((school, index) => {
        const schoolCountry = this.normalizeCountryToStandardEnglish(school.country || 'Canada');
        const schoolPostal = this.formatPostalForDisplay(school.postal, schoolCountry);
        const normalizedTranscripts = this.extractSchoolTranscripts(school);
        const latestTranscript =
          normalizedTranscripts.length > 0 ? normalizedTranscripts[normalizedTranscripts.length - 1] : null;
        return {
          schoolRecordId: this.toOptionalNumber(school.schoolRecordId),
          schoolType: index === 0 ? 'MAIN' : 'OTHER',
          schoolName: this.toText(school.schoolName),
          schoolBoard: this.toText(school.schoolBoard),
          boardName: this.toText(school.schoolBoard),
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
          transcriptFileName: this.toText(latestTranscript?.transcriptFileName),
          transcriptSizeBytes: this.toOptionalNumber(latestTranscript?.transcriptSizeBytes),
          transcriptUploadedAt: this.toText(latestTranscript?.transcriptUploadedAt),
          hasTranscript: normalizedTranscripts.length > 0,
          transcripts: normalizedTranscripts.map((transcript) => ({
            transcriptFileName: this.toText(transcript.transcriptFileName),
            transcriptSizeBytes: this.toOptionalNumber(transcript.transcriptSizeBytes),
            transcriptUploadedAt: this.toText(transcript.transcriptUploadedAt),
          })),
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
        schoolRecordId: null,
        schoolType,
        schoolName,
        schoolBoard: '',
        streetAddress: '',
        city: '',
        state: '',
        country: 'Canada',
        postal: '',
        startTime,
        endTime,
        transcriptFileName: '',
        transcriptSizeBytes: null,
        transcriptUploadedAt: '',
        hasTranscript: false,
        transcripts: [],
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

  private normalizeGenderValue(
    genderValue: unknown,
    genderOtherValue: unknown
  ): { gender: Gender; genderOther: string } {
    const rawGender = this.toText(genderValue);
    const rawGenderOther = this.toText(genderOtherValue);

    if (!rawGender && !rawGenderOther) return { gender: '', genderOther: '' };

    const normalized = rawGender.toLowerCase();
    if (normalized === 'male') return { gender: 'Male', genderOther: '' };
    if (normalized === 'female') return { gender: 'Female', genderOther: '' };
    if (normalized === 'other') {
      return {
        gender: 'Other',
        genderOther: rawGenderOther,
      };
    }

    if (/^other\b/i.test(rawGender)) {
      const detailFromGender = rawGender.replace(/^other\b[\s:：\-,;]*/i, '').trim();
      return {
        gender: 'Other',
        genderOther: rawGenderOther || detailFromGender,
      };
    }

    if (rawGender) {
      return {
        gender: 'Other',
        genderOther: rawGenderOther || rawGender,
      };
    }

    return {
      gender: 'Other',
      genderOther: rawGenderOther,
    };
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
      const key = text.toLowerCase();
      if (!text || seen.has(key)) return;
      seen.add(key);
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
      const displayNames = new Intl.DisplayNames(['en'], {
        type: 'region',
      });
      const options: string[] = [];
      for (let first = 65; first <= 90; first += 1) {
        for (let second = 65; second <= 90; second += 1) {
          const code = `${String.fromCharCode(first)}${String.fromCharCode(second)}`;
          const name = displayNames.of(code);
          if (!name || name === code) continue;
          options.push(this.normalizeCitizenshipAliasOnly(String(name)));
        }
      }
      return options;
    } catch {
      return [];
    }
  }

  private normalizeCitizenshipToStandardEnglish(value: unknown): string {
    const rawText = this.toText(value);
    if (!rawText) return '';

    const fromAlias = this.normalizeCitizenshipAliasOnly(rawText);
    if (fromAlias !== rawText) {
      return fromAlias;
    }

    const matched = this.citizenshipOptions.find(
      (option) => option.toLowerCase() === rawText.toLowerCase()
    );
    return matched || rawText;
  }

  private normalizeCitizenshipAliasOnly(value: unknown): string {
    const rawText = this.toText(value);
    const normalizedKey = this.normalizeTextKey(rawText);
    if (!normalizedKey) return '';

    for (const [alias, canonical] of CITIZENSHIP_STANDARD_ALIASES) {
      if (normalizedKey === alias) return canonical;
    }

    return rawText;
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

    const normalizedKey = this.normalizeTextKey(rawText);

    for (const [alias, canonical] of COUNTRY_STANDARD_ALIASES) {
      if (normalizedKey === alias) return canonical;
    }

    const matched = this.countryOptions.find((option) => option.toLowerCase() === rawText.toLowerCase());
    return matched || rawText;
  }

  private normalizeTextKey(value: unknown): string {
    return this.toText(value)
      .toLowerCase()
      .replace(/[.]/g, '')
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
      .trim();
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

  private normalizePenNumber(value: unknown): string {
    return String(value ?? '')
      .replace(/\D/g, '')
      .slice(0, 9);
  }

  private resolveStudentRegionForPayload(value: unknown): StudentRegion {
    const rawText = this.toText(value);
    if (!rawText) return '';
    const normalizedKey = this.normalizeTextKey(rawText);

    for (const [alias, region] of STUDENT_REGION_ALIASES) {
      if (normalizedKey === alias) return region;
    }

    const matchedOption = this.studentRegionOptions.find(
      (option) => option.value.toLowerCase() === rawText.toLowerCase()
    );
    if (matchedOption) return matchedOption.value;
    return '';
  }

  private resolveInitialStudentRegion(source: any, normalizedOen: string, normalizedPen: string): StudentRegion {
    const explicitRegion = this.resolveStudentRegionForPayload(
      source?.studentRegion ?? source?.student_region ?? source?.region ?? source?.profileRegion
    );
    if (explicitRegion) return explicitRegion;
    if (normalizedOen) return 'Ontario';
    if (normalizedPen) return 'British Columbia';
    return 'Ontario';
  }

  private applyLocalStudentNumberVisibilityRules(): void {
    this.model.studentRegion = this.resolveStudentRegionForPayload(this.model.studentRegion) || 'Ontario';
    if (this.model.studentRegion !== 'Ontario') {
      this.model.oenNumber = '';
      this.oenError = '';
    }
    if (this.model.studentRegion !== 'British Columbia') {
      this.model.penNumber = '';
      this.penError = '';
    }
  }

  private extractServiceItems(source: any): unknown {
    return (
      source?.serviceItems ??
      source?.serviceProjects ??
      source?.services ??
      source?.serviceOptions ??
      source?.selectedServices
    );
  }

  private normalizeServiceItems(value: unknown): string[] {
    const knownOptions = [...this.serviceItemOptions];
    const optionByKey = new Map<string, string>(
      knownOptions.map((option) => [this.normalizeTextKey(option), option])
    );
    const selected: string[] = [];
    const seen = new Set<string>();

    const append = (candidate: unknown): void => {
      const raw = this.toText(candidate);
      if (!raw) return;

      const normalizedRaw = this.normalizeTextKey(raw);
      const strippedRaw = raw.replace(/^[A-Za-z]\s*[:：]\s*/, '');
      const normalizedStripped = this.normalizeTextKey(strippedRaw);
      const matched =
        optionByKey.get(normalizedRaw) ||
        optionByKey.get(normalizedStripped) ||
        raw;
      const key = this.normalizeTextKey(matched);
      if (!key || seen.has(key)) return;
      seen.add(key);
      selected.push(matched);
    };

    if (Array.isArray(value)) {
      value.forEach(append);
    } else if (value && typeof value === 'object') {
      const node = value as Record<string, unknown>;
      const nestedArrayCandidate = [node['items'], node['data'], node['values'], node['selected']].find(
        Array.isArray
      );

      if (Array.isArray(nestedArrayCandidate)) {
        nestedArrayCandidate.forEach(append);
      } else {
        Object.entries(node).forEach(([key, raw]) => {
          if (this.toBoolean(raw)) {
            append(key);
          }
        });
      }
    } else {
      const rawText = this.toText(value);
      if (!rawText) return [];
      rawText.split(/[\n,;；、|]+/).forEach(append);
    }

    const orderedKnownOptions = knownOptions.filter((option) =>
      seen.has(this.normalizeTextKey(option))
    );
    const extraOptions = selected.filter(
      (option) =>
        !orderedKnownOptions.some(
          (knownOption) => this.normalizeTextKey(knownOption) === this.normalizeTextKey(option)
        )
    );

    return [...orderedKnownOptions, ...extraOptions];
  }

  private validateLocalStudentNumbers(): boolean {
    this.applyLocalStudentNumberVisibilityRules();
    const oenValid = this.validateOenNumber();
    const penValid = this.validatePenNumber();
    return oenValid && penValid;
  }

  private validateOenNumber(): boolean {
    if (this.model.studentRegion !== 'Ontario') {
      this.oenError = '';
      this.model.oenNumber = '';
      return true;
    }

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

    this.oenError = 'OEN 必须是 9 位纯数字';
    return false;
  }

  private validatePenNumber(): boolean {
    if (this.model.studentRegion !== 'British Columbia') {
      this.penError = '';
      this.model.penNumber = '';
      return true;
    }

    const pen = this.normalizePenNumber(this.model.penNumber);
    this.model.penNumber = pen;
    if (!pen) {
      this.penError = '';
      return true;
    }
    if (/^\d{9}$/.test(pen)) {
      this.penError = '';
      return true;
    }

    this.penError = 'PEN 必须是 9 位纯数字';
    return false;
  }

  private validateRequiredMainHighSchoolName(options: { showError?: boolean } = {}): boolean {
    const showError = options.showError ?? true;
    const mainSchool = this.model.highSchools[0];
    const schoolName = this.toText(mainSchool?.schoolName);
    if (mainSchool) {
      mainSchool.schoolName = schoolName;
    }

    if (schoolName) {
      return true;
    }
    if (showError) {
      this.error = '高中学校第1项的学校名称为必填项';
    }
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
    if (err?.status === 0) {
      return '上传连接被中断（ERR_CONNECTION_ABORTED/RESET）。请检查后端服务和上传大小限制后重试。';
    }

    if (err?.status === 401) {
      return '登录状态已失效，请重新登录后再试。';
    }

    if (err?.status === 413) {
      return '文件过大，当前服务端上传大小上限过小。请联系后端调大上传限制后重试。';
    }

    const payload = err?.error;

    if (payload && typeof payload === 'object') {
      const code = String((payload as any).code || '')
        .trim()
        .toUpperCase();
      if (code === 'UNAUTHENTICATED') {
        return '登录状态已失效，请重新登录后再试。';
      }
      const details = this.extractValidationMessages(payload);
      const message = this.humanizeRawValidationText(
        String((payload as any).message || (payload as any).error || '')
      );
      return this.mergeErrorMessageAndDetails(message, details);
    }

    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        const details = this.extractValidationMessages(parsed);
        const message = this.humanizeRawValidationText(String(parsed?.message || parsed?.error || payload));
        return this.mergeErrorMessageAndDetails(message, details);
      } catch {
        return this.humanizeRawValidationText(payload);
      }
    }

    return err?.message || '';
  }

  private mergeErrorMessageAndDetails(message: string, details: string[]): string {
    const normalizedMessage = this.toText(message);
    const normalizedDetails = details.map((item) => this.toText(item)).filter(Boolean);
    if (normalizedDetails.length > 0) {
      return normalizedDetails.join('；');
    }

    if (!normalizedMessage) return '';

    const lowered = normalizedMessage.toLowerCase();
    if (
      lowered === 'validation failed.' ||
      lowered === 'validation failed' ||
      lowered === 'request validation failed' ||
      lowered === 'bad request'
    ) {
      return '请检查并完善必填项。';
    }

    return normalizedMessage;
  }

  private humanizeValidationFieldPath(rawFieldPath: string): string {
    const fieldPath = this.toText(rawFieldPath);
    if (!fieldPath) return '';

    const directLabel = VALIDATION_FIELD_LABELS[fieldPath];
    if (directLabel) return directLabel;

    const listMatch = fieldPath.match(/^([A-Za-z_][A-Za-z0-9_]*)\[(\d+)\](?:\.(.+))?$/);
    if (listMatch) {
      const collectionKey = listMatch[1];
      const itemIndex = Number(listMatch[2]) + 1;
      const nestedPath = this.toText(listMatch[3]);
      const collectionLabel = VALIDATION_COLLECTION_LABELS[collectionKey] || collectionKey;
      if (!nestedPath) return `${collectionLabel}第${itemIndex}项`;
      return `${collectionLabel}第${itemIndex}项的${this.humanizeValidationFieldPath(nestedPath)}`;
    }

    const pathParts = fieldPath.split('.').filter(Boolean);
    if (pathParts.length <= 1) {
      return VALIDATION_FIELD_LABELS[fieldPath] || fieldPath;
    }

    const [head, ...rest] = pathParts;
    const headLabel = VALIDATION_FIELD_LABELS[head] || head;
    const restLabel = this.humanizeValidationFieldPath(rest.join('.'));
    return `${headLabel}的${restLabel}`;
  }

  private humanizeValidationReason(rawReason: string): string {
    const reason = this.toText(rawReason);
    if (!reason) return '';

    const normalized = reason.toLowerCase();
    if (
      normalized === 'is required' ||
      normalized === 'must not be blank' ||
      normalized === 'must not be empty' ||
      normalized === 'cannot be blank' ||
      normalized === 'cannot be empty'
    ) {
      return '为必填项';
    }

    if (normalized === 'is invalid' || normalized === 'invalid') {
      return '格式不正确';
    }

    if (normalized.includes('well-formed email')) {
      return '邮箱格式不正确';
    }

    const minMatch = normalized.match(/must be greater than or equal to\s*(-?\d+(?:\.\d+)?)/);
    if (minMatch) {
      return `不能小于 ${minMatch[1]}`;
    }

    const maxMatch = normalized.match(/must be less than or equal to\s*(-?\d+(?:\.\d+)?)/);
    if (maxMatch) {
      return `不能大于 ${maxMatch[1]}`;
    }

    const betweenMatch = normalized.match(
      /size must be between\s*(\d+)\s*and\s*(\d+)|must be between\s*(\d+)\s*and\s*(\d+)/
    );
    if (betweenMatch) {
      const min = betweenMatch[1] || betweenMatch[3];
      const max = betweenMatch[2] || betweenMatch[4];
      return `长度需在 ${min} 到 ${max} 之间`;
    }

    if (normalized.includes('must match')) {
      return '格式不正确';
    }

    return reason;
  }

  private shouldConcatenateValidationReason(reason: string): boolean {
    const text = this.toText(reason);
    if (!text) return false;
    return (
      text.startsWith('为') ||
      text.startsWith('需') ||
      text.startsWith('应') ||
      text.startsWith('不能') ||
      text.startsWith('不可') ||
      text.startsWith('请')
    );
  }

  private looksLikeValidationFieldPath(value: string): boolean {
    const text = this.toText(value);
    if (!text) return false;
    return /^[A-Za-z_][A-Za-z0-9_]*(\[\d+\])?(\.[A-Za-z_][A-Za-z0-9_]*(\[\d+\])?)*$/.test(text);
  }

  private formatValidationFieldAndReason(field: string, reason: string): string {
    const friendlyField = this.humanizeValidationFieldPath(field);
    const friendlyReason = this.humanizeValidationReason(reason);
    if (!friendlyField) return friendlyReason;
    if (!friendlyReason) return friendlyField;
    if (this.shouldConcatenateValidationReason(friendlyReason)) {
      return `${friendlyField}${friendlyReason}`;
    }
    return `${friendlyField}：${friendlyReason}`;
  }

  private humanizeRawValidationText(rawText: string): string {
    const text = this.toText(rawText);
    if (!text) return '';

    const pathMessageMatch = text.match(/^([A-Za-z_][A-Za-z0-9_.\[\]]*)\s+(.+)$/);
    if (pathMessageMatch && this.looksLikeValidationFieldPath(pathMessageMatch[1])) {
      return this.formatValidationFieldAndReason(pathMessageMatch[1], pathMessageMatch[2]);
    }

    return this.humanizeValidationReason(text);
  }

  private extractValidationMessages(payload: any): string[] {
    if (!payload || typeof payload !== 'object') return [];

    const messages: string[] = [];
    const seen = new Set<string>();

    const append = (value: unknown): void => {
      const text = this.toText(value);
      if (!text || seen.has(text)) return;
      seen.add(text);
      messages.push(text);
    };

    const parseDetailEntry = (entry: unknown): string => {
      if (entry === null || entry === undefined) return '';
      if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
        return this.humanizeRawValidationText(String(entry));
      }
      if (typeof entry !== 'object') return '';

      const node: any = entry;
      const field = this.toText(node.field || node.path || node.property || node.name || node.key);
      const message = this.toText(node.message || node.defaultMessage || node.error || node.reason || node.msg);
      if (field && message) return this.formatValidationFieldAndReason(field, message);
      if (message) return this.humanizeRawValidationText(message);
      if (field) return this.humanizeValidationFieldPath(field);
      return '';
    };

    const appendFromArray = (rows: unknown): void => {
      if (!Array.isArray(rows)) return;
      for (const row of rows) {
        const text = parseDetailEntry(row);
        append(text);
      }
    };

    appendFromArray((payload as any).details);
    appendFromArray((payload as any).errors);
    appendFromArray((payload as any).fieldErrors);
    appendFromArray((payload as any).violations);
    appendFromArray((payload as any).validationErrors);

    const errorMap = (payload as any).errors;
    if (errorMap && typeof errorMap === 'object' && !Array.isArray(errorMap)) {
      for (const [field, value] of Object.entries(errorMap)) {
        const normalizedField = this.toText(field);
        if (Array.isArray(value)) {
          for (const item of value) {
            const itemNode: any = item && typeof item === 'object' ? item : null;
            const itemField = this.toText(
              itemNode?.field || itemNode?.path || itemNode?.property || itemNode?.name || itemNode?.key
            );
            const parsed = parseDetailEntry(item);
            if (itemField) {
              append(parsed || this.humanizeValidationFieldPath(itemField));
              continue;
            }
            append(parsed ? this.formatValidationFieldAndReason(normalizedField, parsed) : this.formatValidationFieldAndReason(normalizedField, 'is invalid'));
          }
          continue;
        }

        const valueNode: any = value && typeof value === 'object' ? value : null;
        const valueField = this.toText(
          valueNode?.field || valueNode?.path || valueNode?.property || valueNode?.name || valueNode?.key
        );
        const parsed = parseDetailEntry(value);
        if (valueField) {
          append(parsed || this.humanizeValidationFieldPath(valueField));
          continue;
        }
        append(
          parsed
            ? this.formatValidationFieldAndReason(normalizedField, parsed)
            : this.formatValidationFieldAndReason(normalizedField, String(value ?? '').trim())
        );
      }
    }

    return messages;
  }
}

