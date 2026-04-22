import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { AuthService } from './auth.service';

export interface StudentProfileCoursePayload {
  schoolType?: string;
  schoolName?: string;
  address?: StudentProfileAddressPayload;
  streetAddress?: string;
  city?: string;
  state?: string;
  country?: string;
  postal?: string;
  courseCode?: string;
  mark?: number | null;
  gradeLevel?: number | null;
  startTime?: string;
  endTime?: string;
  [key: string]: any;
}

export interface StudentProfileSchoolPayload {
  schoolRecordId?: number | null;
  schoolType?: string;
  schoolName?: string;
  schoolBoard?: string;
  boardName?: string;
  educationBureau?: string;
  address?: StudentProfileAddressPayload;
  streetAddress?: string;
  city?: string;
  state?: string;
  country?: string;
  postal?: string;
  startTime?: string;
  endTime?: string;
  transcriptFileName?: string;
  transcriptSizeBytes?: number | null;
  transcriptUploadedAt?: string;
  hasTranscript?: boolean;
  transcripts?: StudentSchoolTranscriptPayload[];
  [key: string]: any;
}

export interface StudentIdentityFilePayload {
  id?: number | null;
  identityFileId?: number | null;
  fileId?: number | null;
  identityFileName?: string;
  originalFilename?: string;
  fileName?: string;
  mimeType?: string;
  contentType?: string;
  identityFileSizeBytes?: number | null;
  sizeBytes?: number | null;
  size?: number | null;
  identityFileUploadedAt?: string;
  uploadedAt?: string;
  uploadTime?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface StudentSchoolTranscriptPayload {
  schoolRecordId?: number | null;
  transcriptFileName?: string;
  transcriptOriginalFilename?: string;
  transcriptContentType?: string;
  transcriptSizeBytes?: number | null;
  sizeBytes?: number | null;
  transcriptUploadedAt?: string;
  uploadedAt?: string;
  hasTranscript?: boolean;
  transcriptAvailable?: boolean;
  transcripts?: StudentSchoolTranscriptPayload[];
  [key: string]: any;
}

export interface CanadianHighSchoolLookupItem {
  name: string;
  streetAddress: string;
  city: string;
  state: string;
  country: string;
  postal: string;
  displayAddress: string;
  lookupKey: string;
  boardName?: string;
  schoolSpecialConditions?: string;
}

export interface StudentProfileAddressPayload {
  streetAddress?: string;
  streetAddressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  postal?: string;
  [key: string]: any;
}

export interface StudentProfilePayload {
  legalFirstName?: string;
  legalLastName?: string;
  preferredName?: string;
  gender?: string;
  genderOther?: string;
  birthday?: string;
  phone?: string;
  email?: string;
  statusInCanada?: string;
  citizenship?: string;
  firstLanguage?: string;
  firstBoardingDate?: string;
  firstEntryDateInCanada?: string;
  firstEntryDate?: string;
  firstArrivalDateInCanada?: string;
  address?: StudentProfileAddressPayload;
  studentRegion?: string;
  student_region?: string;
  oen?: string;
  oenNumber?: string;
  pen?: string;
  penNumber?: string;
  ib?: string;
  ap?: boolean;
  serviceItems?: string[];
  serviceProjects?: string[];
  identityFileNote?: string;
  identityFiles?: StudentIdentityFilePayload[];
  schools?: StudentProfileSchoolPayload[];
  schoolRecords?: StudentProfileSchoolPayload[];
  otherCourses?: StudentProfileCoursePayload[];
  externalCourses?: StudentProfileCoursePayload[];
  [key: string]: any;
}

export interface StudentProfileResponse {
  profile?: StudentProfilePayload;
  [key: string]: any;
}

export interface StudentProfileHistoryFieldChange {
  path?: string;
  field?: string;
  label?: string;
  before?: unknown;
  after?: unknown;
  oldValue?: unknown;
  newValue?: unknown;
  from?: unknown;
  to?: unknown;
  name?: string;
  [key: string]: any;
}

export interface StudentProfileHistoryEntry {
  id?: number | string;
  studentId?: number;
  version?: number;
  fromVersion?: number;
  toVersion?: number;
  changeSource?: string;
  source?: string;
  actorUserId?: number;
  actorRole?: string;
  actorName?: string;
  actorDisplayName?: string;
  changedByUserId?: number;
  changedByRole?: string;
  changedByName?: string;
  changedBy?: string;
  role?: string;
  changedAt?: string;
  createdAt?: string;
  timestamp?: string;
  requestId?: string;
  changedFields?: StudentProfileHistoryFieldChange[];
  changes?: StudentProfileHistoryFieldChange[];
  [key: string]: any;
}

export interface StudentProfileHistoryResponse {
  items?: StudentProfileHistoryEntry[];
  entries?: StudentProfileHistoryEntry[];
  history?: StudentProfileHistoryEntry[];
  total?: number;
  page?: number;
  size?: number;
  [key: string]: any;
}

export interface StudentProfileHistoryQuery {
  page?: number;
  size?: number;
}

export type ProfileChangeSource =
  | 'manual_save'
  | 'auto_save'
  | 'file_upload'
  | 'version_restore';

export interface StudentProfileSaveRequestOptions {
  ifMatchVersion?: number | null;
  changeSource?: ProfileChangeSource;
}

const EDUCATION_BOARD_LIBRARY_BY_CODE: Readonly<Record<string, string>> = Object.freeze({
  B28002: 'DSB Ontario North East',
  B28010: 'Algoma DSB',
  B28029: 'Rainbow DSB',
  B28037: 'Near North DSB',
  B28045: 'Keewatin-Patricia DSB',
  B28053: 'Rainy River DSB',
  B28061: 'Lakehead DSB',
  B28070: 'Superior-Greenstone DSB',
  B28118: "CS public du Grand Nord de l'Ontario",
  B29009: 'Northeastern CDSB',
  B29017: 'Nipissing-Parry Sound CDSB',
  B29025: 'Huron-Superior CDSB',
  B29033: 'Sudbury CDSB',
  B29041: 'Northwest CDSB',
  B29050: 'Kenora CDSB',
  B29068: 'Thunder Bay CDSB',
  B29076: 'Superior North CDSB',
  B29106: 'CSDC des Grandes Rivieres',
  B29122: 'CSDC du Nouvel-Ontario',
  B66001: 'Bluewater DSB',
  B66010: 'Avon Maitland DSB',
  B66028: 'Greater Essex County DSB',
  B66036: 'Lambton Kent DSB',
  B66044: 'Thames Valley DSB',
  B66052: 'Toronto DSB',
  B66060: 'Durham DSB',
  B66079: 'Kawartha Pine Ridge DSB',
  B66087: 'Trillium Lakelands DSB',
  B66095: 'York Region DSB',
  B66109: 'Simcoe County DSB',
  B66117: 'Upper Grand DSB',
  B66125: 'Peel DSB',
  B66133: 'Halton DSB',
  B66141: 'Hamilton-Wentworth DSB',
  B66150: 'DSB Niagara',
  B66168: 'Grand Erie DSB',
  B66176: 'Waterloo Region DSB',
  B66184: 'Ottawa-Carleton DSB',
  B66192: 'Upper Canada DSB',
  B66206: 'Limestone DSB',
  B66214: 'Renfrew County DSB',
  B66222: 'Hastings & Prince Edward DSB',
  B66311: "CEP de l'Est de l'Ontario",
  B67008: 'Bruce-Grey CDSB',
  B67016: 'Huron Perth CDSB',
  B67024: 'Windsor-Essex CDSB',
  B67032: 'London District Catholic School Board',
  B67040: 'St Clair CDSB',
  B67059: 'Toronto CDSB',
  B67067: 'Peterborough Victoria Northumberland and Clarington CDSB',
  B67075: 'York CDSB',
  B67083: 'Dufferin-Peel CDSB',
  B67091: 'Simcoe Muskoka CDSB',
  B67105: 'Durham CDSB',
  B67113: 'Halton CDSB',
  B67121: 'Hamilton-Wentworth CDSB',
  B67130: 'Wellington CDSB',
  B67148: 'Waterloo CDSB',
  B67156: 'Niagara CDSB',
  B67164: 'Brant Haldimand Norfolk CDSB',
  B67172: 'CDSB of Eastern Ontario',
  B67180: 'Ottawa CSB',
  B67199: 'Renfrew County CDSB',
  B67202: 'Algonquin and Lakeshore CDSB',
  B67300: 'Conseil scolaire catholique Providence',
  B67318: 'CS catholique MonAvenir',
  B67326: "CSDC de l'Est ontarien",
  B67334: "CSDC du Centre-Est de l'Ontario",
});

const EDUCATION_BOARD_NAME_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  'toronto dsb': 'TDSB',
  'toronto cdsb': 'TCDSB',
  'york region dsb': 'YRDSB',
  'york cdsb': 'YCDSB',
  'peel dsb': 'PDSB',
  'durham dsb': 'DDSB',
  'durham cdsb': 'DCDSB',
  'halton dsb': 'HDSB',
  'halton cdsb': 'HCDSB',
  'ottawa-carleton dsb': 'OCDSB',
  'dufferin-peel cdsb': 'DPCDSB',
  'waterloo region dsb': 'WRDSB',
  'kawartha pine ridge dsb': 'KPRDSB',
  'thames valley dsb': 'TVDSB',
  'private school': '私校',
  private: '私校',
  '私校': '私校',
});

