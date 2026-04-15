import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';

import { type InfoTaskVm, TaskCenterService } from '../../services/task-center.service';
import {
  type UpdateVolunteerTrackingRequestVm,
  type VolunteerTrackingStateVm,
  VolunteerTrackingService,
} from '../../services/volunteer-tracking.service';

interface VolunteerTaskDraft {
  taskName: string;
  description: string;
  durationHours: string;
  startDate: string;
  endDate: string;
  verifierContact: string;
}

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
  updatedAt: string;
  rawContent: string;
}

const VOLUNTEER_TOTAL_HOURS_PREFIX = '义工总时长：';
const VOLUNTEER_TASK_COLLECTION_PREFIX = '义工任务明细：';

@Component({
  selector: 'app-student-volunteer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="volunteer-page">
      <div class="volunteer-shell">
        <div class="header-row">
          <div>
            <h2>我的义工记录</h2>
          </div>
          <div class="header-actions">
            <button type="button" class="ghost-btn" (click)="refresh()" [disabled]="loading || saving">
              刷新
            </button>
            <button type="button" class="ghost-btn" (click)="goBack()">返回</button>
          </div>
        </div>

        <section class="summary-card">
          <span>累计义工时长</span>
          <strong>{{ totalVolunteerHoursLabel }} 小时</strong>
        </section>

        <div *ngIf="loading" class="state-text">正在加载义工记录...</div>
        <div *ngIf="!loading && error" class="error-banner">{{ error }}</div>
        <div *ngIf="successMessage" class="success-banner">{{ successMessage }}</div>

        <section class="editor-card" *ngIf="!loading">
          <div class="editor-head">
            <strong>编辑我的义工记录</strong>
            <div class="editor-actions">
              <button type="button" class="ghost-btn" (click)="addTask()" [disabled]="saving">
                添加任务
              </button>
              <button type="button" class="ghost-btn" (click)="resetEditor()" [disabled]="saving">
                重置
              </button>
            </div>
          </div>

          <article class="task-card" *ngFor="let task of editorTasks; let index = index; trackBy: trackEditorTask">
            <div class="task-head">
              <strong>任务 {{ index + 1 }}</strong>
              <button
                type="button"
                class="ghost-btn compact"
                (click)="removeTask(index)"
                [disabled]="saving || editorTasks.length <= 1"
              >
                删除
              </button>
            </div>

            <div class="task-grid">
              <label>
                任务名称
                <input [(ngModel)]="task.taskName" [disabled]="saving" />
              </label>
              <label>
                时长（小时）
                <input
                  [(ngModel)]="task.durationHours"
                  [disabled]="saving"
                  type="number"
                  min="0.1"
                  step="0.1"
                />
              </label>
              <label>
                开始日期
                <input [(ngModel)]="task.startDate" [disabled]="saving" type="date" />
              </label>
              <label>
                结束日期
                <input [(ngModel)]="task.endDate" [disabled]="saving" type="date" />
              </label>
              <label class="span-2">
                证明人联系方式
                <input [(ngModel)]="task.verifierContact" [disabled]="saving" />
              </label>
              <label class="span-2">
                任务描述（做了什么）
                <textarea [(ngModel)]="task.description" [disabled]="saving" rows="2"></textarea>
              </label>
            </div>
          </article>

          <div class="editor-footer">
            <div class="editor-total">当前任务总时长：{{ editorHoursLabel }} 小时</div>
            <button type="button" class="primary-btn" (click)="saveTracking()" [disabled]="saving">
              {{ saving ? '保存中...' : '保存义工记录' }}
            </button>
          </div>
        </section>

        <section class="record-list" *ngIf="!loading && records.length > 0">
          <h3>历史记录</h3>
          <article class="record-card" *ngFor="let record of records; trackBy: trackRecord">
            <div class="record-head">
              <strong>{{ record.title }}</strong>
              <span class="record-hours">{{ formatHours(record.totalHours) }} 小时</span>
            </div>

            <div class="record-meta">
              <span>更新时间：{{ displayDateTime(record.updatedAt) }}</span>
              <span>创建时间：{{ displayDateTime(record.createdAt) }}</span>
              <span>任务数：{{ record.tasks.length }}</span>
              <span *ngIf="record.teacherName">最近审核老师：{{ record.teacherName }}</span>
            </div>

            <p *ngIf="record.note" class="record-note">{{ record.note }}</p>

            <div *ngIf="record.tasks.length > 0" class="record-tasks">
              <div class="record-task" *ngFor="let task of record.tasks; let taskIndex = index; trackBy: trackRecordTask">
                <strong>{{ taskIndex + 1 }}. {{ task.taskName || '未命名任务' }}</strong>
                <span>{{ formatHours(task.durationHours) }} 小时</span>
                <span>{{ task.startDate || '-' }} 至 {{ task.endDate || '-' }}</span>
              </div>
            </div>

            <button
              type="button"
              class="ghost-btn compact"
              (click)="loadRecordToEditor(record)"
              [disabled]="saving"
            >
              载入到编辑区
            </button>
          </article>
        </section>

        <div *ngIf="!loading && !error && records.length === 0" class="state-text">
          暂无义工记录，请先新增一条。
        </div>
      </div>
    </div>
  `,
  styleUrl: './student-volunteer.component.scss',
})
export class StudentVolunteerComponent implements OnInit {
  loading = false;
  saving = false;
  error = '';
  successMessage = '';
  records: VolunteerRecordVm[] = [];

  editorTasks: VolunteerTaskDraft[] = [this.createEmptyTask()];

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

  get editorHoursLabel(): string {
    return this.formatHours(
      this.normalizeTasks(this.editorTasks).reduce((sum, task) => sum + task.durationHours, 0)
    );
  }

  trackRecord = (_index: number, record: VolunteerRecordVm): number => record.id;
  trackEditorTask = (index: number): number => index;
  trackRecordTask = (index: number): number => index;

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  refresh(): void {
    this.loadVolunteerRecords();
  }

  addTask(): void {
    if (this.saving) return;
    this.editorTasks = [...this.editorTasks, this.createEmptyTask()];
    this.successMessage = '';
  }

  removeTask(index: number): void {
    if (this.saving) return;
    if (index < 0 || index >= this.editorTasks.length) return;

    if (this.editorTasks.length <= 1) {
      this.editorTasks = [this.createEmptyTask()];
      this.successMessage = '';
      return;
    }

    this.editorTasks = this.editorTasks.filter((_, taskIndex) => taskIndex !== index);
    this.successMessage = '';
  }

  resetEditor(clearMessages = true): void {
    if (this.saving) return;
    this.editorTasks = [this.createEmptyTask()];
    if (clearMessages) {
      this.error = '';
      this.successMessage = '';
    }
  }

  loadRecordToEditor(record: VolunteerRecordVm, clearMessages = true): void {
    this.editorTasks =
      record.tasks.length > 0
        ? record.tasks.map((task) => ({
            taskName: task.taskName,
            description: task.description,
            durationHours: this.formatHours(task.durationHours),
            startDate: task.startDate,
            endDate: task.endDate,
            verifierContact: task.verifierContact,
          }))
        : [this.createEmptyTask()];

    if (clearMessages) {
      this.error = '';
      this.successMessage = '';
    }
  }

  saveTracking(): void {
    if (this.saving) return;

    const validationError = this.validateEditorTasks();
    if (validationError) {
      this.error = validationError;
      this.successMessage = '';
      this.cdr.detectChanges();
      return;
    }

    const tasks = this.normalizeTasks(this.editorTasks);
    const request: UpdateVolunteerTrackingRequestVm = {
      note: '',
      totalHours: Math.round(tasks.reduce((sum, task) => sum + task.durationHours, 0) * 100) / 100,
      tasks,
    };

    this.saving = true;
    this.error = '';
    this.successMessage = '';
    this.cdr.detectChanges();

    this.volunteerTracking
      .updateMyVolunteerTracking(request)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: () => {
          this.successMessage = '义工记录已保存。';
          this.loadVolunteerRecords(true);
        },
        error: (error: unknown) => {
          this.error = this.extractErrorMessage(error) || '保存义工记录失败。';
          this.cdr.detectChanges();
        },
      });
  }

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

  private loadVolunteerRecords(preserveSuccessMessage = false): void {
    this.loading = true;
    this.error = '';
    if (!preserveSuccessMessage) {
      this.successMessage = '';
    }
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

          if (records.length > 0) {
            this.loadRecordToEditor(records[0], false);
          } else {
            this.resetEditor(false);
          }

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
        createdAt: String(record.createdAt || record.updatedAt || ''),
        updatedAt: String(record.updatedAt || record.createdAt || ''),
        rawContent: '',
      }))
      .sort((a, b) => this.toTs(b.updatedAt || b.createdAt) - this.toTs(a.updatedAt || a.createdAt));
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
      updatedAt: info.updatedAt || info.createdAt,
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

  private validateEditorTasks(): string {
    const rows = this.collectActiveTaskRows();
    if (rows.length <= 0) {
      return '请至少填写 1 条义工任务。';
    }

    for (const row of rows) {
      const rowLabel = `第 ${row.index + 1} 条任务`;
      const taskName = row.task.taskName.trim();
      const description = row.task.description.trim();
      const durationHours = this.parseHours(row.task.durationHours);
      const startDate = row.task.startDate.trim();
      const endDate = row.task.endDate.trim();
      const verifierContact = row.task.verifierContact.trim();

      if (!taskName) return `${rowLabel}缺少任务名称。`;
      if (!description) return `${rowLabel}缺少任务描述。`;
      if (durationHours <= 0) return `${rowLabel}时长必须大于 0。`;
      if (!startDate) return `${rowLabel}缺少开始日期。`;
      if (!endDate) return `${rowLabel}缺少结束日期。`;
      if (!verifierContact) return `${rowLabel}缺少证明人联系方式。`;

      const startAt = Date.parse(startDate);
      const endAt = Date.parse(endDate);
      if (Number.isFinite(startAt) && Number.isFinite(endAt) && endAt < startAt) {
        return `${rowLabel}结束日期不能早于开始日期。`;
      }
    }

    return '';
  }

  private collectActiveTaskRows(): Array<{ index: number; task: VolunteerTaskDraft }> {
    const rows: Array<{ index: number; task: VolunteerTaskDraft }> = [];
    for (let index = 0; index < this.editorTasks.length; index += 1) {
      const task = this.editorTasks[index];
      if (!task || this.isTaskEmpty(task)) continue;
      rows.push({ index, task });
    }
    return rows;
  }

  private isTaskEmpty(task: VolunteerTaskDraft): boolean {
    return (
      !task.taskName.trim() &&
      !task.description.trim() &&
      !String(task.durationHours ?? '').trim() &&
      !task.startDate.trim() &&
      !task.endDate.trim() &&
      !task.verifierContact.trim()
    );
  }

  private normalizeTasks(tasks: readonly VolunteerTaskDraft[]): VolunteerTaskVm[] {
    return tasks
      .map((task) => ({
        taskName: String(task.taskName || '').trim(),
        description: String(task.description || '').trim(),
        durationHours: this.parseHours(task.durationHours),
        startDate: String(task.startDate || '').trim(),
        endDate: String(task.endDate || '').trim(),
        verifierContact: String(task.verifierContact || '').trim(),
      }))
      .filter(
        (task) =>
          task.taskName ||
          task.description ||
          task.durationHours > 0 ||
          task.startDate ||
          task.endDate ||
          task.verifierContact
      );
  }

  private createEmptyTask(): VolunteerTaskDraft {
    return {
      taskName: '',
      description: '',
      durationHours: '',
      startDate: '',
      endDate: '',
      verifierContact: '',
    };
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

  private toTs(value: string): number {
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : 0;
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
