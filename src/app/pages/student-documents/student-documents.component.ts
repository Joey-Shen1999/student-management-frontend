import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';

import {
  type StudentDocumentPayload,
  type StudentDocumentUploadOptions,
  StudentProfileService,
} from '../../services/student-profile.service';

type DocumentCategory = 'Identity Document' | 'Academic Record' | 'Other';
type IdentityDocumentType = 'Passport' | 'Study Permit / Visa' | 'PR Card' | 'Other';
type AcademicRecordType = 'transcript' | 'report card';
type AcademicRecordTerm = 'winter' | 'spring' | 'summer' | 'fall';

interface UploadFormModel {
  documentCategory: DocumentCategory;
  identityDocumentType: IdentityDocumentType;
  academicRecordType: AcademicRecordType;
  academicRecordYear: string;
  academicRecordTerm: AcademicRecordTerm;
  title: string;
  notes: string;
  file: File | null;
}

interface AcademicMetadataOverride {
  reportYear: number | null;
  reportMonth: string;
}

const DOCUMENT_CATEGORY_OPTIONS: readonly DocumentCategory[] = [
  'Identity Document',
  'Academic Record',
  'Other',
] as const;

const IDENTITY_DOCUMENT_TYPE_OPTIONS: readonly IdentityDocumentType[] = [
  'Passport',
  'Study Permit / Visa',
  'PR Card',
  'Other',
] as const;

const ACADEMIC_RECORD_TYPE_TRANSCRIPT = 'transcript';
const ACADEMIC_RECORD_TYPE_REPORT_CARD = 'report card';
const ACADEMIC_RECORD_TYPE_OPTIONS: readonly AcademicRecordType[] = [
  ACADEMIC_RECORD_TYPE_TRANSCRIPT,
  ACADEMIC_RECORD_TYPE_REPORT_CARD,
] as const;

const ACADEMIC_RECORD_TERM_WINTER = 'winter';
const ACADEMIC_RECORD_TERM_SPRING = 'spring';
const ACADEMIC_RECORD_TERM_SUMMER = 'summer';
const ACADEMIC_RECORD_TERM_FALL = 'fall';
const ACADEMIC_RECORD_TERM_OPTIONS: readonly AcademicRecordTerm[] = [
  ACADEMIC_RECORD_TERM_WINTER,
  ACADEMIC_RECORD_TERM_SPRING,
  ACADEMIC_RECORD_TERM_SUMMER,
  ACADEMIC_RECORD_TERM_FALL,
] as const;