const normalizeEducationBoardName = (value: unknown): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const alias = EDUCATION_BOARD_NAME_ALIASES[text.toLowerCase()];
  return alias || text;
};

const buildEducationBoardLibraryOptions = (): ReadonlyArray<string> => {
  const values = Object.values(EDUCATION_BOARD_LIBRARY_BY_CODE);
  const normalizedValues = values.map((value) => normalizeEducationBoardName(value));
  const options = Array.from(
    new Set<string>(['私校', ...values, ...normalizedValues].filter((value) => value.trim().length > 0))
  );
  options.sort((left, right) => left.localeCompare(right));
  return Object.freeze(options);
};

export const EDUCATION_BOARD_LIBRARY_OPTIONS: ReadonlyArray<string> = buildEducationBoardLibraryOptions();

@Injectable({ providedIn: 'root' })
export class StudentProfileService {
  private readonly selfProfileUrl = '/api/student/profile';
  private readonly teacherStudentProfileBaseUrl = '/api/teacher/students';
  private readonly historyPageSizeDefault = 20;
  private readonly canadianHighSchoolSearchUrl = '/api/reference/canadian-high-schools/search';
  private readonly ontarioCourseProviderSearchUrl = '/api/reference/ontario-course-providers/search';
  private readonly transcriptPrimaryField = 'file';
  private readonly transcriptFallbackField = 'transcript';
  private readonly identityFilePrimaryField = 'file';
  private readonly identityFileFallbackField = 'identity';
  private pendingProfileSaveContext: StudentProfileSaveRequestOptions | null = null;

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {}

