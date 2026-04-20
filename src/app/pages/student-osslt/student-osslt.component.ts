import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { deriveStudentOssltSummary } from '../../features/osslt/osslt-derive';
import { resolveOssltStatusDisplay } from '../../features/osslt/osslt-status-display';
import {
  OssltResult,
  StudentOssltModuleState,
  UpdateStudentOssltPayload,
} from '../../features/osslt/osslt-types';
import { OssltTrackingService } from '../../services/osslt-tracking.service';

@Component({
  selector: 'app-student-osslt',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="student-osslt-page">
      <div class="student-osslt-shell">
        <div class="header-row">
          <div>
            <h2>OSSLT 信息登记</h2>
            <p class="sub-title">仅填写：OSSLT 结果（仅当未通过时需填写 OSSLC）</p>
          </div>
          <button type="button" class="ghost-btn" (click)="goBack()">返回</button>
        </div>

        <div *ngIf="loading" class="state-text">正在加载 OSSLT 信息...</div>
        <div *ngIf="error" class="error-banner">{{ error }}</div>
        <div *ngIf="savedMessage" class="success-banner">{{ savedMessage }}</div>

        <ng-container *ngIf="!loading && !error && moduleState">
          <section class="card">
            <h3>当前状态</h3>
            <ng-container *ngIf="resolveStatusDisplay() as statusDisplay">
              <div
                class="status-pill"
                [style.background]="statusDisplay.background"
                [style.color]="statusDisplay.textColor"
                [style.borderColor]="statusDisplay.borderColor"
              >
                {{ statusDisplay.label }}
              </div>
            </ng-container>
            <div class="summary-grid">
              <div><b>毕业年份：</b>{{ moduleState.graduationYear || '-' }}</div>
              <ng-container *ngIf="moduleState.osslcCourseStatus">
                <div><b>OSSLC 课程状态：</b>{{ resolveOsslcStatusLabel(moduleState.osslcCourseStatus) }}</div>
              </ng-container>
              <ng-container *ngIf="moduleState.osslcCourseLocation">
                <div><b>OSSLC 在哪里上：</b>{{ moduleState.osslcCourseLocation }}</div>
              </ng-container>
            </div>
          </section>

          <section class="card">
            <h3>学生填写</h3>

            <div class="field-row">
              <label>OSSLT 结果</label>
              <select
                class="field-input"
                [ngModel]="resultInput"
                (ngModelChange)="setResult($event)"
                name="ossltResult"
              >
                <option [ngValue]="''">请选择</option>
                <option [ngValue]="'PASS'">通过</option>
                <option [ngValue]="'FAIL'">未通过</option>
              </select>
            </div>

            <div class="field-row" *ngIf="shouldShowOsslcField()">
              <label>OSSLC 状态</label>
              <select
                class="field-input"
                [ngModel]="osslcInput"
                (ngModelChange)="setOsslc($event)"
                name="osslcStatus"
              >
                <option [ngValue]="''">请选择</option>
                <option [ngValue]="'YES'">已上</option>
                <option [ngValue]="'NO'">未上</option>
              </select>
            </div>

            <div class="actions">
              <button
                type="button"
                class="primary-btn"
                (click)="save()"
                [disabled]="saving || !isFormReady()"
              >
                {{ saving ? '提交中...' : '保存 OSSLT 信息' }}
              </button>
            </div>
          </section>
        </ng-container>
      </div>
    </div>
  `,
  styleUrl: './student-osslt.component.scss',
})
export class StudentOssltComponent implements OnInit {
  loading = false;
  saving = false;
  error = '';
  savedMessage = '';

  moduleState: StudentOssltModuleState | null = null;
  resultInput: '' | 'PASS' | 'FAIL' = '';
  osslcInput: '' | 'YES' | 'NO' = '';

  constructor(
    private router: Router,
    private ossltApi: OssltTrackingService,
    private cdr: ChangeDetectorRef = { detectChanges: () => {} } as ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadState();
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  resolveOsslcStatusLabel(status: string | null): string {
    if (status === 'NOT_PLANNING') return '不打算上';
    if (status === 'IN_PROGRESS') return '在上';
    if (status === 'NOT_ENROLLED') return '还没报名';
    return '-';
  }

  setResult(value: '' | 'PASS' | 'FAIL'): void {
    this.resultInput = value === 'PASS' || value === 'FAIL' ? value : '';
    if (this.resultInput !== 'FAIL') {
      this.osslcInput = '';
    }
    this.savedMessage = '';
  }

  setOsslc(value: '' | 'YES' | 'NO'): void {
    this.osslcInput = value === 'YES' || value === 'NO' ? value : '';
    this.savedMessage = '';
  }

  shouldShowOsslcField(): boolean {
    return this.resultInput === 'FAIL';
  }

  isFormReady(): boolean {
    if (this.resultInput === 'PASS') {
      return true;
    }
    if (this.resultInput === 'FAIL') {
      return this.osslcInput === 'YES' || this.osslcInput === 'NO';
    }
    return false;
  }

  resolveStatusDisplay() {
    if (!this.moduleState) {
      return resolveOssltStatusDisplay({ isUnavailable: true });
    }
    const preview = deriveStudentOssltSummary({
      ...this.moduleState,
      latestOssltResult: this.resolveResultForPreview(),
      hasOsslc: this.resolveOsslcForPreview(),
    });
    return resolveOssltStatusDisplay({ status: preview.trackingStatus });
  }

  save(): void {
    if (!this.isFormReady()) {
      this.error =
        this.resultInput === 'FAIL' ? '请先填写 OSSLC 状态。' : '请先选择 OSSLT 结果。';
      return;
    }

    this.saving = true;
    this.error = '';
    this.savedMessage = '';
    this.cdr.detectChanges();

    const payload: UpdateStudentOssltPayload = {
      latestOssltResult: this.resultInput as OssltResult,
    };
    if (this.resultInput === 'FAIL') {
      payload.hasOsslc = this.osslcInput === 'YES';
    }

    this.ossltApi
      .updateStudentOssltData(payload)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (state) => {
          this.applyState(state);
          this.savedMessage = 'OSSLT 信息已保存。';
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.error = this.extractErrorMessage(error, '保存失败，请稍后重试。');
          this.cdr.detectChanges();
        },
      });
  }

  private loadState(): void {
    this.loading = true;
    this.error = '';
    this.savedMessage = '';
    this.cdr.detectChanges();

    this.ossltApi
      .getStudentOssltModuleState()
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
    this.resultInput = state.latestOssltResult === 'PASS' || state.latestOssltResult === 'FAIL' ? state.latestOssltResult : '';
    this.osslcInput =
      this.resultInput === 'FAIL'
        ? state.hasOsslc === true
          ? 'YES'
          : state.hasOsslc === false
            ? 'NO'
            : ''
        : '';
  }

  private resolveResultForPreview(): OssltResult {
    if (this.resultInput === 'PASS' || this.resultInput === 'FAIL') return this.resultInput;
    return this.moduleState?.latestOssltResult ?? 'UNKNOWN';
  }

  private resolveOsslcForPreview(): boolean | null {
    if (this.osslcInput === 'YES') return true;
    if (this.osslcInput === 'NO') return false;
    return this.moduleState?.hasOsslc ?? null;
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    if (!error || typeof error !== 'object') return fallback;
    const obj = error as {
      name?: unknown;
      status?: unknown;
      message?: unknown;
      error?: unknown;
    };

    if (String(obj.name || '').trim().toLowerCase() === 'timeouterror') {
      return '请求超时，请稍后重试。';
    }

    if (obj.error && typeof obj.error === 'object') {
      const payload = obj.error as { message?: unknown; error?: unknown; details?: unknown };
      const text = String(payload.message || payload.error || '').trim();
      if (text) return text;
      if (Array.isArray(payload.details) && payload.details.length > 0) {
        const first = String(payload.details[0] ?? '').trim();
        if (first) return first;
      }
    }

    const direct = String(obj.message || '').trim();
    if (direct) return direct;

    const status = Number(obj.status);
    if (Number.isFinite(status) && status > 0) {
      return `请求失败（HTTP ${status}）。`;
    }
    return fallback;
  }
}
