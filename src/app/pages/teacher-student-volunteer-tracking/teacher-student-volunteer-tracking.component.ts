import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';

import {
  type CreateInfoRequestVm,
  type InfoTaskVm,
  TaskCenterService,
} from '../../services/task-center.service';
import {
  type StudentAccount,
  StudentManagementService,
} from '../../services/student-management.service';
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
  taskGroupId: string;
  createdAt: string;
  updatedAt: string;
  tasks: VolunteerTaskVm[];
}

const VOLUNTEER_TASK_GROUP_PREFIX = 'VOLUNTEER-STUDENT-';
const VOLUNTEER_TOTAL_HOURS_PREFIX = '义工总时长：';
const VOLUNTEER_TASK_COLLECTION_PREFIX = '义工任务明细：';

@Component({
  selector: 'app-teacher-student-volunteer-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="volunteer-page">
      <div class="volunteer-shell">
        <div class="header-row">
          <div>
            <h2>教师义工跟踪</h2>
            <p class="sub-title">学生：{{ studentDisplayName }}</p>
          </div>
          <div class="header-actions">
            <button type="button" class="ghost-btn" (click)="goBackToList()">返回列表</button>
          </div>
        </div>

        <section class="summary-card">
          <span>该学生累计义工时长</span>
          <strong>{{ totalHoursLabel }} 小时</strong>
        </section>

        <div *ngIf="loading" class="state-text">正在加载义工记录...</div>
        <div *ngIf="!loading && error" class="error-banner">{{ error }}</div>
        <div *ngIf="successMessage" class="success-banner">{{ successMessage }}</div>

        <section class="editor-card" *ngIf="!loading && studentId > 0">
          <div class="editor-head">
            <strong>编辑义工记录</strong>
            <div class="editor-actions">
              <button type="button" (click)="addTask()" [disabled]="saving">添加任务</button>
              <button type="button" (click)="resetEditor()" [disabled]="saving">重置</button>
            </div>
          </div>

          <label class="field-label">
            补充说明（可选）
            <textarea [(ngModel)]="editorNote" [disabled]="saving" rows="2" placeholder="补充说明"></textarea>
          </label>

          <article class="task-card" *ngFor="let task of editorTasks; let index = index; trackBy: trackTask">
            <div class="task-head">
              <strong>任务 {{ index + 1 }}</strong>
              <button type="button" (click)="removeTask(index)" [disabled]="saving || editorTasks.length <= 1">
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
                <input [(ngModel)]="task.durationHours" [disabled]="saving" type="number" min="0.1" step="0.1" />
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
              <span>{{ formatHours(record.totalHours) }} 小时</span>
            </div>
            <div class="record-meta">
              <span>更新时间：{{ displayDateTime(record.updatedAt) }}</span>
              <span>创建时间：{{ displayDateTime(record.createdAt) }}</span>
              <span>任务数：{{ record.tasks.length }}</span>
            </div>
            <p *ngIf="record.note" class="record-note">{{ record.note }}</p>
            <button type="button" class="ghost-btn compact" (click)="loadRecordToEditor(record)" [disabled]="saving">
              载入到编辑区
            </button>
          </article>
        </section>
      </div>
    </div>
  `,
  styleUrl: './teacher-student-volunteer-tracking.component.scss',
})
export class TeacherStudentVolunteerTrackingComponent implements OnInit {
  studentId = 0;
  studentDisplayName = '-';

  loading = false;
  saving = false;
  error = '';
  successMessage = '';
  records: VolunteerRecordVm[] = [];

  editorNote = '';
  editorTasks: VolunteerTaskDraft[] = [this.createEmptyTask()];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private volunteerTracking: VolunteerTrackingService,
    private taskCenter: TaskCenterService,
    private studentApi: StudentManagementService,
    private cdr: ChangeDetectorRef = { detectChanges: () => {} } as ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.resolveStudentIdFromRoute();
  }

  get totalHours(): number {
    return this.records.reduce((sum, record) => sum + record.totalHours, 0);
  }

  get totalHoursLabel(): string {
    return this.formatHours(this.totalHours);
  }

  get editorHoursLabel(): string {
    return this.formatHours(
      this.normalizeTasks(this.editorTasks).reduce((sum, task) => sum + task.durationHours, 0)
    );
  }

  trackRecord = (_index: number, record: VolunteerRecordVm): number => record.id;
  trackTask = (index: number): number => index;

  goBackToList(): void {
    this.router.navigate(['/teacher/volunteer']);
  }

  addTask(): void {
    if (this.saving) return;
    this.editorTasks = [...this.editorTasks, this.createEmptyTask()];
  }

  removeTask(index: number): void {
    if (this.saving) return;
    if (index < 0 || index >= this.editorTasks.length) return;
    if (this.editorTasks.length <= 1) {
      this.editorTasks = [this.createEmptyTask()];
      return;
    }
    this.editorTasks = this.editorTasks.filter((_, taskIndex) => taskIndex !== index);
  }

  resetEditor(): void {
    if (this.saving) return;
    this.editorNote = '';
    this.editorTasks = [this.createEmptyTask()];
    this.error = '';
    this.successMessage = '';
  }

  loadRecordToEditor(record: VolunteerRecordVm): void {
    this.editorNote = record.note;
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
    this.error = '';
    this.successMessage = '';
  }

  saveTracking(): void {
    if (this.saving || this.studentId <= 0) return;

    const validationError = this.validateEditorTasks();
    if (validationError) {
      this.error = validationError;
      this.successMessage = '';
      return;
    }

    const tasks = this.normalizeTasks(this.editorTasks);
    const request: UpdateVolunteerTrackingRequestVm = {
      note: this.editorNote.trim(),
      totalHours: Math.round(tasks.reduce((sum, task) => sum + task.durationHours, 0) * 100) / 100,
      tasks,
    };

    this.saving = true;
    this.error = '';
    this.successMessage = '';
    this.cdr.detectChanges();

    this.volunteerTracking
      .updateTeacherStudentVolunteerTracking(this.studentId, request)
      .pipe(catchError((error: unknown) => this.trySaveTrackingLegacy(error, request)))
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: () => {
          this.successMessage = '义工记录已保存。';
          this.loadRecords();
        },
        error: (error: unknown) => {
          this.error = this.extractErrorMessage(error) || '保存义工记录失败。';
          this.cdr.detectChanges();
        },
      });
  }

  displayDateTime(value: string): string {
    const ts = Date.parse(String(value || ''));
    if (!Number.isFinite(ts)) return value || '-';
    return new Date(ts).toLocaleString();
  }

  formatHours(hours: number): string {
    const normalized = Math.round(Number(hours || 0) * 100) / 100;
    if (!Number.isFinite(normalized) || normalized <= 0) return '0';
    return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(2);
  }

  private resolveStudentIdFromRoute(): void {
    this.route.paramMap.subscribe((params) => {
      const rawStudentId = Number(params.get('studentId'));
      if (!Number.isFinite(rawStudentId) || rawStudentId <= 0) {
        this.studentId = 0;
        this.studentDisplayName = '-';
        this.error = '学生 ID 无效。';
        this.records = [];
        this.cdr.detectChanges();
        return;
      }

      this.studentId = Math.trunc(rawStudentId);
      this.studentDisplayName = `学生 #${this.studentId}`;
      this.error = '';
      this.successMessage = '';
      this.resolveStudentDisplayName(this.studentId);
      this.loadRecords();
    });
  }

  private resolveStudentDisplayName(studentId: number): void {
    this.studentApi
      .listStudents()
      .pipe(catchError(() => of([] as StudentAccount[])))
      .subscribe((payload) => {
        const students = this.normalizeStudentAccounts(payload);
        const matched = students.find((row) => this.resolveStudentId(row) === studentId);
        if (!matched) {
          this.cdr.detectChanges();
          return;
        }

        const name = this.resolveStudentName(matched);
        if (name) {
          this.studentDisplayName = name;
          this.cdr.detectChanges();
        }
      });
  }

  private loadRecords(): void {
    if (this.studentId <= 0) return;

    this.loading = true;
    this.error = '';
    this.cdr.detectChanges();

    this.fetchTrackingRecords()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (rows) => {
          this.records = rows;

          if (rows.length > 0) {
            this.loadRecordToEditor(rows[0]);
          } else {
            this.editorNote = '';
            this.editorTasks = [this.createEmptyTask()];
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

  private fetchTrackingRecords(): Observable<VolunteerRecordVm[]> {
    return this.volunteerTracking.getTeacherStudentVolunteerTracking(this.studentId).pipe(
      map((state) => this.mapTrackingStateToRecords(state)),
      catchError((error: unknown) => this.tryLoadTrackingLegacy(error))
    );
  }

  private mapTrackingStateToRecords(state: VolunteerTrackingStateVm): VolunteerRecordVm[] {
    return (state.records || [])
      .map((record, index) => ({
        id: Number.isFinite(Number(record.id)) && Number(record.id) > 0 ? Math.trunc(Number(record.id)) : index + 1,
        title: String(record.title || '').trim() || '义工记录',
        note: String(record.note || '').trim(),
        totalHours: this.parseHours(record.totalHours),
        taskGroupId: this.resolveTrackingTaskGroupId(this.studentId),
        createdAt: String(record.createdAt || record.updatedAt || ''),
        updatedAt: String(record.updatedAt || record.createdAt || ''),
        tasks: (record.tasks || []).map((task) => ({
          taskName: String(task.taskName || '').trim(),
          description: String(task.description || '').trim(),
          durationHours: this.parseHours(task.durationHours),
          startDate: String(task.startDate || '').trim(),
          endDate: String(task.endDate || '').trim(),
          verifierContact: String(task.verifierContact || '').trim(),
        })),
      }))
      .sort((a, b) => this.toTs(b.updatedAt) - this.toTs(a.updatedAt));
  }

  private tryLoadTrackingLegacy(error: unknown): Observable<VolunteerRecordVm[]> {
    if (!this.shouldFallbackToLegacy(error)) {
      return throwError(() => error);
    }

    const groupId = this.resolveTrackingTaskGroupId(this.studentId);
    return this.taskCenter
      .listTeacherInfos({
        category: 'VOLUNTEER',
        page: 1,
        size: 300,
      })
      .pipe(
        map((resp) =>
          (resp.items || [])
            .filter((info) => this.normalizeTaskGroupId(info.taskGroupId) === groupId)
            .map((info) => this.mapInfoToRecord(info))
            .sort((a, b) => this.toTs(b.updatedAt) - this.toTs(a.updatedAt))
        )
      );
  }

  private trySaveTrackingLegacy(
    error: unknown,
    request: UpdateVolunteerTrackingRequestVm
  ): Observable<VolunteerTrackingStateVm> {
    if (!this.shouldFallbackToLegacy(error)) {
      return throwError(() => error);
    }

    const legacyRequest: CreateInfoRequestVm = {
      category: 'VOLUNTEER',
      title: `义工跟踪 - ${this.studentDisplayName}`,
      content: this.buildVolunteerContent(request.note, request.tasks),
      tags: ['VolunteerTracking', `Student-${this.studentId}`],
      studentIds: [this.studentId],
      taskGroupId: this.resolveTrackingTaskGroupId(this.studentId),
    };

    return this.taskCenter
      .createInfo(legacyRequest)
      .pipe(map(() => ({ studentId: this.studentId, records: [] } as VolunteerTrackingStateVm)));
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

  private mapInfoToRecord(info: InfoTaskVm): VolunteerRecordVm {
    const parsed = this.parseVolunteerContent(String(info.content || ''));
    return {
      id: info.id,
      title: String(info.title || '').trim() || '义工记录',
      note: parsed.note,
      totalHours: parsed.totalHours,
      taskGroupId: this.normalizeTaskGroupId(info.taskGroupId),
      createdAt: String(info.createdAt || ''),
      updatedAt: String(info.updatedAt || ''),
      tasks: parsed.tasks,
    };
  }

  private parseVolunteerContent(content: string): {
    note: string;
    totalHours: number;
    tasks: VolunteerTaskVm[];
  } {
    const raw = String(content || '').trim();
    if (!raw) {
      return { note: '', totalHours: 0, tasks: [] };
    }

    const detailHeaderIndex = raw.indexOf(VOLUNTEER_TASK_COLLECTION_PREFIX);
    if (detailHeaderIndex < 0) {
      return {
        note: raw,
        totalHours: this.extractTotalHours(raw),
        tasks: [],
      };
    }

    const totalHeaderIndex = raw.indexOf(VOLUNTEER_TOTAL_HOURS_PREFIX);
    const noteEndIndex = totalHeaderIndex >= 0 ? totalHeaderIndex : detailHeaderIndex;
    const note = raw.slice(0, noteEndIndex).trim();
    const detailBlock = raw.slice(detailHeaderIndex + VOLUNTEER_TASK_COLLECTION_PREFIX.length).trim();
    const tasks = this.parseTaskItems(detailBlock);
    const parsedTotal = this.extractTotalHours(raw);
    const summedTotal = tasks.reduce((sum, task) => sum + task.durationHours, 0);
    return {
      note,
      totalHours: parsedTotal > 0 ? parsedTotal : summedTotal,
      tasks,
    };
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

  private extractTotalHours(content: string): number {
    const matched = String(content || '').match(/义工总时长：\s*([0-9]+(?:\.[0-9]+)?)\s*小时/);
    if (!matched) return 0;
    return this.parseHours(matched[1]);
  }

  private validateEditorTasks(): string {
    const rows = this.collectActiveTaskRows();
    if (rows.length <= 0) {
      return '请至少添加 1 条义工任务。';
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

  private buildVolunteerContent(note: string, tasks: readonly VolunteerTaskVm[]): string {
    const totalHours = tasks.reduce((sum, task) => sum + task.durationHours, 0);
    const lines = tasks
      .map((task, index) =>
        [
          `${index + 1}. 任务名称：${task.taskName}`,
          `   任务描述：${task.description}`,
          `   任务时长：${this.formatHours(task.durationHours)} 小时`,
          `   开始日期：${task.startDate}`,
          `   结束日期：${task.endDate}`,
          `   证明人联系方式：${task.verifierContact}`,
        ].join('\n')
      )
      .join('\n');

    const detail = [
      `${VOLUNTEER_TOTAL_HOURS_PREFIX}${this.formatHours(totalHours)} 小时`,
      VOLUNTEER_TASK_COLLECTION_PREFIX,
      lines,
    ].join('\n');

    return note ? `${note}\n\n${detail}` : detail;
  }

  private normalizeTaskGroupId(value: unknown): string {
    return String(value ?? '').trim();
  }

  private resolveTrackingTaskGroupId(studentId: number): string {
    return `${VOLUNTEER_TASK_GROUP_PREFIX}${Math.trunc(studentId)}`;
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

  private toTs(value: string): number {
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private normalizeStudentAccounts(
    payload: StudentAccount[] | { items?: StudentAccount[]; data?: StudentAccount[] } | unknown
  ): StudentAccount[] {
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === 'object') {
      const node = payload as { items?: unknown; data?: unknown };
      if (Array.isArray(node.items)) return node.items as StudentAccount[];
      if (Array.isArray(node.data)) return node.data as StudentAccount[];
    }
    return [];
  }

  private resolveStudentId(student: StudentAccount): number | null {
    const candidates: unknown[] = [
      student.studentId,
      (student as Record<string, unknown>)?.['student_id'],
      student.id,
    ];
    for (const candidate of candidates) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed) && parsed > 0) return Math.trunc(parsed);
    }
    return null;
  }

  private resolveStudentName(student: StudentAccount): string {
    const firstName = String(student.firstName || '').trim();
    const lastName = String(student.lastName || '').trim();
    const fullName = `${firstName} ${lastName}`.trim();
    if (fullName) return fullName;
    const displayName = String(student.displayName || '').trim();
    if (displayName) return displayName;
    const username = String(student.username || '').trim();
    return username || `学生 #${this.studentId}`;
  }

  private extractErrorMessage(error: unknown): string {
    if (typeof error === 'string') return error;
    if (!error || typeof error !== 'object') return '';

    const obj = error as { name?: unknown; message?: unknown; error?: unknown; status?: unknown };
    if (String(obj.name || '').trim().toLowerCase() === 'timeouterror') {
      return '请求超时，请检查后端服务或网络连接。';
    }

    if (obj.error && typeof obj.error === 'object') {
      const payload = obj.error as { message?: unknown; error?: unknown };
      const message = String(payload.message || payload.error || '').trim();
      if (message) return message;
    }

    const direct = String(obj.message || obj.error || '').trim();
    if (direct) return direct;

    const status = Number(obj.status);
    if (Number.isFinite(status) && status > 0) {
      return `请求失败（HTTP ${status}）。`;
    }
    return '';
  }
}
