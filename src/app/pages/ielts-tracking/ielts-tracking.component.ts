import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';

import {
  computeIeltsOverall,
  deriveStudentIeltsModuleState,
  DerivedStudentIeltsModuleState,
} from '../../features/ielts/ielts-derive';
import { IELTS_TRACKING_RULESET_V1 } from '../../features/ielts/ielts-rules';
import {
  IeltsPreparationIntent,
  IeltsRecordFormValue,
  IeltsTrackingStatus,
  StudentIeltsModuleState,
} from '../../features/ielts/ielts-types';
import { AuthService } from '../../services/auth.service';
import { IeltsTrackingService } from '../../services/ielts-tracking.service';

@Component({
  selector: 'app-ielts-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="ielts-page">
      <div class="ielts-shell">
        <div class="header-row">
          <div>
            <h2>IELTS / English Requirement</h2>
            <p class="sub-title">
              {{ managedMode ? ('Teacher mode - Student #' + studentId) : 'Student mode' }}
            </p>
          </div>
          <button type="button" class="ghost-btn" (click)="goBack()">Back</button>
        </div>

        <div *ngIf="loading" class="state-text">Loading IELTS module...</div>
        <div *ngIf="error" class="error-banner">{{ error }}</div>
        <div *ngIf="savedMessage" class="success-banner">{{ savedMessage }}</div>

        <ng-container *ngIf="!loading && !error && moduleState && derived as vm">
          <section class="card">
            <h3>你目前的雅思申请情况</h3>
            <div class="status-pill" [style.background]="vm.summary.colorToken">
              {{ displayTrackingStatusLabel(vm.summary.trackingStatus, vm.summary.shouldShowModule) }}
            </div>
            <div class="summary-title">{{ vm.summary.trackingTitle }}</div>
            <p class="summary-text">{{ vm.summary.trackingMessage }}</p>
            <p class="summary-note">
              规则线：{{ ruleSet.labels.commonLineName }} / {{ ruleSet.labels.strictLineName }}
            </p>
            <p class="summary-note">
              有效期窗口：{{ vm.summary.validityCutoffDate || '待确定' }} 至
              {{ vm.summary.validityAnchorDate || '待确定' }}
            </p>
          </section>

          <section class="card" *ngIf="!vm.summary.shouldShowModule && !forceShowModule">
            <h3>无需雅思</h3>
            <p>该学生当前不在语言风险范围内。本期仍允许老师按实际申请情况人工复核。</p>
          </section>

          <section class="card" *ngIf="vm.summary.shouldShowModule || forceShowModule">
            <h3>学生填写</h3>
            <p class="summary-note" *ngIf="forceShowModule && !vm.summary.shouldShowModule">
              Debug mode: form is forced visible by query param <code>forceShowIelts=1</code>.
            </p>

            <div class="field-row">
              <label>Have you taken IELTS Academic?</label>
              <div class="inline-options">
                <label>
                  <input
                    type="radio"
                    name="hasTakenIelts"
                    [checked]="hasTakenIeltsAcademic === true"
                    (change)="setHasTakenIelts(true)"
                  />
                  Yes
                </label>
                <label>
                  <input
                    type="radio"
                    name="hasTakenIelts"
                    [checked]="hasTakenIeltsAcademic === false"
                    (change)="setHasTakenIelts(false)"
                  />
                  No
                </label>
              </div>
            </div>

            <div *ngIf="hasTakenIeltsAcademic === true" class="records-block">
              <div class="records-head">
                <h4>IELTS Academic Records</h4>
                <button type="button" class="secondary-btn" (click)="addRecord()">+ Add record</button>
              </div>

              <p *ngIf="records.length <= 0" class="state-text">No record yet. Add at least one test record.</p>

              <div class="record-card" *ngFor="let record of records; let idx = index; trackBy: trackRecord">
                <div class="record-title">
                  <strong>Record {{ idx + 1 }}</strong>
                  <button type="button" class="danger-btn" (click)="removeRecord(idx)">Remove</button>
                </div>

                <div class="record-grid">
                  <label>
                    Test Date
                    <input type="date" [(ngModel)]="record.testDate" [name]="'testDate_' + idx" />
                  </label>
                  <label>
                    Listening
                    <input
                      type="number"
                      min="0"
                      max="9"
                      step="0.5"
                      [(ngModel)]="record.listening"
                      [name]="'listening_' + idx"
                    />
                  </label>
                  <label>
                    Reading
                    <input
                      type="number"
                      min="0"
                      max="9"
                      step="0.5"
                      [(ngModel)]="record.reading"
                      [name]="'reading_' + idx"
                    />
                  </label>
                  <label>
                    Writing
                    <input
                      type="number"
                      min="0"
                      max="9"
                      step="0.5"
                      [(ngModel)]="record.writing"
                      [name]="'writing_' + idx"
                    />
                  </label>
                  <label>
                    Speaking
                    <input
                      type="number"
                      min="0"
                      max="9"
                      step="0.5"
                      [(ngModel)]="record.speaking"
                      [name]="'speaking_' + idx"
                    />
                  </label>
                  <label>
                    Overall (auto)
                    <input type="text" [value]="displayOverall(record)" readonly />
                  </label>
                </div>

                <div class="record-badges" *ngIf="recordVm(record) as rowVm">
                  <span class="tag neutral" *ngIf="rowVm.isLatestRecord">Latest record</span>
                  <span class="tag valid" *ngIf="rowVm.isLatestValidRecord">Latest valid record</span>
                  <span class="tag warning" *ngIf="rowVm.validityStatus === 'EXPIRED'">Expired</span>
                  <span class="tag warning" *ngIf="rowVm.validityStatus === 'OUTSIDE_GRADUATION_WINDOW'">
                    Outside graduation window
                  </span>
                  <span class="tag warning" *ngIf="rowVm.validityStatus === 'INVALID_DATE'">Invalid date</span>
                  <span class="tag success" *ngIf="rowVm.thresholdMatch === 'STRICT_PASS'">
                    {{ ruleSet.labels.strictLineName }}
                  </span>
                  <span class="tag info" *ngIf="rowVm.thresholdMatch === 'COMMON_PASS'">
                    {{ ruleSet.labels.commonLineName }}
                  </span>
                  <span class="tag warning" *ngIf="rowVm.thresholdMatch === 'BELOW_COMMON'">Below common line</span>
                </div>
              </div>
            </div>

            <div *ngIf="hasTakenIeltsAcademic === false" class="prep-block">
              <label>Are you preparing for IELTS?</label>
              <div class="inline-options">
                <label>
                  <input
                    type="radio"
                    name="prepIntent"
                    [checked]="preparationIntent === 'PREPARING'"
                    (change)="setPreparationIntent('PREPARING')"
                  />
                  Yes
                </label>
                <label>
                  <input
                    type="radio"
                    name="prepIntent"
                    [checked]="preparationIntent === 'NOT_PREPARING'"
                    (change)="setPreparationIntent('NOT_PREPARING')"
                  />
                  No
                </label>
              </div>
            </div>

            <div class="actions">
              <button type="button" class="primary-btn" (click)="save()" [disabled]="saving">
                {{ saving ? '保存中...' : '保存雅思跟踪' }}
              </button>
            </div>
          </section>
        </ng-container>
      </div>
    </div>
  `,
  styleUrl: './ielts-tracking.component.scss',
})
export class IeltsTrackingComponent implements OnInit {
  readonly ruleSet = IELTS_TRACKING_RULESET_V1;

  managedMode = false;
  studentId = 0;

  loading = false;
  saving = false;
  error = '';
  savedMessage = '';
  forceShowModule = false;

  moduleState: StudentIeltsModuleState | null = null;
  hasTakenIeltsAcademic: boolean | null = null;
  preparationIntent: IeltsPreparationIntent = 'UNSET';
  records: IeltsRecordFormValue[] = [];

  private loadWatchdog: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    private ieltsApi: IeltsTrackingService,
    private cdr: ChangeDetectorRef = { detectChanges: () => {} } as ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.applyRouteContext(params);
    });
  }

  get derived(): DerivedStudentIeltsModuleState | null {
    if (!this.moduleState) return null;
    const effectiveRecords =
      this.hasTakenIeltsAcademic === true ? this.records.map((record) => this.normalizeRecord(record)) : [];

    return deriveStudentIeltsModuleState({
      ...this.moduleState,
      hasTakenIeltsAcademic: this.hasTakenIeltsAcademic,
      preparationIntent: this.hasTakenIeltsAcademic === false ? this.preparationIntent : 'UNSET',
      records: effectiveRecords,
    });
  }

  goBack(): void {
    if (this.managedMode) {
      this.router.navigate(['/teacher/dashboard']);
      return;
    }
    this.router.navigate(['/dashboard']);
  }

  setHasTakenIelts(value: boolean): void {
    this.hasTakenIeltsAcademic = value;
    this.savedMessage = '';
    if (value && this.records.length <= 0) {
      this.addRecord();
    }
    if (!value) {
      this.preparationIntent = this.preparationIntent === 'UNSET' ? 'PREPARING' : this.preparationIntent;
    }
  }

  setPreparationIntent(value: IeltsPreparationIntent): void {
    this.preparationIntent = value;
    this.savedMessage = '';
  }

  addRecord(): void {
    this.records = [
      ...this.records,
      {
        recordId: `local-${Date.now()}-${Math.trunc(Math.random() * 10000)}`,
        testDate: '',
        listening: null,
        reading: null,
        writing: null,
        speaking: null,
      },
    ];
  }

  removeRecord(index: number): void {
    this.records = this.records.filter((_item, idx) => idx !== index);
  }

  save(): void {
    if (!this.studentId) return;
    if (this.hasTakenIeltsAcademic === null) {
      this.error = 'Please select whether IELTS Academic has been taken.';
      return;
    }

    this.error = '';
    this.savedMessage = '';
    this.saving = true;

    if (this.hasTakenIeltsAcademic === true) {
      const payloadRecords = this.records.map((record) => this.normalizeRecord(record));
      const request$ = this.managedMode
        ? this.ieltsApi.updateTeacherStudentIeltsData(this.studentId, {
            hasTakenIeltsAcademic: true,
            preparationIntent: 'UNSET',
            records: payloadRecords,
          })
        : this.ieltsApi.saveStudentIeltsRecords(this.studentId, {
            hasTakenIeltsAcademic: true,
            records: payloadRecords,
          });

      request$
        .pipe(finalize(() => (this.saving = false)))
        .subscribe({
          next: (state) => {
            this.applyState(state);
            this.savedMessage = this.managedMode ? 'Teacher update saved.' : 'IELTS records saved.';
            this.cdr.detectChanges();
          },
          error: (error: unknown) => {
            this.error = this.extractErrorMessage(error, 'Failed to save IELTS records.');
            this.cdr.detectChanges();
          },
        });
      return;
    }

    if (this.preparationIntent === 'UNSET') {
      this.saving = false;
      this.error = 'Please select preparation intent.';
      return;
    }

    const request$ = this.managedMode
      ? this.ieltsApi.updateTeacherStudentIeltsData(this.studentId, {
          hasTakenIeltsAcademic: false,
          preparationIntent: this.preparationIntent,
          records: [],
        })
      : this.ieltsApi.saveStudentIeltsPreparationIntent(this.studentId, this.preparationIntent);

    request$
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (state) => {
          this.applyState(state);
          this.savedMessage = this.managedMode ? 'Teacher update saved.' : 'Preparation intent saved.';
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.error = this.extractErrorMessage(error, 'Failed to save preparation intent.');
          this.cdr.detectChanges();
        },
      });
  }

  trackRecord = (index: number, record: IeltsRecordFormValue): string => {
    return record.recordId || `record-${index + 1}`;
  };

  displayOverall(record: IeltsRecordFormValue): string {
    const overall = computeIeltsOverall(this.normalizeRecord(record));
    return overall === null ? '-' : overall.toFixed(1);
  }

  displayTrackingStatusLabel(status: IeltsTrackingStatus, shouldShowModule: boolean): string {
    if (!shouldShowModule) return '无需雅思';
    if (status === 'GREEN_STRICT_PASS') return '以满足雅思';
    if (status === 'GREEN_COMMON_PASS_WITH_WARNING') return '以满足雅思(大部分本科)';
    return '可能需要雅思';
  }

  recordVm(record: IeltsRecordFormValue) {
    const current = this.derived;
    if (!current) return null;
    const recordId = record.recordId || '';
    return current.records.find((row) => row.recordId === recordId) || null;
  }

  private loadState(): void {
    if (!this.studentId) return;
    this.loading = true;
    this.error = '';
    this.savedMessage = '';
    this.startLoadWatchdog();
    this.cdr.detectChanges();

    const request$ = this.managedMode
      ? this.ieltsApi.getTeacherStudentIeltsModuleState(this.studentId)
      : this.ieltsApi.getStudentIeltsModuleState(this.studentId);

    request$
      .pipe(
        finalize(() => {
          this.loading = false;
          this.clearLoadWatchdog();
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (state) => {
          this.applyState(state);
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.error = this.extractErrorMessage(error, '加载雅思跟踪模块失败。');
          this.cdr.detectChanges();
        },
      });
  }

  private applyState(state: StudentIeltsModuleState): void {
    const normalizedRecords = Array.isArray(state.records) ? state.records : [];
    this.moduleState = {
      ...state,
      records: normalizedRecords.map((record) => this.normalizeRecord(record)),
    };
    this.hasTakenIeltsAcademic = state.hasTakenIeltsAcademic;
    this.preparationIntent = state.preparationIntent || 'UNSET';
    this.records = normalizedRecords.map((record, index) => ({
      ...this.normalizeRecord(record),
      recordId: record.recordId || `record-${index + 1}`,
    }));
  }

  private applyRouteContext(params: ParamMap): void {
    const forceText = String(this.route.snapshot.queryParamMap.get('forceShowIelts') || '')
      .trim()
      .toLowerCase();
    this.forceShowModule = forceText === '1' || forceText === 'true' || forceText === 'yes';

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

  private normalizeRecord(record: IeltsRecordFormValue): IeltsRecordFormValue {
    return {
      recordId: String(record.recordId || '').trim(),
      testDate: String(record.testDate || '').trim(),
      listening: this.toBandScore(record.listening),
      reading: this.toBandScore(record.reading),
      writing: this.toBandScore(record.writing),
      speaking: this.toBandScore(record.speaking),
    };
  }

  private toBandScore(value: number | null): number | null {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 9) return null;
    return Number(parsed.toFixed(1));
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

  private startLoadWatchdog(): void {
    this.clearLoadWatchdog();
    this.loadWatchdog = window.setTimeout(() => {
      if (!this.loading) return;
      this.loading = false;
      if (!this.error) {
        this.error = 'Request timed out while loading IELTS module.';
      }
      this.cdr.detectChanges();
    }, 15000);
  }

  private clearLoadWatchdog(): void {
    if (this.loadWatchdog === null) return;
    window.clearTimeout(this.loadWatchdog);
    this.loadWatchdog = null;
  }
}