@Component({
  selector: 'app-student-documents',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="documents-page">
      <div class="documents-shell">
        <div class="documents-header">
          <div>
            <h2>学生材料上传中心</h2>
            <p>专注上传并查看历史记录</p>
          </div>
          <div class="header-actions">
            <button
              type="button"
              class="action-btn ghost compact"
              (click)="refreshHistory()"
              [disabled]="historyLoading || uploading"
            >
              {{ historyLoading ? '刷新中...' : '刷新记录' }}
            </button>
            <button type="button" class="action-btn ghost compact" (click)="goBack()">返回工作台</button>
          </div>
        </div>

        <section class="documents-card">
          <h3>上传新材料</h3>
          <form class="upload-form" (ngSubmit)="submitUpload()">
            <div class="form-grid">
              <label class="field-group">
                <span>材料类别</span>
                <select
                  [(ngModel)]="form.documentCategory"
                  name="documentCategory"
                  (ngModelChange)="onDocumentCategoryChange($event)"
                  [disabled]="uploading"
                >
                  <option *ngFor="let option of documentCategoryOptions" [value]="option">
                    {{ option }}
                  </option>
                </select>
              </label>

              <label class="field-group" *ngIf="form.documentCategory === 'Identity Document'">
                <span>身份证明类型</span>
                <select
                  [(ngModel)]="form.identityDocumentType"
                  name="identityDocumentType"
                  [disabled]="uploading"
                >
                  <option *ngFor="let option of identityDocumentTypeOptions" [value]="option">
                    {{ option }}
                  </option>
                </select>
              </label>

              <label class="field-group" *ngIf="form.documentCategory === 'Academic Record'">
                <span>学术记录类型</span>
                <select
                  [(ngModel)]="form.academicRecordType"
                  name="academicRecordType"
                  [disabled]="uploading"
                >
                  <option *ngFor="let option of academicRecordTypeOptions" [value]="option">
                    {{ option }}
                  </option>
                </select>
              </label>

              <label class="field-group" *ngIf="form.documentCategory === 'Academic Record'">
                <span>学期年份</span>
                <input
                  [(ngModel)]="form.academicRecordYear"
                  name="academicRecordYear"
                  [disabled]="uploading"
                  inputmode="numeric"
                  maxlength="4"
                  placeholder="例如 25 或 2025"
                />
              </label>

              <label class="field-group" *ngIf="form.documentCategory === 'Academic Record'">
                <span>学期</span>
                <select
                  [(ngModel)]="form.academicRecordTerm"
                  name="academicRecordTerm"
                  [disabled]="uploading"
                >
                  <option *ngFor="let option of academicRecordTermOptions" [value]="option">
                    {{ option }}
                  </option>
                </select>
              </label>

              <label class="field-group full">
                <span>材料标题</span>
                <input
                  [(ngModel)]="form.title"
                  name="title"
                  [disabled]="uploading"
                  placeholder="例如：护照首页 / Grade 11 Transcript"
                />
              </label>

              <label class="field-group full">
                <span>备注（可选）</span>
                <textarea
                  [(ngModel)]="form.notes"
                  name="notes"
                  rows="3"
                  [disabled]="uploading"
                  placeholder="可填写补充信息"
                ></textarea>
              </label>

              <label class="field-group full">
                <span>选择文件</span>
                <input
                  type="file"
                  name="documentFile"
                  accept=".pdf"
                  (change)="onFileSelected($event)"
                  [disabled]="uploading"
                />
                <span class="hint-text" *ngIf="selectedFileName">已选择：{{ selectedFileName }}</span>
              </label>
            </div>

            <div class="upload-actions">
              <button type="submit" class="action-btn primary" [disabled]="uploading">
                {{ uploading ? '上传中...' : '上传材料' }}
              </button>
            </div>
          </form>

          <div *ngIf="uploadError" class="state-banner error">{{ uploadError }}</div>
          <div *ngIf="successMessage" class="state-banner success">{{ successMessage }}</div>
        </section>

        <section class="documents-card">
          <div class="section-head">
            <h3>上传历史</h3>
            <span class="count-badge">{{ documents.length }} 条</span>
          </div>

          <div *ngIf="historyLoading" class="state-text">正在加载历史记录...</div>
          <div *ngIf="!historyLoading && historyError" class="state-banner error">{{ historyError }}</div>
          <div *ngIf="!historyLoading && !historyError && documents.length === 0" class="state-text">
            还没有上传记录。
          </div>

          <div *ngIf="!historyLoading && !historyError && documents.length > 0" class="history-list">
            <article class="history-item" *ngFor="let document of documents; trackBy: trackDocument">
              <div class="history-row">
                <h4>{{ displayTitle(document) }}</h4>
                <span>{{ displayUploadedAt(document.uploadedAt) }}</span>
              </div>

              <div class="history-meta">
                <span>{{ displayDocumentType(document) }}</span>
                <span *ngIf="displayAcademicRecordTerm(document)">{{ displayAcademicRecordTerm(document) }}</span>
                <span>{{ displayFileName(document) }}</span>
                <span>{{ displayFileSize(document.sizeBytes) }}</span>
                <span>{{ displayUploadedBy(document) }}</span>
              </div>

              <p *ngIf="displayNotes(document)" class="history-notes">{{ displayNotes(document) }}</p>

              <div class="history-actions">
                <button
                  type="button"
                  class="action-btn secondary compact"
                  (click)="viewDocument(document)"
                  [disabled]="toDocumentId(document) === null || viewingDocumentId !== null || deletingDocumentId !== null"
                >
                  {{ viewingDocumentId === toDocumentId(document) ? '打开中...' : '查看文件' }}
                </button>
                <button
                  type="button"
                  class="action-btn danger compact"
                  (click)="deleteDocument(document)"
                  [disabled]="toDocumentId(document) === null || viewingDocumentId !== null || deletingDocumentId !== null"
                >
                  {{ deletingDocumentId === toDocumentId(document) ? '删除中...' : '删除' }}
                </button>
              </div>
            </article>
          </div>
        </section>

      </div>
    </div>
  `,
  styleUrl: './student-documents.component.scss',
})
export class StudentDocumentsComponent implements OnInit {
  readonly documentCategoryOptions: readonly DocumentCategory[] = DOCUMENT_CATEGORY_OPTIONS;
  readonly identityDocumentTypeOptions: readonly IdentityDocumentType[] = IDENTITY_DOCUMENT_TYPE_OPTIONS;
  readonly academicRecordTypeOptions: readonly AcademicRecordType[] = ACADEMIC_RECORD_TYPE_OPTIONS;
  readonly academicRecordTermOptions: readonly AcademicRecordTerm[] = ACADEMIC_RECORD_TERM_OPTIONS;

  form: UploadFormModel = this.createDefaultUploadForm();
  selectedFileName = '';

  documents: StudentDocumentPayload[] = [];
  historyLoading = false;
  historyError = '';
  uploading = false;
  uploadError = '';
  successMessage = '';
  viewingDocumentId: number | null = null;
  deletingDocumentId: number | null = null;
  targetStudentId: number | null = null;

  private fileInputElement: HTMLInputElement | null = null;
  private readonly academicMetadataOverridesKey = 'sm_student_document_academic_metadata_overrides';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private profileApi: StudentProfileService,
    private cdr: ChangeDetectorRef = { detectChanges: () => {} } as ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.targetStudentId = this.resolveTargetStudentIdFromRoute();
    this.loadHistory();
  }

  trackDocument = (index: number, row: StudentDocumentPayload): number =>
    this.toDocumentId(row) ?? index;

  goBack(): void {
    if (this.targetStudentId !== null) {
      this.router.navigate(['/teacher/students']);
      return;
    }

    this.router.navigate(['/dashboard']);
  }

  refreshHistory(): void {
    this.loadHistory();
  }

  onDocumentCategoryChange(value: string): void {
    const normalized = this.normalizeDocumentCategory(value);
    this.form.documentCategory = normalized || 'Identity Document';

    if (this.form.documentCategory !== 'Academic Record') {
      this.form.academicRecordType = ACADEMIC_RECORD_TYPE_TRANSCRIPT;
      this.form.academicRecordYear = '';
      this.form.academicRecordTerm = ACADEMIC_RECORD_TERM_FALL;
    }

    if (this.form.documentCategory !== 'Identity Document') {
      this.form.identityDocumentType = 'Other';
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.fileInputElement = input;
    const file = input?.files && input.files.length > 0 ? input.files[0] : null;
    this.form.file = file;
    this.selectedFileName = file ? file.name : '';

    if (file && !this.toText(this.form.title)) {
      this.form.title = this.stripFileExtension(file.name);
    }
  }

  submitUpload(): void {
    if (this.uploading) return;

    const validationError = this.validateUploadForm();
    if (validationError) {
      this.uploadError = validationError;
      this.successMessage = '';
      this.cdr.detectChanges();
      return;
    }

    const file = this.form.file;
    if (!file) return;

    this.uploading = true;
    this.uploadError = '';
    this.successMessage = '';
    this.cdr.detectChanges();

    const options = this.buildUploadOptions();
    this.uploadDocument(file, options)
      .pipe(
        finalize(() => {
          this.uploading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (savedDocument) => {
          this.rememberUploadedAcademicMetadata(savedDocument, options);
          this.successMessage = '材料上传成功。';
          this.form.title = '';
          this.form.notes = '';
          this.clearSelectedFile();
          this.loadHistory(true);
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.uploadError = this.extractErrorMessage(error) || '上传失败，请稍后重试。';
          this.cdr.detectChanges();
        },
      });
  }

  viewDocument(row: StudentDocumentPayload): void {
    if (this.viewingDocumentId !== null || this.deletingDocumentId !== null) return;

    const documentId = this.toDocumentId(row);
    if (documentId === null) return;

    this.viewingDocumentId = documentId;
    this.historyError = '';
    this.cdr.detectChanges();

    this.viewDocumentFile(documentId)
      .pipe(
        finalize(() => {
          this.viewingDocumentId = null;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (resp) => {
          const blob = resp.body;
          if (!blob) return;

          const contentDisposition = resp.headers.get('content-disposition');
          const fileName =
            this.resolveDownloadFileName(contentDisposition) || this.displayFileName(row);
          this.triggerBlobDownload(blob, fileName);
        },
        error: (error: unknown) => {
          this.historyError = this.extractErrorMessage(error) || '查看文件失败。';
          this.cdr.detectChanges();
        },
      });
  }

  deleteDocument(row: StudentDocumentPayload): void {
    if (this.deletingDocumentId !== null || this.viewingDocumentId !== null) return;

    const documentId = this.toDocumentId(row);
    if (documentId === null) return;

    const fileName = this.displayFileName(row);
    const shouldDelete = window.confirm(`确认删除 ${fileName} 吗？`);
    if (!shouldDelete) return;

    this.deletingDocumentId = documentId;
    this.historyError = '';
    this.successMessage = '';
    this.cdr.detectChanges();

    this.deleteDocumentFile(documentId)
      .pipe(
        finalize(() => {
          this.deletingDocumentId = null;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: () => {
          this.documents = this.documents.filter(
            (item) => this.toDocumentId(item) !== documentId
          );
          this.successMessage = '材料已删除。';
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.historyError = this.extractErrorMessage(error) || '删除失败，请稍后重试。';
          this.cdr.detectChanges();
        },
      });
  }

  displayTitle(row: StudentDocumentPayload): string {
    return this.toText(row.title) || this.displayFileName(row) || '未命名材料';
  }

  displayNotes(row: StudentDocumentPayload): string {
    return this.toText(row.notes);
  }

  displayFileName(row: StudentDocumentPayload): string {
    return this.toText(row.fileName) || '未命名文件';
  }

  displayFileSize(value: unknown): string {
    const size = Number(value);
    if (!Number.isFinite(size) || size <= 0) return '-';

    if (size < 1024) return `${Math.trunc(size)} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(size >= 10 * 1024 ? 1 : 2)} KB`;
    return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 1 : 2)} MB`;
  }

  displayUploadedAt(value: unknown): string {
    const timestamp = Date.parse(String(value || ''));
    if (!Number.isFinite(timestamp)) return '-';
    return new Date(timestamp).toLocaleString();
  }

  displayUploadedBy(row: StudentDocumentPayload): string {
    const fallback = this.resolveSessionUploadActorFallback(row);
    const rawName = this.toText(row.uploadedByName);
    const name = this.isUnknownActorName(rawName) ? fallback.name : rawName;
    const roleLabel = this.displayActorRole(row.uploadedByRole || fallback.role);
    if (!name) return '上传人：待同步';
    return roleLabel ? `上传人：${name}（${roleLabel}）` : `上传人：${name}`;
  }

  displayDocumentType(row: StudentDocumentPayload): string {
    const category = this.toText(row.documentCategory);
    if (category === 'Identity Document') {
      return '身份证明';
    }

    if (category === 'Academic Record') {
      const type =
        this.normalizeAcademicRecordType(row.academicRecordType) ||
        ACADEMIC_RECORD_TYPE_TRANSCRIPT;
      return `Academic Record · ${type}`;
    }

    if (category === 'Other') return '其他';
    return category || '未分类';
  }

  displayAcademicRecordTerm(row: StudentDocumentPayload): string {
    if (this.toText(row.documentCategory) !== 'Academic Record') return '';
    return this.buildAcademicRecordTermText(row.reportYear, row.reportMonth);
  }

  toDocumentId(row: StudentDocumentPayload): number | null {
    const value = Number(row.id);
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.trunc(value);
  }

  private resolveTargetStudentIdFromRoute(): number | null {
    const queryStudentId = this.route.snapshot.queryParamMap.get('studentId');
    const pathStudentId = this.route.snapshot.paramMap.get('studentId');
    return this.normalizeStudentId(queryStudentId ?? pathStudentId);
  }

  private normalizeStudentId(value: unknown): number | null {
    const normalized = Number(value);
    if (!Number.isFinite(normalized) || normalized <= 0) return null;
    return Math.trunc(normalized);
  }

  private listDocuments() {
    const studentId = this.targetStudentId;
    if (studentId !== null) {
      return this.profileApi.listStudentDocumentsForTeacher(studentId);
    }
    return this.profileApi.listMyDocuments();
  }

  private uploadDocument(file: File, options: StudentDocumentUploadOptions) {
    const studentId = this.targetStudentId;
    if (studentId !== null) {
      return this.profileApi.uploadStudentDocumentForTeacher(studentId, file, options);
    }
    return this.profileApi.uploadMyDocument(file, options);
  }

  private viewDocumentFile(documentId: number) {
    const studentId = this.targetStudentId;
    if (studentId !== null) {
      return this.profileApi.viewStudentDocumentFileForTeacher(studentId, documentId);
    }
    return this.profileApi.viewMyDocumentFile(documentId);
  }

  private deleteDocumentFile(documentId: number) {
    const studentId = this.targetStudentId;
    if (studentId !== null) {
      return this.profileApi.deleteStudentDocumentForTeacher(studentId, documentId);
    }
    return this.profileApi.deleteMyDocument(documentId);
  }

  private loadHistory(preserveSuccessMessage = false): void {
    this.historyLoading = true;
    this.historyError = '';
    if (!preserveSuccessMessage) this.successMessage = '';
    this.cdr.detectChanges();

    this.listDocuments()
      .pipe(
        finalize(() => {
          this.historyLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (payload) => {
          this.documents = this.normalizeDocumentList(payload);
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.documents = [];
          if (error instanceof HttpErrorResponse && error.status === 404) {
            this.historyError = '上传历史接口暂未开通（后端返回 404）。';
          } else {
            this.historyError = this.extractErrorMessage(error) || '加载历史记录失败。';
          }
          this.cdr.detectChanges();
        },
      });
  }

  private normalizeDocumentList(payload: unknown): StudentDocumentPayload[] {
    return this.resolveDocumentRows(payload)
      .map((row) => this.applyAcademicMetadataOverride({ ...row }))
      .sort((left, right) => {
        const tsDelta = this.toTimestamp(right.uploadedAt) - this.toTimestamp(left.uploadedAt);
        if (tsDelta !== 0) return tsDelta;
        return (this.toDocumentId(right) || 0) - (this.toDocumentId(left) || 0);
      });
  }

  private resolveDocumentRows(payload: unknown): StudentDocumentPayload[] {
    if (Array.isArray(payload)) {
      return payload.filter((row): row is StudentDocumentPayload => !!row && typeof row === 'object');
    }
    if (!payload || typeof payload !== 'object') return [];

    const node = payload as Record<string, unknown>;
    const collectionCandidate = [node['items'], node['documents'], node['rows']].find((value) =>
      Array.isArray(value)
    );
    if (!Array.isArray(collectionCandidate)) return [];

    return collectionCandidate.filter(
      (row): row is StudentDocumentPayload => !!row && typeof row === 'object'
    );
  }

  private validateUploadForm(): string {
    if (!this.form.file) {
      return '请选择要上传的文件。';
    }

    if (this.form.documentCategory === 'Academic Record') {
      const reportYear = this.normalizeAcademicRecordYear(this.form.academicRecordYear);
      if (reportYear === null || reportYear <= 0) {
        return '请填写学期年份（例如 25 或 2025）。';
      }

      const reportMonth = this.normalizeAcademicRecordTerm(this.form.academicRecordTerm);
      if (!reportMonth) {
        return '请选择学期（winter/spring/summer/fall）。';
      }
    }

    const title = this.toText(this.form.title);
    if (!title) {
      return '请填写材料标题。';
    }

    return '';
  }

  private buildUploadOptions(): StudentDocumentUploadOptions {
    const options: StudentDocumentUploadOptions = {
      documentCategory: this.form.documentCategory,
      title: this.toText(this.form.title),
    };

    const notes = this.toText(this.form.notes);
    if (notes) {
      options.notes = notes;
    }

    if (this.form.documentCategory === 'Identity Document') {
      options.identityDocumentType = this.form.identityDocumentType || 'Other';
    }

    if (this.form.documentCategory === 'Academic Record') {
      options.academicRecordType = this.form.academicRecordType || ACADEMIC_RECORD_TYPE_TRANSCRIPT;
      options.reportYear = this.normalizeAcademicRecordYear(this.form.academicRecordYear);
      options.reportMonth = this.normalizeAcademicRecordTerm(this.form.academicRecordTerm);
    }

    return options;
  }

  private rememberUploadedAcademicMetadata(
    savedDocument: StudentDocumentPayload,
    options: StudentDocumentUploadOptions
  ): void {
    if (options.documentCategory !== 'Academic Record') return;

    const documentId = this.toDocumentId(savedDocument);
    if (documentId === null) return;

    const reportYear = Number(options.reportYear);
    const reportMonth = this.normalizeAcademicRecordTerm(options.reportMonth);
    if (!Number.isFinite(reportYear) || reportYear <= 0 || !reportMonth) return;

    const overrides = this.readAcademicMetadataOverrides();
    overrides[this.academicMetadataOverrideKey(documentId)] = {
      reportYear: Math.trunc(reportYear),
      reportMonth,
    };
    this.writeAcademicMetadataOverrides(overrides);
  }

  private applyAcademicMetadataOverride(row: StudentDocumentPayload): StudentDocumentPayload {
    if (this.toText(row.documentCategory) !== 'Academic Record') return row;
    if (this.toText(row.reportYear) && this.toText(row.reportMonth)) return row;

    const documentId = this.toDocumentId(row);
    if (documentId === null) return row;

    const override = this.readAcademicMetadataOverrides()[this.academicMetadataOverrideKey(documentId)];
    if (!override) return row;

    return {
      ...row,
      reportYear: row.reportYear ?? override.reportYear,
      reportMonth: this.toText(row.reportMonth) || override.reportMonth,
    };
  }

  private academicMetadataOverrideKey(documentId: number): string {
    return `${this.targetStudentId ?? 'self'}:${documentId}`;
  }

  private readAcademicMetadataOverrides(): Record<string, AcademicMetadataOverride> {
    try {
      const raw = localStorage.getItem(this.academicMetadataOverridesKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object'
        ? (parsed as Record<string, AcademicMetadataOverride>)
        : {};
    } catch {
      return {};
    }
  }

  private writeAcademicMetadataOverrides(overrides: Record<string, AcademicMetadataOverride>): void {
    try {
      localStorage.setItem(this.academicMetadataOverridesKey, JSON.stringify(overrides));
    } catch {
      // Ignore storage failures; backend metadata remains the source of truth.
    }
  }

  private createDefaultUploadForm(): UploadFormModel {
    return {
      documentCategory: 'Identity Document',
      identityDocumentType: 'Passport',
      academicRecordType: ACADEMIC_RECORD_TYPE_TRANSCRIPT,
      academicRecordYear: '',
      academicRecordTerm: ACADEMIC_RECORD_TERM_FALL,
      title: '',
      notes: '',
      file: null,
    };
  }

  private clearSelectedFile(): void {
    this.form.file = null;
    this.selectedFileName = '';
    if (this.fileInputElement) {
      this.fileInputElement.value = '';
    }
  }

  private toTimestamp(value: unknown): number {
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private stripFileExtension(fileName: string): string {
    const name = this.toText(fileName);
    if (!name) return '';
    const index = name.lastIndexOf('.');
    if (index <= 0) return name;
    return name.slice(0, index);
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

  private triggerBlobDownload(blob: Blob, fileName: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName || 'document.bin';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
  }

  private normalizeDocumentCategory(value: unknown): DocumentCategory | '' {
    const text = this.toText(value);
    if (text === 'Identity Document') return text;
    if (text === 'Academic Record') return text;
    if (text === 'Other') return text;
    return '';
  }

  private normalizeAcademicRecordType(value: unknown): AcademicRecordType | '' {
    const text = this.toText(value).toLowerCase();
    if (text === ACADEMIC_RECORD_TYPE_TRANSCRIPT) return ACADEMIC_RECORD_TYPE_TRANSCRIPT;
    if (text === ACADEMIC_RECORD_TYPE_REPORT_CARD) return ACADEMIC_RECORD_TYPE_REPORT_CARD;
    return '';
  }

  private normalizeAcademicRecordYear(value: unknown): number | null {
    const text = this.toText(value);
    if (!text) return null;

    const normalized = text.replace(/\s+/g, '');
    if (!/^\d{2}$|^\d{4}$/.test(normalized)) return null;

    const year = Number(normalized);
    if (!Number.isFinite(year) || year <= 0) return null;

    if (normalized.length === 2) {
      return 2000 + Math.trunc(year);
    }

    const fullYear = Math.trunc(year);
    if (fullYear < 2000 || fullYear > 2099) return null;
    return fullYear;
  }

  private normalizeAcademicRecordTerm(value: unknown): AcademicRecordTerm | '' {
    const text = this.toText(value).toLowerCase();
    if (text === ACADEMIC_RECORD_TERM_WINTER) return ACADEMIC_RECORD_TERM_WINTER;
    if (text === ACADEMIC_RECORD_TERM_SPRING) return ACADEMIC_RECORD_TERM_SPRING;
    if (text === ACADEMIC_RECORD_TERM_SUMMER) return ACADEMIC_RECORD_TERM_SUMMER;
    if (text === ACADEMIC_RECORD_TERM_FALL) return ACADEMIC_RECORD_TERM_FALL;
    return '';
  }

  private buildAcademicRecordTermText(reportYearValue: unknown, reportMonthValue: unknown): string {
    const reportMonth = this.displayAcademicRecordTermName(reportMonthValue);
    const reportYearText = this.toText(reportYearValue);
    if (!reportYearText && !reportMonth) return '';

    const reportYearNumber = Number(reportYearText);
    if (!Number.isFinite(reportYearNumber) || reportYearNumber <= 0) {
      return reportMonth ? `学期：${reportMonth}` : '';
    }

    const normalizedYear = Math.trunc(reportYearNumber);
    if (!reportMonth) return `学期年份：${normalizedYear}`;
    return `学期：${normalizedYear} ${reportMonth}`;
  }

  private displayAcademicRecordTermName(value: unknown): string {
    const normalizedTerm = this.normalizeAcademicRecordTerm(value);
    if (normalizedTerm) return normalizedTerm;
    const month = this.toText(value).toLowerCase();
    if (['december', 'january', 'february'].includes(month)) return ACADEMIC_RECORD_TERM_WINTER;
    if (['march', 'april', 'may'].includes(month)) return ACADEMIC_RECORD_TERM_SPRING;
    if (['june', 'july', 'august'].includes(month)) return ACADEMIC_RECORD_TERM_SUMMER;
    if (['september', 'october', 'november'].includes(month)) return ACADEMIC_RECORD_TERM_FALL;
    return this.toText(value);
  }

  private displayActorRole(value: unknown): string {
    const role = this.toText(value).toUpperCase();
    if (role === 'STUDENT') return '学生';
    if (role === 'TEACHER') return '老师';
    if (role === 'ADMIN') return '管理员';
    return role;
  }

  private resolveSessionUploadActorFallback(row: StudentDocumentPayload): {
    name: string;
    role: string;
  } {
    const session = this.readSession();
    if (!session) return { name: '', role: '' };

    const sessionUserId = Number(session.userId);
    const uploadedBy = Number(row.uploadedBy);
    const sameUser =
      Number.isFinite(sessionUserId) &&
      sessionUserId > 0 &&
      Number.isFinite(uploadedBy) &&
      uploadedBy > 0 &&
      Math.trunc(sessionUserId) === Math.trunc(uploadedBy);

    if (sameUser || (!Number.isFinite(uploadedBy) && this.targetStudentId === null)) {
      const role = this.toText(session.role);
      return {
        name: this.toText(session.username) || (role.toUpperCase() === 'STUDENT' ? '本人' : '当前用户'),
        role,
      };
    }

    return { name: '', role: '' };
  }

  private readSession(): { userId?: unknown; username?: unknown; role?: unknown } | null {
    try {
      const raw = localStorage.getItem('sm_session');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  private isUnknownActorName(value: string): boolean {
    return !value || value.toLowerCase() === 'unknown' || value.toLowerCase() === 'system';
  }

  private toText(value: unknown): string {
    return String(value ?? '').trim();
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const payloadMessage = String((error.error as { message?: unknown })?.message || '').trim();
      if (payloadMessage) return payloadMessage;
      if (error.status > 0) return `请求失败（HTTP ${error.status}）。`;
      return '';
    }

    if (typeof error === 'string') return error;
    if (!error || typeof error !== 'object') return '';

    const node = error as { message?: unknown; error?: unknown; status?: unknown };
    if (node.error && typeof node.error === 'object') {
      const payload = node.error as { message?: unknown; error?: unknown };
      const payloadMessage = String(payload.message || payload.error || '').trim();
      if (payloadMessage) return payloadMessage;
    }

    const directMessage = String(node.message || node.error || '').trim();
    if (directMessage) return directMessage;

    const status = Number(node.status);
    if (Number.isFinite(status) && status > 0) {
      return `请求失败（HTTP ${status}）。`;
    }

    return '';
  }
}
