import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { deriveOssltTrackingStatus, deriveStudentOssltSummary } from '../../features/osslt/osslt-derive';
import { resolveOssltStatusDisplay } from '../../features/osslt/osslt-status-display';
import {
  OssltSummaryViewModel,
  OssltTrackingStatus,
  StudentOssltModuleState,
} from '../../features/osslt/osslt-types';
import { OssltTrackingService } from '../../services/osslt-tracking.service';

@Component({
  selector: 'app-osslt-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="osslt-page">
      <div class="osslt-shell">
        <div class="header-row">
          <div>
            <h2>OSSLT 跟踪</h2>
            <p class="sub-title">老师模式 - 学生 #{{ studentId || '-' }}</p>
          </div>
          <button type="button" class="ghost-btn" (click)="goBack()">返回</button>
        </div>

        <div *ngIf="loading" class="state-text">加载 OSSLT 模块中...</div>
        <div *ngIf="error" class="error-banner">{{ error }}</div>
        <div *ngIf="savedMessage" class="success-banner">{{ savedMessage }}</div>

        <ng-container *ngIf="!loading && !error && moduleState && summary as vm">
          <section class="card">
            <h3>当前状态</h3>
            <ng-container *ngIf="resolveSummaryStatusDisplay(vm.trackingStatus) as statusDisplay">
              <div
                class="status-pill"
                [style.background]="statusDisplay.background"
                [style.color]="statusDisplay.textColor"
                [style.borderColor]="statusDisplay.borderColor"
              >
                {{ statusDisplay.label }}
              </div>
            </ng-container>
            <div class="summary-title">{{ vm.trackingTitle }}</div>
            <p class="summary-text">{{ vm.trackingMessage }}</p>

            <div class="summary-grid">
              <div><b>Graduation Year:</b> {{ vm.graduationYear || '-' }}</div>
            </div>
          </section>

          <section class="card">
            <h3>老师跟进</h3>

            <div class="field-row">
              <label>OSSLT 跟进状态</label>
              <select
                class="field-input"
                [ngModel]="trackingStatus"
                (ngModelChange)="setTrackingStatus($event)"
                name="ossltTrackingStatus"
              >
                <option *ngFor="let status of trackingStatusOptions" [ngValue]="status">
                  {{ resolveStatusLabel(status) }}
                </option>
              </select>
            </div>

            <div class="actions">
              <button type="button" class="primary-btn" (click)="save()" [disabled]="saving || !studentId">
                {{ saving ? '保存中...' : '保存 OSSLT 跟进' }}
              </button>
            </div>
          </section>
        </ng-container>
      </div>
    </div>
  `,
  styleUrl: './osslt-tracking.component.scss',
})
export class OssltTrackingComponent implements OnInit {
  readonly trackingStatusOptions: readonly OssltTrackingStatus[] = [
    'WAITING_UPDATE',
    'NEEDS_TRACKING',
    'PASSED',
  ];

  studentId = 0;
  loading = false;
  saving = false;
  error = '';
  savedMessage = '';

  moduleState: StudentOssltModuleState | null = null;
  trackingStatus: OssltTrackingStatus = 'WAITING_UPDATE';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ossltApi: OssltTrackingService,
    private cdr: ChangeDetectorRef = { detectChanges: () => {} } as ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.applyRouteContext(params);
    });
  }

  get summary(): OssltSummaryViewModel | null {
    if (!this.moduleState) return null;
    return deriveStudentOssltSummary({
      ...this.moduleState,
      ossltTrackingManualStatus: this.trackingStatus,
    });
  }

  goBack(): void {
    this.router.navigate(['/teacher/osslt']);
  }

  setTrackingStatus(value: OssltTrackingStatus): void {
    if (value !== 'WAITING_UPDATE' && value !== 'NEEDS_TRACKING' && value !== 'PASSED') {
      return;
    }
    this.trackingStatus = value;
    this.savedMessage = '';
  }

  resolveSummaryStatusDisplay(status: OssltTrackingStatus) {
    return resolveOssltStatusDisplay({ status });
  }

  resolveStatusLabel(status: OssltTrackingStatus): string {
    return resolveOssltStatusDisplay({ status }).label;
  }

  save(): void {
    if (!this.studentId) return;

    this.error = '';
    this.savedMessage = '';
    this.saving = true;

    this.ossltApi
      .updateTeacherStudentOssltData(this.studentId, {
        ossltTrackingManualStatus: this.trackingStatus,
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (state) => {
          this.applyState(state);
          this.savedMessage = 'OSSLT 跟进已更新。';
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.error = this.extractErrorMessage(error, '保存 OSSLT 跟进失败。');
          this.cdr.detectChanges();
        },
      });
  }

  private applyRouteContext(params: ParamMap): void {
    const routeStudentId = params.get('studentId');
    const parsed = Number(routeStudentId);
    if (!routeStudentId || !Number.isFinite(parsed) || parsed <= 0) {
      this.loading = false;
      this.error = '路由中的学生 ID 无效。';
      this.studentId = 0;
      this.cdr.detectChanges();
      return;
    }
    this.studentId = Math.trunc(parsed);
    this.loadState();
  }

  private loadState(): void {
    if (!this.studentId) return;
    this.loading = true;
    this.error = '';
    this.savedMessage = '';
    this.cdr.detectChanges();

    this.ossltApi
      .getTeacherStudentOssltModuleState(this.studentId)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (state) => {
          this.applyState(state);
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.error = this.extractErrorMessage(error, '加载 OSSLT 信息失败。');
          this.cdr.detectChanges();
        },
      });
  }

  private applyState(state: StudentOssltModuleState): void {
    this.moduleState = { ...state };
    this.trackingStatus =
      state.ossltTrackingManualStatus ??
      state.ossltTrackingStatus ??
      deriveOssltTrackingStatus(null, state.latestOssltResult, state.hasOsslc);
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    if (!error || typeof error !== 'object') return fallback;

    const obj = error as {
      name?: unknown;
      status?: unknown;
      message?: unknown;
      error?: unknown;
    };

    const timeoutName = String(obj.name || '').trim().toLowerCase();
    if (timeoutName === 'timeouterror') return '请求超时，请重试。';

    const payloadError = obj.error;
    if (typeof payloadError === 'string' && payloadError.trim()) return payloadError.trim();
    if (payloadError && typeof payloadError === 'object') {
      const payload = payloadError as { message?: unknown; error?: unknown };
      const msg = String(payload.message || payload.error || '').trim();
      if (msg) return msg;
    }

    const message = String(obj.message || '').trim();
    if (message) return message;

    const status = Number(obj.status);
    if (Number.isFinite(status) && status > 0) {
      return `请求失败（HTTP ${status}）。`;
    }
    return fallback;
  }
}