  private withAuthHeaderIfAvailable(): { headers?: HttpHeaders } {
    const authorization = this.auth.getAuthorizationHeaderValue();
    if (!authorization) {
      return {};
    }

    return {
      headers: new HttpHeaders({
        Authorization: authorization,
      }),
    };
  }

  setProfileSaveContext(options: StudentProfileSaveRequestOptions | null): void {
    this.pendingProfileSaveContext = options ? { ...options } : null;
  }

  getMyProfile(): Observable<StudentProfilePayload | StudentProfileResponse> {
    return this.http.get<StudentProfilePayload | StudentProfileResponse>(
      this.selfProfileUrl,
      this.withAuthHeaderIfAvailable()
    );
  }

  getMyProfileHistory(
    query: StudentProfileHistoryQuery = {}
  ): Observable<StudentProfileHistoryResponse | StudentProfileHistoryEntry[]> {
    return this.http.get<StudentProfileHistoryResponse | StudentProfileHistoryEntry[]>(
      `${this.selfProfileUrl}/history`,
      {
        params: this.buildProfileHistoryParams(query),
        ...this.withAuthHeaderIfAvailable(),
      }
    );
  }

  saveMyProfile(
    payload: StudentProfilePayload
  ): Observable<StudentProfilePayload | StudentProfileResponse> {
    const requestOptions = this.consumeProfileSaveContext();
    return this.http.put<StudentProfilePayload | StudentProfileResponse>(
      this.selfProfileUrl,
      payload,
      this.buildProfileSaveHeaders(requestOptions)
    );
  }

  getStudentProfileForTeacher(
    studentId: number
  ): Observable<StudentProfilePayload | StudentProfileResponse> {
    return this.http.get<StudentProfilePayload | StudentProfileResponse>(
      this.resolveTeacherStudentProfileUrl(studentId),
      this.withAuthHeaderIfAvailable()
    );
  }

