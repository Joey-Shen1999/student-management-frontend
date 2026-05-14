import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';

import {
  GraduationApplication,
  GraduationApplicationHistoryEntry,
  GraduationApplicationHistoryFieldChange,
  GraduationApplicationStageService,
  GraduationApplicationStatus,
} from '../../services/graduation-application-stage.service';

interface ApplicationGroup {
  universityName: string;
  applications: GraduationApplication[];
}

@Component({
  selector: 'app-graduation-applications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './graduation-applications.component.html',
  styleUrl: './graduation-applications.component.scss',
})
export class GraduationApplicationsComponent implements OnInit {
  readonly statusOptions: GraduationApplicationStatus[] = [
    'PREPARING',
    'READY_TO_SUBMIT',
    'SUBMITTED',
    'WAITING_RESULT',
    'OFFER_RECEIVED',
  ];
  readonly historyPageSize = 20;

  studentId = 0;
  loading = false;
  error = '';
  applications: GraduationApplication[] = [];
  updatingId: string | number | null = null;

  historyPanelOpen = false;
  historyLoading = false;
  historyError = '';
  historyEntries: GraduationApplicationHistoryEntry[] = [];
  historyTotal = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public graduationStage: GraduationApplicationStageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.resolveContext();
    this.loadApplications();
  }

  get groups(): ApplicationGroup[] {
    const groups = new Map<string, GraduationApplication[]>();
    for (const application of this.sortedApplications) {
      const universityName = application.universityName?.trim() || '未命名大学';
      groups.set(universityName, [...(groups.get(universityName) || []), application]);
    }
    return Array.from(groups.entries()).map(([universityName, applications]) => ({
      universityName,
      applications,
    }));
  }

  get sortedApplications(): GraduationApplication[] {
    return [...this.applications].sort((left, right) => left.sortOrder - right.sortOrder);
  }

  get totalCount(): number {
    return this.applications.length;
  }

  get submittedCount(): number {
    return this.applications.filter((item) =>
      ['SUBMITTED', 'WAITING_RESULT', 'OFFER_RECEIVED'].includes(item.status)
    ).length;
  }

  get offerCount(): number {
    return this.applications.filter((item) => item.status === 'OFFER_RECEIVED').length;
  }

  get pageTitle(): string {
    return '学生正式申请';
  }

  goBack(): void {
    this.router.navigate(['/teacher/graduation']);
  }

  loadApplications(): void {
    if (this.studentId <= 0) {
      this.error = '缺少学生 ID';
      return;
    }

    this.loading = true;
    this.error = '';
    this.graduationStage
      .listApplications(this.studentId)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (rows) => {
          this.applications = rows || [];
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.error = this.extractErrorMessage(error) || '读取申请进度失败。';
          this.applications = [];
          this.cdr.markForCheck();
        },
      });
  }

  openHistory(): void {
    this.historyPanelOpen = true;
    this.loadHistory();
  }

  closeHistory(): void {
    this.historyPanelOpen = false;
    this.historyError = '';
  }

  refreshHistory(): void {
    if (this.historyLoading) return;
    this.loadHistory();
  }

  updateStatus(application: GraduationApplication, status: GraduationApplicationStatus): void {
    if (this.updatingId !== null || application.status === status) return;

    const applicationId = Number(application.id);
    const nextApplication = {
      ...application,
      status,
      updatedAt: new Date().toISOString(),
    };

    if (!Number.isFinite(applicationId) || applicationId <= 0) {
      this.replaceApplication(nextApplication);
      return;
    }

    this.updatingId = application.id;
    this.error = '';
    this.graduationStage
      .updateApplication(applicationId, {
        universityId: Number(application.universityId),
        programId: Number(application.programId),
        status,
        sourceAspirationId: application.sourceAspirationId,
      })
      .pipe(
        finalize(() => {
          this.updatingId = null;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (saved) => {
          this.replaceApplication({ ...application, ...saved, status });
          if (this.historyPanelOpen) {
            this.loadHistory();
          }
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.error = this.extractErrorMessage(error) || '更新申请进度失败。';
          this.cdr.markForCheck();
        },
      });
  }

  trackGroup(_index: number, group: ApplicationGroup): string {
    return group.universityName;
  }

  trackApplication(_index: number, application: GraduationApplication): string | number {
    return application.id;
  }

  trackHistory(_index: number, entry: GraduationApplicationHistoryEntry): string | number {
    return entry.id || `${entry.operation || 'history'}-${entry.changedAt || _index}`;
  }

  trackHistoryChange(_index: number, change: GraduationApplicationHistoryFieldChange): string {
    return `${change.path || change.label || 'change'}-${_index}`;
  }

  displayUpdatedAt(value: string | undefined): string {
    return this.displayDateTime(value);
  }

  displayHistoryTimestamp(entry: GraduationApplicationHistoryEntry): string {
    return this.displayDateTime(entry.changedAt);
  }

  displayHistoryActor(entry: GraduationApplicationHistoryEntry): string {
    const role = this.displayActorRole(entry.actorRole);
    const name = String(entry.actorName || '').trim();
    if (role && name) return `${role} · ${name}`;
    return name || role || '系统';
  }

  displayHistoryOperation(entry: GraduationApplicationHistoryEntry): string {
    switch (entry.operation) {
      case 'ENTER_GRADUATION_STAGE':
        return '进入升学阶段';
      case 'CONFIRM_STAGE':
        return '确认正式申请';
      case 'CREATE_APPLICATION':
        return '新增申请';
      case 'UPDATE_APPLICATION':
        return '修改申请';
      case 'DELETE_APPLICATION':
        return '删除申请';
      case 'REORDER_APPLICATIONS':
        return '调整顺序';
      default:
        return String(entry.operation || '操作记录');
    }
  }

  getHistoryChanges(entry: GraduationApplicationHistoryEntry): GraduationApplicationHistoryFieldChange[] {
    return Array.isArray(entry.changedFields) ? entry.changedFields : [];
  }

  displayHistoryField(change: GraduationApplicationHistoryFieldChange): string {
    const label = String(change.label || '').trim();
    if (label) return label;

    switch (change.path) {
      case 'graduationStage':
        return '升学阶段';
      case 'application':
        return '申请';
      case 'applicationOrder':
        return '申请顺序';
      case 'status':
        return '申请进度';
      case 'universityId':
      case 'universityName':
        return '大学';
      case 'programId':
      case 'programName':
        return '专业';
      default:
        return String(change.path || '字段');
    }
  }

  displayHistoryValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '空';
    if (typeof value === 'boolean') return value ? '是' : '否';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') {
      return this.displayStatusCode(value) || value;
    }
    if (Array.isArray(value)) {
      const labels = value
        .map((item) => this.summarizeHistoryObject(item))
        .filter((item) => item.length > 0);
      return labels.length > 0 ? labels.join('；') : `${value.length} 项`;
    }
    if (typeof value === 'object') {
      return this.summarizeHistoryObject(value) || JSON.stringify(value);
    }
    return String(value);
  }

  private loadHistory(): void {
    if (this.studentId <= 0) {
      this.historyError = '缺少学生 ID';
      this.historyEntries = [];
      this.historyTotal = 0;
      return;
    }

    this.historyLoading = true;
    this.historyError = '';
    this.graduationStage
      .listHistory(this.studentId, { size: this.historyPageSize })
      .pipe(
        finalize(() => {
          this.historyLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (response) => {
          this.historyEntries = response?.items || [];
          this.historyTotal = Number(response?.total || this.historyEntries.length);
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.historyEntries = [];
          this.historyTotal = 0;
          this.historyError = this.extractErrorMessage(error) || '读取操作记录失败。';
          this.cdr.markForCheck();
        },
      });
  }

  private replaceApplication(nextApplication: GraduationApplication): void {
    this.applications = this.applications.map((item) =>
      String(item.id) === String(nextApplication.id) ? nextApplication : item
    );
    this.cdr.markForCheck();
  }

  private resolveContext(): void {
    const routeStudentId = Math.trunc(Number(this.route.snapshot.paramMap.get('studentId')));
    this.studentId = Number.isFinite(routeStudentId) && routeStudentId > 0 ? routeStudentId : 0;
  }

  private displayDateTime(value: string | undefined): string {
    const timestamp = Date.parse(String(value || ''));
    if (!Number.isFinite(timestamp)) return '-';
    return new Date(timestamp).toLocaleString();
  }

  private displayActorRole(role: string | undefined): string {
    switch (String(role || '').toUpperCase()) {
      case 'ADMIN':
        return '管理员';
      case 'TEACHER':
        return '老师';
      case 'STUDENT':
        return '学生';
      default:
        return '';
    }
  }

  private displayStatusCode(status: string): string {
    if (this.statusOptions.includes(status as GraduationApplicationStatus)) {
      return this.graduationStage.statusLabel(status);
    }
    return '';
  }

  private summarizeHistoryObject(value: unknown): string {
    if (!value || typeof value !== 'object') return '';
    const source = value as Record<string, unknown>;
    const university = String(source['universityName'] || '').trim();
    const program = String(source['programName'] || '').trim();
    const status = this.displayStatusCode(String(source['status'] || '').trim());
    const order = Number(source['sortOrder']);
    const parts = [university, program, status].filter((item) => item.length > 0);
    const label = parts.join(' / ');
    if (label && Number.isFinite(order) && order > 0) return `${order}. ${label}`;
    return label;
  }

  private extractErrorMessage(error: unknown): string {
    if (typeof error === 'string') return error;
    if (!error || typeof error !== 'object') return '';
    const source = error as { error?: unknown; message?: unknown };
    if (source.error && typeof source.error === 'object') {
      const nested = source.error as { message?: unknown; error?: unknown };
      return String(nested.message || nested.error || '').trim();
    }
    return String(source.message || source.error || '').trim();
  }
}
