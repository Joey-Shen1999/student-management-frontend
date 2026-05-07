import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';

import {
  ServiceProgressAdvisor,
  ServiceProgressRecord,
  ServiceProgressRecordRequest,
  ServiceProgressService,
} from '../../services/service-progress.service';
import {
  StudentAccount,
  StudentManagementService,
} from '../../services/student-management.service';
import {
  TeacherAccount,
  TeacherManagementService,
} from '../../services/teacher-management.service';

interface ServiceProgressFormModel {
  id: number | null;
  appointmentTime: string;
  advisorId: number | null;
  followUpContent: string;
  nextPlan: string;
}

@Component({
  selector: 'app-teacher-service-progress',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="service-progress-page">
      <header class="page-header">
        <div>
          <h2>服务进度档</h2>
          <p>老师端独立维护顾问咨询记录，学生端不可见。</p>
        </div>
        <div class="header-actions">
          <button type="button" (click)="toggleAdvisorSettings()">
            顾问设置
          </button>
          <button type="button" routerLink="/teacher/dashboard">返回</button>
        </div>
      </header>

      <section *ngIf="advisorSettingsOpen" class="advisor-settings">
        <div class="panel-title">
          <strong>选择可作为顾问的老师</strong>
          <button type="button" (click)="toggleAdvisorSettings()">关闭</button>
        </div>
        <input
          [(ngModel)]="teacherKeyword"
          type="search"
          placeholder="搜索老师姓名、用户名、邮箱"
          class="student-search"
        />
        <div *ngIf="teacherLoading" class="muted">正在加载老师...</div>
        <div *ngIf="teacherError" class="error">{{ teacherError }}</div>
        <div class="teacher-list">
          <label *ngFor="let teacher of filteredTeachers; trackBy: trackTeacher" class="teacher-option">
            <input
              type="checkbox"
              [ngModel]="isAdvisorEnabled(teacher)"
              (ngModelChange)="toggleTeacherAdvisor(teacher, $event)"
              [disabled]="advisorUpdatingTeacherId === resolveTeacherId(teacher)"
            />
            <span>
              <strong>{{ displayTeacherName(teacher) }}</strong>
              <small>{{ displayTeacherMeta(teacher) }}</small>
            </span>
          </label>
        </div>
      </section>

      <div class="layout">
        <aside class="student-panel">
          <div class="panel-title">
            <strong>学生</strong>
            <span>{{ filteredStudents.length }}</span>
          </div>
          <input
            [(ngModel)]="studentKeyword"
            type="search"
            placeholder="搜索姓名、邮箱、电话"
            class="student-search"
          />

          <div *ngIf="studentLoading" class="muted">正在加载学生...</div>
          <div *ngIf="studentError" class="error">{{ studentError }}</div>

          <button
            *ngFor="let student of filteredStudents; trackBy: trackStudent"
            type="button"
            class="student-row"
            [class.active]="resolveStudentId(student) === selectedStudentId"
            (click)="selectStudent(student)"
          >
            <span>{{ displayStudentName(student) }}</span>
            <small>{{ displayStudentMeta(student) }}</small>
          </button>
        </aside>

        <main class="record-panel">
          <ng-container *ngIf="selectedStudent; else emptyState">
            <div class="record-header">
              <div>
                <h3>{{ displayStudentName(selectedStudent) }}</h3>
                <p>{{ displayStudentMeta(selectedStudent) }}</p>
              </div>
              <button
                type="button"
                (click)="openAddRecord()"
                [disabled]="recordLoading || saving"
              >
                新增服务记录
              </button>
            </div>

            <div *ngIf="recordError" class="error">{{ recordError }}</div>
            <div *ngIf="recordLoading" class="muted">正在加载服务进度档...</div>

            <section class="remark-block">
              <label>
                <span>学生备注信息</span>
                <textarea
                  [(ngModel)]="remarkDraft"
                  rows="4"
                  [disabled]="saving"
                  placeholder="这里复用学生档案里的唯一备注，保存后会同步到学生档案。"
                ></textarea>
              </label>
              <button type="button" (click)="saveRemark()" [disabled]="saving || !selectedStudentId">
                {{ saving ? '保存中...' : '保存备注' }}
              </button>
            </section>

            <section *ngIf="formOpen" class="form-block">
              <h4>{{ form.id ? '编辑服务记录' : '新增服务记录' }}</h4>
              <div class="form-grid">
                <label>
                  <span>约见时间</span>
                  <input type="datetime-local" [(ngModel)]="form.appointmentTime" [disabled]="saving" />
                </label>
                <label>
                  <span>约见顾问</span>
                  <select [(ngModel)]="form.advisorId" [disabled]="saving">
                    <option [ngValue]="null">请选择</option>
                    <option *ngFor="let advisor of advisors" [ngValue]="resolveAdvisorId(advisor)">
                      {{ displayAdvisorName(advisor) }}
                    </option>
                  </select>
                </label>
                <label class="wide">
                  <span>跟进内容</span>
                  <textarea [(ngModel)]="form.followUpContent" rows="4" [disabled]="saving"></textarea>
                </label>
                <label class="wide">
                  <span>后续方案</span>
                  <textarea [(ngModel)]="form.nextPlan" rows="4" [disabled]="saving"></textarea>
                </label>
              </div>
              <div class="form-actions">
                <button type="button" (click)="closeForm()" [disabled]="saving">取消</button>
                <button type="button" (click)="saveRecord()" [disabled]="saving">
                  {{ saving ? '保存中...' : '保存记录' }}
                </button>
              </div>
            </section>

            <section class="record-list">
              <div *ngIf="!recordLoading && records.length === 0" class="muted">
                暂无服务记录。
              </div>

              <article *ngFor="let record of records" class="record-card">
                <div class="record-card-header">
                  <div>
                    <strong>{{ displayDateTime(record.appointmentTime) }}</strong>
                    <span>顾问：{{ record.advisorName || advisorName(record.advisorId) }}</span>
                  </div>
                  <div class="record-actions">
                    <button type="button" (click)="openEditRecord(record)" [disabled]="saving">编辑</button>
                    <button type="button" (click)="deleteRecord(record)" [disabled]="saving">删除</button>
                  </div>
                </div>
                <div class="record-body">
                  <div>
                    <strong>跟进内容</strong>
                    <p>{{ displayMultiline(record.followUpContent) }}</p>
                  </div>
                  <div>
                    <strong>后续方案</strong>
                    <p>{{ displayMultiline(record.nextPlan) }}</p>
                  </div>
                </div>
                <footer>
                  创建：{{ displayDateTime(record.createdAt) }}；更新：{{ displayDateTime(record.updatedAt) }}
                </footer>
              </article>
            </section>
          </ng-container>

          <ng-template #emptyState>
            <div class="empty-state">请选择一个学生查看服务进度档。</div>
          </ng-template>
        </main>
      </div>
    </div>
  `,
  styles: [
    `
      .service-progress-page {
        max-width: 1320px;
        margin: 48px auto;
        padding: 0 20px;
        color: #1f2f47;
        font-family: Arial, sans-serif;
      }
      .page-header,
      .record-header,
      .panel-title,
      .form-actions,
      .record-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .header-actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      h2,
      h3,
      h4,
      p {
        margin: 0;
      }
      .page-header p,
      .record-header p,
      .muted,
      footer {
        color: #667085;
      }
      .layout {
        display: grid;
        grid-template-columns: minmax(260px, 340px) 1fr;
        gap: 16px;
        margin-top: 18px;
      }
      .student-panel,
      .record-panel,
      .remark-block,
      .form-block,
      .advisor-settings,
      .record-card {
        border: 1px solid #d8e2f0;
        border-radius: 8px;
        background: #fff;
      }
      .advisor-settings {
        margin-top: 14px;
        padding: 14px;
      }
      .student-panel,
      .record-panel {
        padding: 14px;
      }
      .student-search,
      input,
      select,
      textarea {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 8px;
        font: inherit;
      }
      .student-search {
        margin: 10px 0;
      }
      .student-row {
        width: 100%;
        display: grid;
        gap: 3px;
        text-align: left;
        margin-top: 6px;
        padding: 9px;
        border: 1px solid #e4e9f2;
        border-radius: 6px;
        background: #fff;
        cursor: pointer;
      }
      .student-row.active {
        border-color: #2563eb;
        background: #eff6ff;
      }
      .student-row small {
        color: #667085;
      }
      .teacher-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 8px;
      }
      .teacher-option {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        border: 1px solid #e4e9f2;
        border-radius: 6px;
        padding: 9px;
      }
      .teacher-option input {
        width: auto;
        margin-top: 3px;
      }
      .teacher-option span {
        display: grid;
        gap: 3px;
      }
      .teacher-option small {
        color: #667085;
      }
      .remark-block,
      .form-block,
      .record-card,
      .empty-state {
        margin-top: 14px;
        padding: 12px;
      }
      label,
      .record-body {
        display: grid;
        gap: 7px;
      }
      label span {
        font-weight: 600;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(220px, 1fr));
        gap: 12px;
      }
      .wide {
        grid-column: 1 / -1;
      }
      .record-list {
        margin-top: 14px;
      }
      .record-card-header span {
        margin-left: 10px;
        color: #667085;
      }
      .record-actions {
        display: flex;
        gap: 8px;
      }
      .record-body {
        margin-top: 12px;
      }
      .record-body p {
        white-space: pre-wrap;
        color: #344054;
      }
      button {
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        background: #f8fafc;
        padding: 7px 11px;
        cursor: pointer;
      }
      button:disabled {
        cursor: not-allowed;
        opacity: 0.65;
      }
      .error {
        margin-top: 10px;
        color: #b00020;
      }
      @media (max-width: 860px) {
        .layout,
        .form-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class TeacherServiceProgressComponent implements OnInit {
  students: StudentAccount[] = [];
  studentKeyword = '';
  selectedStudentId: number | null = null;
  studentLoading = false;
  studentError = '';
  teachers: TeacherAccount[] = [];
  teacherKeyword = '';
  teacherLoading = false;
  teacherError = '';
  advisorSettingsOpen = false;
  advisorUpdatingTeacherId: number | null = null;

  recordLoading = false;
  saving = false;
  recordError = '';
  records: ServiceProgressRecord[] = [];
  advisors: ServiceProgressAdvisor[] = [];
  remarkDraft = '';
  formOpen = false;
  form: ServiceProgressFormModel = this.createEmptyForm();

  constructor(
    private route: ActivatedRoute,
    private studentApi: StudentManagementService,
    private serviceProgressApi: ServiceProgressService,
    private teacherApi: TeacherManagementService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadStudents();
    this.loadAdvisors();
  }

  get filteredStudents(): StudentAccount[] {
    const keyword = this.normalizeText(this.studentKeyword).toLowerCase();
    if (!keyword) return this.students;
    return this.students.filter((student) =>
      [
        this.displayStudentName(student),
        student.username,
        student.email,
        student.phone,
        student.displayName,
      ]
        .map((value) => this.normalizeText(value).toLowerCase())
        .some((value) => value.includes(keyword))
    );
  }

  get selectedStudent(): StudentAccount | null {
    if (!this.selectedStudentId) return null;
    return this.students.find((student) => this.resolveStudentId(student) === this.selectedStudentId) ?? null;
  }

  get filteredTeachers(): TeacherAccount[] {
    const keyword = this.normalizeText(this.teacherKeyword).toLowerCase();
    if (!keyword) return this.teachers;
    return this.teachers.filter((teacher) =>
      [
        this.displayTeacherName(teacher),
        teacher.username,
        teacher.email,
        teacher.displayName,
      ]
        .map((value) => this.normalizeText(value).toLowerCase())
        .some((value) => value.includes(keyword))
    );
  }

  toggleAdvisorSettings(): void {
    this.advisorSettingsOpen = !this.advisorSettingsOpen;
    if (this.advisorSettingsOpen && this.teachers.length === 0 && !this.teacherLoading) {
      this.loadTeachers();
    }
  }

  toggleTeacherAdvisor(teacher: TeacherAccount, enabled: boolean): void {
    const teacherId = this.resolveTeacherId(teacher);
    if (!teacherId) return;

    this.advisorUpdatingTeacherId = teacherId;
    this.teacherError = '';
    this.teacherApi
      .updateTeacherAdvisorEnabled(teacherId, !!enabled)
      .pipe(finalize(() => {
        this.advisorUpdatingTeacherId = null;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (response) => {
          const normalizedEnabled = !!response.advisorEnabled;
          this.teachers = this.teachers.map((item) =>
            this.resolveTeacherId(item) === teacherId
              ? { ...item, advisorEnabled: normalizedEnabled }
              : item
          );
          this.loadAdvisors();
        },
        error: (err: HttpErrorResponse) => {
          this.teacherError = this.extractErrorMessage(err) || '更新顾问设置失败。';
        },
      });
  }

  selectStudent(student: StudentAccount): void {
    const studentId = this.resolveStudentId(student);
    if (!studentId || studentId === this.selectedStudentId) return;
    this.selectedStudentId = studentId;
    this.records = [];
    this.remarkDraft = '';
    this.formOpen = false;
    this.form = this.createEmptyForm();
    this.loadRecords();
  }

  openAddRecord(): void {
    this.recordError = '';
    this.form = this.createEmptyForm();
    this.formOpen = true;
  }

  openEditRecord(record: ServiceProgressRecord): void {
    this.recordError = '';
    this.form = {
      id: this.toOptionalNumber(record.id),
      appointmentTime: this.toDateTimeLocalValue(record.appointmentTime),
      advisorId: this.toOptionalNumber(record.advisorId),
      followUpContent: this.normalizeText(record.followUpContent),
      nextPlan: this.normalizeText(record.nextPlan),
    };
    this.formOpen = true;
  }

  closeForm(): void {
    if (this.saving) return;
    this.formOpen = false;
    this.form = this.createEmptyForm();
  }

  saveRemark(): void {
    if (!this.selectedStudentId) return;
    this.saving = true;
    this.recordError = '';
    this.serviceProgressApi
      .updateStudentRemark(this.selectedStudentId, this.remarkDraft)
      .pipe(finalize(() => {
        this.saving = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (state) => {
          this.remarkDraft = this.normalizeText(state.studentRemark);
          this.records = this.normalizeRecords(state.records);
        },
        error: (err: HttpErrorResponse) => {
          this.recordError = this.extractErrorMessage(err) || '保存学生备注失败。';
        },
      });
  }

  saveRecord(): void {
    if (!this.selectedStudentId) return;
    const payload = this.buildPayload();
    if (!payload) return;

    this.saving = true;
    this.recordError = '';
    const request$ = this.form.id
      ? this.serviceProgressApi.updateRecord(this.form.id, payload)
      : this.serviceProgressApi.createRecord(this.selectedStudentId, payload);

    request$
      .pipe(finalize(() => {
        this.saving = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => {
          this.formOpen = false;
          this.form = this.createEmptyForm();
          this.loadRecords();
        },
        error: (err: HttpErrorResponse) => {
          this.recordError = this.extractErrorMessage(err) || '保存服务记录失败。';
        },
      });
  }

  deleteRecord(record: ServiceProgressRecord): void {
    const recordId = this.toOptionalNumber(record.id);
    if (!recordId) return;
    if (!confirm('确定删除这条服务记录吗？')) return;

    this.saving = true;
    this.recordError = '';
    this.serviceProgressApi
      .deleteRecord(recordId)
      .pipe(finalize(() => {
        this.saving = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => this.loadRecords(),
        error: (err: HttpErrorResponse) => {
          this.recordError = this.extractErrorMessage(err) || '删除服务记录失败。';
        },
      });
  }

  resolveStudentId(student: StudentAccount | null | undefined): number | null {
    return this.toOptionalNumber(student?.studentId ?? student?.id ?? student?.userId);
  }

  displayStudentName(student: StudentAccount): string {
    const fullName = [student.firstName, student.lastName]
      .map((part) => this.normalizeText(part))
      .filter(Boolean)
      .join(' ');
    return this.normalizeText(student.displayName) || fullName || this.normalizeText(student.username) || `学生 #${this.resolveStudentId(student) || '-'}`;
  }

  displayStudentMeta(student: StudentAccount): string {
    return [student.email, student.phone].map((value) => this.normalizeText(value)).filter(Boolean).join(' · ') || '无联系方式';
  }

  displayTeacherName(teacher: TeacherAccount): string {
    const fullName = [teacher.firstName, teacher.lastName]
      .map((part) => this.normalizeText(part))
      .filter(Boolean)
      .join(' ');
    return this.normalizeText(teacher.displayName) || fullName || this.normalizeText(teacher.username) || `老师 #${this.resolveTeacherId(teacher) || '-'}`;
  }

  displayTeacherMeta(teacher: TeacherAccount): string {
    return [teacher.email, teacher.username].map((value) => this.normalizeText(value)).filter(Boolean).join(' · ') || '无账号信息';
  }

  isAdvisorEnabled(teacher: TeacherAccount): boolean {
    return !!teacher.advisorEnabled;
  }

  resolveTeacherId(teacher: TeacherAccount | null | undefined): number | null {
    return this.toOptionalNumber(teacher?.teacherId ?? teacher?.id ?? teacher?.userId);
  }

  displayAdvisorName(advisor: ServiceProgressAdvisor): string {
    return this.normalizeText(advisor.displayName) || this.normalizeText(advisor.username) || `#${this.resolveAdvisorId(advisor) || '-'}`;
  }

  advisorName(advisorId: number | null | undefined): string {
    const id = this.toOptionalNumber(advisorId);
    if (!id) return '-';
    const advisor = this.advisors.find((item) => this.resolveAdvisorId(item) === id);
    return advisor ? this.displayAdvisorName(advisor) : `#${id}`;
  }

  resolveAdvisorId(advisor: ServiceProgressAdvisor): number | null {
    return this.toOptionalNumber(advisor.teacherId ?? advisor.id);
  }

  displayDateTime(value: unknown): string {
    const raw = this.normalizeText(value);
    if (!raw) return '-';
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw.replace('T', ' ').slice(0, 16);
    return parsed.toLocaleString();
  }

  displayMultiline(value: unknown): string {
    return this.normalizeText(value) || '-';
  }

  trackStudent = (_index: number, student: StudentAccount): number | string =>
    this.resolveStudentId(student) ?? student.username ?? _index;

  trackTeacher = (_index: number, teacher: TeacherAccount): number | string =>
    this.resolveTeacherId(teacher) ?? teacher.username ?? _index;

  private loadStudents(): void {
    this.studentLoading = true;
    this.studentError = '';
    this.studentApi
      .listStudents()
      .pipe(finalize(() => {
        this.studentLoading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (payload) => {
          this.students = this.normalizeStudents(payload);
          const queryStudentId = this.toOptionalNumber(this.route.snapshot.queryParamMap.get('studentId'));
          const initialStudent =
            this.students.find((student) => this.resolveStudentId(student) === queryStudentId) ??
            this.students[0] ??
            null;
          if (initialStudent) {
            this.selectedStudentId = this.resolveStudentId(initialStudent);
            this.loadRecords();
          }
        },
        error: (err: HttpErrorResponse) => {
          this.studentError = this.extractErrorMessage(err) || '加载学生列表失败。';
          this.students = [];
        },
      });
  }

  private loadRecords(): void {
    if (!this.selectedStudentId) return;
    this.recordLoading = true;
    this.recordError = '';
    this.serviceProgressApi
      .getStudentServiceProgress(this.selectedStudentId)
      .pipe(finalize(() => {
        this.recordLoading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (state) => {
          this.remarkDraft = this.normalizeText(state.studentRemark);
          this.records = this.normalizeRecords(state.records);
        },
        error: (err: HttpErrorResponse) => {
          this.recordError = this.extractErrorMessage(err) || '加载服务进度档失败。';
          this.records = [];
        },
      });
  }

  private loadAdvisors(): void {
    this.serviceProgressApi.listAdvisors().subscribe({
      next: (payload) => {
        this.advisors = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.items)
              ? payload.items
              : [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.advisors = [];
        this.cdr.detectChanges();
      },
    });
  }

  private loadTeachers(): void {
    this.teacherLoading = true;
    this.teacherError = '';
    this.teacherApi
      .listTeachers()
      .pipe(finalize(() => {
        this.teacherLoading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (payload) => {
          this.teachers = this.normalizeTeachers(payload);
        },
        error: (err: HttpErrorResponse) => {
          this.teacherError = this.extractErrorMessage(err) || '加载老师列表失败。';
          this.teachers = [];
        },
      });
  }

  private normalizeStudents(payload: StudentAccount[] | { items?: StudentAccount[]; data?: StudentAccount[] }): StudentAccount[] {
    const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : payload?.items ?? [];
    return rows
      .filter((student) => !!this.resolveStudentId(student))
      .sort((a, b) => this.displayStudentName(a).localeCompare(this.displayStudentName(b)));
  }

  private normalizeTeachers(payload: TeacherAccount[] | { items?: TeacherAccount[]; data?: TeacherAccount[] }): TeacherAccount[] {
    const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : payload?.items ?? [];
    return rows
      .filter((teacher) => !!this.resolveTeacherId(teacher))
      .sort((a, b) => this.displayTeacherName(a).localeCompare(this.displayTeacherName(b)));
  }

  private normalizeRecords(records: ServiceProgressRecord[] | null | undefined): ServiceProgressRecord[] {
    if (!Array.isArray(records)) return [];
    return records
      .map((record) => ({
        ...record,
        id: this.toOptionalNumber(record.id) || undefined,
        advisorId: this.toOptionalNumber(record.advisorId) || undefined,
        appointmentTime: this.normalizeText(record.appointmentTime),
        advisorName: this.normalizeText(record.advisorName),
        followUpContent: this.normalizeText(record.followUpContent),
        nextPlan: this.normalizeText(record.nextPlan),
        createdAt: this.normalizeText(record.createdAt),
        updatedAt: this.normalizeText(record.updatedAt),
      }))
      .sort((a, b) => this.normalizeText(b.appointmentTime).localeCompare(this.normalizeText(a.appointmentTime)));
  }

  private buildPayload(): ServiceProgressRecordRequest | null {
    const appointmentTime = this.normalizeText(this.form.appointmentTime);
    const advisorId = this.toOptionalNumber(this.form.advisorId);
    if (!appointmentTime) {
      this.recordError = '请填写约见时间。';
      return null;
    }
    if (!advisorId) {
      this.recordError = '请选择约见顾问。';
      return null;
    }
    return {
      appointmentTime,
      advisorId,
      followUpContent: this.normalizeText(this.form.followUpContent),
      nextPlan: this.normalizeText(this.form.nextPlan),
    };
  }

  private createEmptyForm(): ServiceProgressFormModel {
    return {
      id: null,
      appointmentTime: '',
      advisorId: null,
      followUpContent: '',
      nextPlan: '',
    };
  }

  private toDateTimeLocalValue(value: unknown): string {
    const raw = this.normalizeText(value);
    if (!raw) return '';
    return raw.length >= 16 ? raw.slice(0, 16) : raw;
  }

  private toOptionalNumber(value: unknown): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.trunc(parsed);
  }

  private normalizeText(value: unknown): string {
    return value === null || value === undefined ? '' : String(value).trim();
  }

  private extractErrorMessage(error: HttpErrorResponse): string {
    const payload = error.error;
    if (typeof payload === 'string') return payload;
    if (payload && typeof payload === 'object') {
      const message = (payload as { message?: unknown; error?: unknown }).message ?? (payload as { error?: unknown }).error;
      if (message) return String(message);
    }
    return '';
  }
}