  getStudentProfileHistoryForTeacher(
    studentId: number,
    query: StudentProfileHistoryQuery = {}
  ): Observable<StudentProfileHistoryResponse | StudentProfileHistoryEntry[]> {
    return this.http.get<StudentProfileHistoryResponse | StudentProfileHistoryEntry[]>(
      `${this.resolveTeacherStudentProfileUrl(studentId)}/history`,
      {
        params: this.buildProfileHistoryParams(query),
        ...this.withAuthHeaderIfAvailable(),
      }
    );
  }

  saveStudentProfileForTeacher(
    studentId: number,
    payload: StudentProfilePayload
  ): Observable<StudentProfilePayload | StudentProfileResponse> {
    const requestOptions = this.consumeProfileSaveContext();
    return this.http.put<StudentProfilePayload | StudentProfileResponse>(
      this.resolveTeacherStudentProfileUrl(studentId),
      payload,
      this.buildProfileSaveHeaders(requestOptions)
    );
  }

  searchCanadianHighSchools(query: string): Observable<CanadianHighSchoolLookupItem[]> {
    const text = String(query ?? '').trim();
    if (text.length < 2) {
      return of([]);
    }

    return this.searchCanadianHighSchoolsFromBackend(text).pipe(catchError(() => of([])));
  }

  searchOntarioCourseProviders(query: string): Observable<CanadianHighSchoolLookupItem[]> {
    const text = String(query ?? '').trim();
    if (text.length < 2) {
      return of([]);
    }

    const params = new HttpParams()
      .set('q', text)
      .set('limit', '15')
      .set('country', 'Canada');

    return this.http
      .get<any>(this.ontarioCourseProviderSearchUrl, {
        params,
        ...this.withAuthHeaderIfAvailable(),
      })
      .pipe(
        map((resp) => this.mapBackendSchoolResults(resp)),
        catchError(() => of([]))
      );
  }

  uploadMySchoolTranscript(
    schoolRecordId: number,
    file: File
  ): Observable<StudentSchoolTranscriptPayload> {
    const url = `${this.selfProfileUrl}/schools/${Math.trunc(Number(schoolRecordId))}/transcript`;
    return this.uploadSchoolTranscriptWithFallback(url, file);
  }

  uploadStudentSchoolTranscriptForTeacher(
    studentId: number,
    schoolRecordId: number,
    file: File
  ): Observable<StudentSchoolTranscriptPayload> {
    const url = `${this.resolveTeacherStudentProfileUrl(studentId)}/schools/${Math.trunc(Number(schoolRecordId))}/transcript`;
    return this.uploadSchoolTranscriptWithFallback(url, file);
  }

  uploadMyIdentityFile(file: File): Observable<StudentIdentityFilePayload> {
    const url = `${this.selfProfileUrl}/identity-files`;
    return this.uploadIdentityFileWithFallback(url, file);
  }

  uploadStudentIdentityFileForTeacher(
    studentId: number,
    file: File
  ): Observable<StudentIdentityFilePayload> {
    const url = `${this.resolveTeacherStudentProfileUrl(studentId)}/identity-files`;
    return this.uploadIdentityFileWithFallback(url, file);
  }

  downloadMySchoolTranscript(schoolRecordId: number): Observable<HttpResponse<Blob>> {
    return this.http.get(
      `${this.selfProfileUrl}/schools/${Math.trunc(Number(schoolRecordId))}/transcript`,
      {
        observe: 'response',
        responseType: 'blob',
        ...this.withAuthHeaderIfAvailable(),
      }
    );
  }

  downloadStudentSchoolTranscriptForTeacher(
    studentId: number,
    schoolRecordId: number
  ): Observable<HttpResponse<Blob>> {
    return this.http.get(
      `${this.resolveTeacherStudentProfileUrl(studentId)}/schools/${Math.trunc(Number(schoolRecordId))}/transcript`,
      {
        observe: 'response',
        responseType: 'blob',
        ...this.withAuthHeaderIfAvailable(),
      }
    );
  }

  downloadMyIdentityFile(identityFileId: number): Observable<HttpResponse<Blob>> {
    return this.http.get(
      `${this.selfProfileUrl}/identity-files/${Math.trunc(Number(identityFileId))}`,
      {
        observe: 'response',
        responseType: 'blob',
        ...this.withAuthHeaderIfAvailable(),
      }
    );
  }

