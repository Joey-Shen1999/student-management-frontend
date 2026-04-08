import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';

import { type InfoTaskVm, TaskCenterService } from '../../services/task-center.service';
import {
  type VolunteerTrackingStateVm,
  VolunteerTrackingService,
} from '../../services/volunteer-tracking.service';

interface VolunteerTaskVm {
  taskName: string;
  description: string;
  durationHours: number;
  startDate: string;
  endDate: string;
  verifierContact: string;
}

interface VolunteerRecordVm {
  id: number;
  title: string;
  note: string;
  totalHours: number;
  tasks: VolunteerTaskVm[];
  teacherName: string;
  createdAt: string;
  rawContent: string;
}

const VOLUNTEER_TOTAL_HOURS_PREFIX = '义工总时长：';
const VOLUNTEER_TASK_COLLECTION_PREFIX = '义工任务明细：';

@Component({
  selector: 'app-student-volunteer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="volunteer-page">
      <div class="volunteer-shell">
        <div class="header-row">
          <div>
            <h2>义工记录</h2>
            <p class="sub-title">查看义工任务明细与累计时长</p>
          </div>
          <div class="header-actions">
            <button type="button" class="ghost-btn" (click)="refresh()" [disabled]="loading">刷新</button>
            <button type="button" class="ghost-btn" (click)="goBack()">返回</button>
          </div>
        </div>

        <section class="summary-card">
          <span class="summary-label">累计义工时长</span>
          <strong class="summary-value">{{ totalVolunteerHoursLabel }} 小时</strong>
        </section>

        <div *ngIf="loading" class="state-text">正在加载义工记录...</div>
        <div *ngIf="!loading && error" class="error-banner">{{ error }}</div>
        <div *ngIf="!loading && !error && records.length === 0" class="state-text">暂无义工记录。</div>

        <div *ngIf="!loading && !error && records.length > 0" class="record-list">
          <article class="record-card" *ngFor="let record of records; trackBy: trackRecord">
            <div class="record-head">
              <h3>{{ record.title }}</h3>
              <span class="record-hours">{{ formatHours(record.totalHours) }} 小时</span>
            </div>

            <p *ngIf="record.note" class="record-note">{{ record.note }}</p>

            <div class="record-meta">
              <span>发布时间：{{ displayDateTime(record.createdAt) }}</span>
              <span>发布老师：{{ record.teacherName || '-' }}</span>
              <span>任务数：{{ record.tasks.length }}</span>
            </div>

            <div *ngIf="record.tasks.length > 0" class="task-table-wrap">
              <table class="task-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>任务名称</th>
                    <th>任务描述</th>
                    <th>时长</th>
                    <th>开始日期</th>
                    <th>结束日期</th>
                    <th>证明人联系方式</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let task of record.tasks; let index = index; trackBy: trackTask">
                    <td>{{ index + 1 }}</td>
                    <td>{{ task.taskName }}</td>
                    <td>{{ task.description }}</td>
                    <td>{{ formatHours(task.durationHours) }} 小时</td>
                    <td>{{ task.startDate }}</td>
                    <td>{{ task.endDate }}</td>
                    <td>{{ task.verifierContact }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p *ngIf="record.tasks.length === 0" class="record-note">
              {{ record.rawContent || '未提供义工任务明细。' }}
            </p>
          </article>
        </div>
      </div>
    </div>
  `,
  styleUrl: './student-volunteer.component.scss',
})
export class StudentVolunteerComponent implements OnInit {
  loading = false;
  error = '';
  records: VolunteerRecordVm[] = [];

  constructor(
    private router: Router,
    private volunteerTracking: VolunteerTrackingService,
    private taskCenter: TaskCenterService,
    private cdr: ChangeDetectorRef = { detectChanges: () => {} } as ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadVolunteerRecords();
  }

  get totalVolunteerHours(): number {
    return this.records.reduce((sum, record) => sum + record.totalHours, 0);
  }

  get totalVolunteerHoursLabel(): string {
    return this.formatHours(this.totalVolunteerHours);
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  refresh(): void {
    this.loadVolunteerRecords();
  }

  trackRecord = (_index: number, record: VolunteerRecordVm): number => record.id;
  trackTask = (index: number): number => index;

  displayDateTime(value: string): string {
    const timestamp = Date.parse(String(value || ''));
    if (!Number.isFinite(timestamp)) return value || '-';
    return new Date(timestamp).toLocaleString();
  }

  formatHours(hours: number): string {
    const normalized = Math.round(Number(hours || 0) * 100) / 100;
    if (!Number.isFinite(normalized) || normalized <= 0) return '0';
    return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(2);
  }

  private loadVolunteerRecords(): void {
    this.loading = true;
    this.error = '';
    this.cdr.detectChanges();

    this.fetchVolunteerRecords()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (records) => {
          this.records = records;
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.records = [];
          this.error = this.extractErrorMessage(error) || '加载义工记录失败。';
          this.cdr.detectChanges();
        },
      });
  }

  private fetchVolunteerRecords(): Observable<VolunteerRecordVm[]> {
    return this.volunteerTracking.getMyVolunteerTracking().pipe(
      map((state) => this.mapTrackingStateToRecords(state)),
      catchError((error: unknown) => this.tryLoadVolunteerRecordsLegacy(error))
    );
  }

  private mapTrackingStateToRecords(state: VolunteerTrackingStateVm): VolunteerRecordVm[] {
    return (state.records || [])
      .map((record, index) => ({
        id: Number.isFinite(Number(record.id)) && Number(record.id) > 0 ? Math.trunc(Number(record.id)) : index + 1,
        title: String(record.title || '').trim() || '义工记录',
        note: String(record.note || '').trim(),
        totalHours: this.parseHours(record.totalHours),
        tasks: (record.tasks || []).map((task) => ({
          taskName: String(task.taskName || '').trim(),
          description: String(task.description || '').trim(),
          durationHours: this.parseHours(task.durationHours),
          startDate: String(task.startDate || '').trim(),
          endDate: String(task.endDate || '').trim(),
          verifierContact: String(task.verifierContact || '').trim(),
        })),
        teacherName: String(record.updatedByTeacherName || '').trim(),
        createdAt: String(record.updatedAt || record.createdAt || ''),
        rawContent: '',
      }))
      .sort((a, b) => Date.parse(String(b.createdAt || '')) - Date.parse(String(a.createdAt || '')));
  }

  private tryLoadVolunteerRecordsLegacy(error: unknown): Observable<VolunteerRecordVm[]> {
    if (!this.shouldFallbackToLegacy(error)) {
      return throwError(() => error);
    }

    return this.taskCenter
      .listMyInfos({
        category: 'VOLUNTEER',
        page: 1,
        size: 100,
      })
      .pipe(map((resp) => (resp.items || []).map((info) => this.mapInfoToVolunteerRecord(info))));
  }

  private mapInfoToVolunteerRecord(info: InfoTaskVm): VolunteerRecordVm {
    const parsed = this.parseVolunteerContent(info.content);
    return {
      id: info.id,
      title: info.title,
      note: parsed.note,
      totalHours: parsed.totalHours,
      tasks: parsed.tasks,
      teacherName: info.publishedByTeacherName || '',
      createdAt: info.createdAt,
      rawContent: info.content || '',
    };
  }

  private parseVolunteerContent(content: string): {
    note: string;
    totalHours: number;
    tasks: VolunteerTaskVm[];
  } {
    const rawContent = String(content || '').trim();
    if (!rawContent) {
      return { note: '', totalHours: 0, tasks: [] };
    }

    const detailHeaderIndex = rawContent.indexOf(VOLUNTEER_TASK_COLLECTION_PREFIX);
    if (detailHeaderIndex < 0) {
      return {
        note: rawContent,
        totalHours: this.extractTotalHours(rawContent),
        tasks: [],
      };
    }

    const totalHeaderIndex = rawContent.indexOf(VOLUNTEER_TOTAL_HOURS_PREFIX);
    const noteEndIndex = totalHeaderIndex >= 0 ? totalHeaderIndex : detailHeaderIndex;
    const note = rawContent.slice(0, noteEndIndex).trim();
    const detailBlock = rawContent
      .slice(detailHeaderIndex + VOLUNTEER_TASK_COLLECTION_PREFIX.length)
      .trim();
    const tasks = this.parseTaskItems(detailBlock);
    const parsedTotal = this.extractTotalHours(rawContent);
    const sumTotal = tasks.reduce((sum, task) => sum + task.durationHours, 0);

    return {
      note,
      totalHours: parsedTotal > 0 ? parsedTotal : sumTotal,
      tasks,
    };
  }

  private extractTotalHours(content: string): number {
    const matched = String(content || '').match(/义工总时长：\s*([0-9]+(?:\.[0-9]+)?)\s*小时/);
    if (!matched) return 0;
    return this.parseHours(matched[1]);
  }

  private parseTaskItems(detailBlock: string): VolunteerTaskVm[] {
    if (!detailBlock) return [];
    const pattern =
      /(?:^|\n)\s*\d+\.\s*任务名称：([^\n]*)\n\s*任务描述：([^\n]*)\n\s*任务时长：([0-9]+(?:\.[0-9]+)?)\s*小时\n\s*开始日期：([0-9]{4}-[0-9]{2}-[0-9]{2})\n\s*结束日期：([0-9]{4}-[0-9]{2}-[0-9]{2})\n\s*证明人联系方式：([^\n]*)/g;

    const tasks: VolunteerTaskVm[] = [];
    let matched: RegExpExecArray | null = pattern.exec(detailBlock);
    while (matched) {
      tasks.push({
        taskName: String(matched[1] || '').trim(),
        description: String(matched[2] || '').trim(),
        durationHours: this.parseHours(matched[3]),
        startDate: String(matched[4] || '').trim(),
        endDate: String(matched[5] || '').trim(),
        verifierContact: String(matched[6] || '').trim(),
      });
      matched = pattern.exec(detailBlock);
    }
    return tasks;
  }

  private parseHours(value: unknown): number {
    const parsed = Number(String(value ?? '').trim());
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.round(parsed * 100) / 100;
  }

  private shouldFallbackToLegacy(error: unknown): boolean {
    const status = this.resolveHttpStatus(error);
    return status === 404 || status === 405 || status === 501;
  }

  private resolveHttpStatus(error: unknown): number {
    if (!error || typeof error !== 'object') return 0;
    const status = Number((error as { status?: unknown }).status);
    if (!Number.isFinite(status) || status <= 0) return 0;
    return Math.trunc(status);
  }

  private extractErrorMessage(error: unknown): string {
    if (typeof error === 'string') return error;
    if (!error || typeof error !== 'object') return '';

    const maybeTimeout = String((error as { name?: unknown }).name || '')
      .trim()
      .toLowerCase();
    if (maybeTimeout === 'timeouterror') {
      return '请求超时，请检查后端服务或网络连接。';
    }

    const obj = error as {
      message?: unknown;
      error?: unknown;
      status?: unknown;
    };

    if (obj.error && typeof obj.error === 'object') {
      const payload = obj.error as { message?: unknown; error?: unknown };
      const payloadMessage = String(payload.message || payload.error || '').trim();
      if (payloadMessage) return payloadMessage;
    }

    const directMessage = String(obj.message || obj.error || '').trim();
    if (directMessage) return directMessage;

    const status = Number(obj.status);
    if (Number.isFinite(status) && status > 0) {
      return `请求失败（HTTP ${status}）。`;
    }
    return '';
  }
}