  downloadStudentIdentityFileForTeacher(
    studentId: number,
    identityFileId: number
  ): Observable<HttpResponse<Blob>> {
    return this.http.get(
      `${this.resolveTeacherStudentProfileUrl(studentId)}/identity-files/${Math.trunc(Number(identityFileId))}`,
      {
        observe: 'response',
        responseType: 'blob',
        ...this.withAuthHeaderIfAvailable(),
      }
    );
  }

  private uploadSchoolTranscriptWithFallback(
    url: string,
    file: File
  ): Observable<StudentSchoolTranscriptPayload> {
    return this.uploadSchoolTranscriptWithField(url, file, this.transcriptPrimaryField).pipe(
      catchError((error: unknown) => {
        if (!this.shouldRetryTranscriptWithFallbackField(error)) {
          return throwError(() => error);
        }

        return this.uploadSchoolTranscriptWithField(url, file, this.transcriptFallbackField);
      })
    );
  }

  private uploadSchoolTranscriptWithField(
    url: string,
    file: File,
    fieldName: string
  ): Observable<StudentSchoolTranscriptPayload> {
    const body = new FormData();
    body.append(fieldName, file);
    return this.http.post<StudentSchoolTranscriptPayload>(url, body, this.withAuthHeaderIfAvailable());
  }

  private uploadIdentityFileWithFallback(
    url: string,
    file: File
  ): Observable<StudentIdentityFilePayload> {
    return this.uploadIdentityFileWithField(url, file, this.identityFilePrimaryField).pipe(
      catchError((error: unknown) => {
        if (!this.shouldRetryTranscriptWithFallbackField(error)) {
          return throwError(() => error);
        }

        return this.uploadIdentityFileWithField(url, file, this.identityFileFallbackField);
      })
    );
  }

  private uploadIdentityFileWithField(
    url: string,
    file: File,
    fieldName: string
  ): Observable<StudentIdentityFilePayload> {
    const body = new FormData();
    body.append(fieldName, file);
    return this.http.post<StudentIdentityFilePayload>(url, body, this.withAuthHeaderIfAvailable());
  }

  private shouldRetryTranscriptWithFallbackField(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse)) return false;
    return error.status === 0 || error.status === 400 || error.status === 415 || error.status === 422;
  }

  private consumeProfileSaveContext(): StudentProfileSaveRequestOptions {
    const context = this.pendingProfileSaveContext;
    this.pendingProfileSaveContext = null;
    return context ? { ...context } : {};
  }

  private buildProfileSaveHeaders(
    options: StudentProfileSaveRequestOptions
  ): { headers?: HttpHeaders } {
    const authHeaders = this.withAuthHeaderIfAvailable();
    let headers = authHeaders.headers || new HttpHeaders();
    const ifMatchVersion = Number(options.ifMatchVersion);
    const changeSource = String(options.changeSource || '').trim();

    if (Number.isInteger(ifMatchVersion) && ifMatchVersion >= 0) {
      headers = headers.set('If-Match', String(ifMatchVersion));
    }
    if (changeSource) {
      headers = headers.set('X-Profile-Change-Source', changeSource);
    }

    return headers.keys().length > 0 ? { headers } : {};
  }

  private buildProfileHistoryParams(query: StudentProfileHistoryQuery): HttpParams {
    let params = new HttpParams();
    const page = Number(query.page);
    const size = Number(query.size);
    const normalizedSize =
      Number.isInteger(size) && size > 0 ? size : this.historyPageSizeDefault;

    if (Number.isInteger(page) && page >= 0) {
      params = params.set('page', String(page));
    }
    params = params.set('size', String(normalizedSize));

    return params;
  }

  private searchCanadianHighSchoolsFromBackend(query: string): Observable<CanadianHighSchoolLookupItem[]> {
    const params = new HttpParams()
      .set('q', query)
      .set('limit', '15')
      .set('country', 'Canada');

    return this.http
      .get<any>(this.canadianHighSchoolSearchUrl, {
        params,
        ...this.withAuthHeaderIfAvailable(),
      })
      .pipe(
        map((resp) => this.mapBackendSchoolResults(resp)),
        catchError(() => of([]))
      );
  }

  private mapBackendSchoolResults(payload: any): CanadianHighSchoolLookupItem[] {
    const rows: any[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.results)
          ? payload.results
          : [];

    const mapped = rows
      .map((row) => this.mapBackendSchoolResult(row))
      .filter((item): item is CanadianHighSchoolLookupItem => item !== null);

    const dedupedByKey = new Map<string, CanadianHighSchoolLookupItem>();
    for (const item of mapped) {
      const key = `${item.name.toLowerCase()}|${item.streetAddress.toLowerCase()}|${item.postal.toLowerCase()}`;
      const existing = dedupedByKey.get(key);
      if (!existing) {
        dedupedByKey.set(key, item);
        continue;
      }

      // Prefer richer duplicate rows so board auto-fill is not lost.
      if (!existing.boardName && item.boardName) {
        existing.boardName = item.boardName;
      }
      if (!existing.schoolSpecialConditions && item.schoolSpecialConditions) {
        existing.schoolSpecialConditions = item.schoolSpecialConditions;
      }
      if (!existing.displayAddress && item.displayAddress) {
        existing.displayAddress = item.displayAddress;
      }
    }

    return Array.from(dedupedByKey.values());
  }

  private mapBackendSchoolResult(row: any): CanadianHighSchoolLookupItem | null {
    if (!row || typeof row !== 'object') return null;

    const address = row.address && typeof row.address === 'object' ? row.address : {};
    const schoolNode = row.school && typeof row.school === 'object' ? row.school : {};

    const name = String(row.name || row.schoolName || '').trim();
    if (!name) return null;

    const streetAddress = String(
      row.streetAddress || address.streetAddress || address.street || ''
    ).trim();
    const city = String(row.city || address.city || '').trim();
    const state = String(row.state || row.province || address.state || address.province || '').trim();
    const country = String(row.country || address.country || 'Canada').trim() || 'Canada';
    const postal = String(row.postal || row.postalCode || address.postal || address.postalCode || '').trim();
    const displayAddress = String(
      row.displayAddress ||
        [streetAddress, city, state, postal, country].filter(Boolean).join(', ')
    ).trim();
    const lookupKey = String(row.id || row.lookupKey || row.code || `${name}|${streetAddress}|${postal}`).trim();
    const boardNameFromPayload = String(
      row.boardName ||
        row.board ||
        row.schoolBoard ||
        row.schoolBoardName ||
        row.educationBureau ||
        row.educationAuthority ||
        row.district ||
        row.districtName ||
        schoolNode.boardName ||
        schoolNode.board ||
        schoolNode.schoolBoard ||
        ''
    ).trim();
    const boardNameFromLibrary = this.resolveBoardNameFromCodeFields(row, schoolNode, lookupKey);
    const boardName = normalizeEducationBoardName(boardNameFromPayload || boardNameFromLibrary);
    const schoolSpecialConditions = String(
      row.schoolSpecialConditions || row.specialCondition || row.specialConditions || ''
    ).trim();

    return {
      name,
      streetAddress,
      city,
      state,
      country,
      postal,
      displayAddress,
      lookupKey,
      boardName,
      schoolSpecialConditions,
    };
  }

  private resolveBoardNameFromCodeFields(row: any, schoolNode: any, lookupKey: string): string {
    const candidates = [
      row?.boardCode,
      row?.schoolBoardCode,
      row?.districtCode,
      row?.boardId,
      row?.schoolBoardId,
      row?.id,
      row?.lookupKey,
      lookupKey,
      schoolNode?.boardCode,
      schoolNode?.schoolBoardCode,
      schoolNode?.boardId,
      schoolNode?.schoolBoardId,
      schoolNode?.id,
      schoolNode?.lookupKey,
    ];

    for (const candidate of candidates) {
      const boardName = this.resolveBoardNameFromLookupKey(candidate);
      if (boardName) return boardName;
    }

    return '';
  }

  private resolveBoardNameFromLookupKey(value: unknown): string {
    const boardCode = this.extractEducationBoardCode(value);
    if (!boardCode) return '';
    return EDUCATION_BOARD_LIBRARY_BY_CODE[boardCode] || '';
  }

  private extractEducationBoardCode(value: unknown): string {
    const text = String(value ?? '').trim();
    if (!text) return '';
    const match = text.match(/(?:^|:)(B\d{5})(?::|$)/i);
    if (!match || !match[1]) return '';
    return match[1].toUpperCase();
  }

  private resolveTeacherStudentProfileUrl(studentId: number): string {
    const normalizedStudentId = Number.isFinite(Number(studentId))
      ? Math.trunc(Number(studentId))
      : 0;
    return `${this.teacherStudentProfileBaseUrl}/${normalizedStudentId}/profile`;
  }
}

