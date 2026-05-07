import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import {
  type ExtracurricularActivityLevel,
  type ExtracurricularActivityType,
  type ExtracurricularActivityVm,
  type ExtracurricularTrackingRecordVm,
  type ExtracurricularTrackingStateVm,
  ExtracurricularTrackingService,
} from '../../services/extracurricular-tracking.service';

interface ActivityDraft {
  activityType: ExtracurricularActivityType;
  activityName: string;
  organization: string;
  role: string;
  activityLevel: ExtracurricularActivityLevel;
  awardOrResult: string;
  activityDate: string;
  startDate: string;
  endDate: string;
  description: string;
  proofContact: string;
}

@Component({
  selector: 'app-extracurricular-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="volunteer-page">
      <div class="volunteer-shell">
        <div class="header-row">
          <div>
            <h2>{{ teacherMode ? '教师课外活动跟踪' : '我的课外活动' }}</h2>
            <p class="sub-title" *ngIf="teacherMode">学生：{{ studentDisplayName }}</p>
          </div>
          <div class="header-actions">
            <button type="button" class="ghost-btn" (click)="refresh()" [disabled]="loading || saving">
              刷新
            </button>
            <button type="button" class="ghost-btn" (click)="goBack()">
              {{ teacherMode ? '返回列表' : '返回' }}
            </button>
          </div>
        </div>

        <section class="summary-card">
          <span>课外活动总数</span>
          <strong>{{ totalActivities }}</strong>
        </section>
        <section class="summary-card">
          <span>竞赛 / 奖项</span>
          <strong>{{ competitionCount }} / {{ awardCount }}</strong>
        </section>

        <div *ngIf="loading" class="state-text">正在加载课外活动记录...</div>
        <div *ngIf="!loading && error" class="error-banner">{{ error }}</div>
        <div *ngIf="successMessage" class="success-banner">{{ successMessage }}</div>

        <section class="editor-card" *ngIf="!loading">
          <div class="editor-head">
            <strong>{{ teacherMode ? '编辑课外活动记录' : '编辑我的课外活动' }}</strong>
            <div class="editor-actions">
              <button type="button" class="ghost-btn" (click)="addActivity()" [disabled]="saving">
                添加活动
              </button>
              <button type="button" class="ghost-btn" (click)="resetEditor()" [disabled]="saving">
                重置
              </button>
            </div>
          </div>

          <label class="field-label">
            总备注
            <textarea [(ngModel)]="noteDraft" [disabled]="saving" rows="2"></textarea>
          </label>

          <article class="task-card" *ngFor="let activity of editorActivities; let index = index; trackBy: trackActivity">
            <div class="task-head">
              <strong>活动 {{ index + 1 }}</strong>
              <button
                type="button"
                class="ghost-btn compact"
                (click)="removeActivity(index)"
                [disabled]="saving || editorActivities.length <= 1"
              >
                删除
              </button>
            </div>

            <div class="task-grid">
              <label>
                活动类型
                <select
                  [(ngModel)]="activity.activityType"
                  [disabled]="saving"
                  (ngModelChange)="onActivityTypeChange(activity)"
                >
                  <option *ngFor="let option of activityTypeOptions" [ngValue]="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </label>
              <label>
                活动名称
                <input [(ngModel)]="activity.activityName" [disabled]="saving" />
              </label>
              <label>
                主办方 / 机构
                <input [(ngModel)]="activity.organization" [disabled]="saving" />
              </label>
              <label>
                角色 / 身份
                <input [(ngModel)]="activity.role" [disabled]="saving" />
              </label>
              <label>
                活动级别
                <select [(ngModel)]="activity.activityLevel" [disabled]="saving">
                  <option *ngFor="let option of activityLevelOptions" [ngValue]="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </label>
              <label>
                奖项 / 成绩
                <input [(ngModel)]="activity.awardOrResult" [disabled]="saving" />
              </label>

              <ng-container *ngIf="activity.activityType === 'COMPETITION'; else rangeDates">
                <label>
                  竞赛日期
                  <input [(ngModel)]="activity.activityDate" [disabled]="saving" type="date" />
                </label>
              </ng-container>
              <ng-template #rangeDates>
                <label>
                  开始日期
                  <input [(ngModel)]="activity.startDate" [disabled]="saving" type="date" />
                </label>
                <label>
                  结束日期
                  <input [(ngModel)]="activity.endDate" [disabled]="saving" type="date" />
                </label>
              </ng-template>

              <label class="span-2">
                活动内容
                <textarea [(ngModel)]="activity.description" [disabled]="saving" rows="2"></textarea>
              </label>
              <label>
                证明人 / 联系方式
                <input [(ngModel)]="activity.proofContact" [disabled]="saving" />
              </label>
            </div>
          </article>

          <div class="editor-footer">
            <div class="editor-total">
              当前活动：{{ meaningfulEditorActivities.length }} 条，竞赛 {{ editorCompetitionCount }} 条
            </div>
            <button type="button" class="primary-btn" (click)="saveTracking()" [disabled]="saving">
              {{ saving ? '保存中...' : '保存课外活动' }}
            </button>
          </div>
        </section>

        <section class="record-list" *ngIf="!loading && records.length > 0">
          <h3>历史记录</h3>
          <article class="record-card" *ngFor="let record of records; trackBy: trackRecord">
            <div class="record-head">
              <strong>{{ record.title }}</strong>
              <span class="record-hours">{{ record.totalActivities }} 条</span>
            </div>
            <div class="record-meta">
              <span>竞赛：{{ record.competitionCount }}</span>
              <span>奖项：{{ record.awardCount }}</span>
              <span>更新时间：{{ displayDateTime(record.updatedAt) }}</span>
              <span *ngIf="record.updatedByTeacherName">最近更新老师：{{ record.updatedByTeacherName }}</span>
            </div>
            <p *ngIf="record.note" class="record-note">{{ record.note }}</p>

            <div *ngIf="record.activities.length > 0" class="record-tasks">
              <div class="record-task" *ngFor="let activity of record.activities; let activityIndex = index">
                <strong>{{ activityIndex + 1 }}. {{ activity.activityName || '未命名活动' }}</strong>
                <span>{{ activityTypeLabel(activity.activityType) }}</span>
                <span>{{ activityDateLabel(activity) }}</span>
                <span *ngIf="activity.awardOrResult">{{ activity.awardOrResult }}</span>
              </div>
            </div>

            <button type="button" class="ghost-btn compact" (click)="loadRecordToEditor(record)" [disabled]="saving">
              载入到编辑区
            </button>
          </article>
        </section>

        <div *ngIf="!loading && !error && records.length === 0" class="state-text">
          暂无课外活动记录，请先新增一条。
        </div>
      </div>
    </div>
  `,
  styleUrl: '../student-volunteer/student-volunteer.component.scss',
})
export class ExtracurricularTrackingComponent implements OnInit {
  readonly activityTypeOptions: Array<{ value: ExtracurricularActivityType; label: string }> = [
    { value: 'COMPETITION', label: '竞赛成绩' },
    { value: 'PUBLIC_EVENT', label: '公开活动' },
    { value: 'SUMMER_CAMP', label: '夏令营' },
    { value: 'CLUB', label: '社团 / 学生组织' },
    { value: 'RESEARCH', label: '科研 / 项目' },
    { value: 'INTERNSHIP', label: '实习 / 工作体验' },
    { value: 'CERTIFICATE', label: '证书 / 奖项' },
    { value: 'OTHER', label: '其他' },
  ];
  readonly activityLevelOptions: Array<{ value: ExtracurricularActivityLevel; label: string }> = [
    { value: '', label: '未选择' },
    { value: 'SCHOOL', label: '校级' },
    { value: 'CITY', label: '市级' },
    { value: 'PROVINCE', label: '省级' },
    { value: 'NATIONAL', label: '国家级' },
    { value: 'INTERNATIONAL', label: '国际级' },
    { value: 'OTHER', label: '其他' },
  ];

  studentId = 0;
  teacherMode = false;
  studentDisplayName = '-';
  loading = false;
  saving = false;
  error = '';
  successMessage = '';
  noteDraft = '';
  records: ExtracurricularTrackingRecordVm[] = [];
  editorActivities: ActivityDraft[] = [this.createEmptyActivity()];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private extracurricularTracking: ExtracurricularTrackingService,
    private cdr: ChangeDetectorRef = { detectChanges: () => {} } as ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const routeStudentId = Number(this.route.snapshot.paramMap.get('studentId') || 0);
    this.studentId = Number.isFinite(routeStudentId) && routeStudentId > 0 ? Math.trunc(routeStudentId) : 0;
    this.teacherMode = this.studentId > 0;
    this.studentDisplayName = this.teacherMode ? `Student #${this.studentId}` : '-';
    this.loadTracking();
  }

  get totalActivities(): number {
    return this.records[0]?.totalActivities || this.meaningfulEditorActivities.length || 0;
  }

  get competitionCount(): number {
    return this.records[0]?.competitionCount || this.editorCompetitionCount || 0;
  }

  get awardCount(): number {
    return this.records[0]?.awardCount || this.meaningfulEditorActivities.filter((activity) => !!activity.awardOrResult).length;
  }

  get meaningfulEditorActivities(): ExtracurricularActivityVm[] {
    return this.editorActivities.map((activity) => this.toActivityVm(activity)).filter((activity) => this.isMeaningful(activity));
  }

  get editorCompetitionCount(): number {
    return this.meaningfulEditorActivities.filter((activity) => activity.activityType === 'COMPETITION').length;
  }

  refresh(): void {
    this.loadTracking();
  }

  addActivity(): void {
    this.editorActivities = [...this.editorActivities, this.createEmptyActivity()];
  }

  removeActivity(index: number): void {
    if (this.editorActivities.length <= 1) return;
    this.editorActivities = this.editorActivities.filter((_, currentIndex) => currentIndex !== index);
  }

  resetEditor(): void {
    const firstRecord = this.records[0];
    if (firstRecord) {
      this.loadRecordToEditor(firstRecord);
      return;
    }
    this.noteDraft = '';
    this.editorActivities = [this.createEmptyActivity()];
  }

  onActivityTypeChange(activity: ActivityDraft): void {
    if (activity.activityType === 'COMPETITION') {
      activity.startDate = '';
      activity.endDate = '';
      return;
    }
    activity.activityDate = '';
  }

  saveTracking(): void {
    const activities = this.meaningfulEditorActivities;
    if (activities.length <= 0) {
      this.error = '请至少填写一条课外活动。';
      return;
    }

    this.saving = true;
    this.error = '';
    this.successMessage = '';
    const request = { note: this.noteDraft.trim(), activities };
    const action$: Observable<ExtracurricularTrackingStateVm> = this.teacherMode
      ? this.extracurricularTracking.updateTeacherStudentExtracurricularTracking(this.studentId, request)
      : this.extracurricularTracking.updateMyExtracurricularTracking(request);

    action$
      .pipe(finalize(() => {
        this.saving = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (state) => {
          this.applyState(state);
          this.successMessage = '课外活动记录已保存。';
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.error = this.extractErrorMessage(error) || '保存课外活动记录失败。';
          this.cdr.detectChanges();
        },
      });
  }

  loadRecordToEditor(record: ExtracurricularTrackingRecordVm): void {
    this.noteDraft = record.note || '';
    this.editorActivities = record.activities.length > 0
      ? record.activities.map((activity) => this.toDraft(activity))
      : [this.createEmptyActivity()];
  }

  goBack(): void {
    this.router.navigate(this.teacherMode ? ['/teacher/students'] : ['/dashboard']);
  }

  trackActivity = (index: number): number => index;
  trackRecord = (_: number, record: ExtracurricularTrackingRecordVm): number => record.id;

  activityTypeLabel(type: ExtracurricularActivityType): string {
    return this.activityTypeOptions.find((option) => option.value === type)?.label || type;
  }

  activityDateLabel(activity: ExtracurricularActivityVm): string {
    if (activity.activityType === 'COMPETITION') return activity.activityDate || '-';
    if (activity.startDate && activity.endDate) return `${activity.startDate} 至 ${activity.endDate}`;
    return activity.startDate || activity.endDate || '-';
  }

  displayDateTime(value: string | null): string {
    if (!value) return '-';
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : value;
  }

  private loadTracking(): void {
    this.loading = true;
    this.error = '';
    this.successMessage = '';
    const action$: Observable<ExtracurricularTrackingStateVm> = this.teacherMode
      ? this.extracurricularTracking.getTeacherStudentExtracurricularTracking(this.studentId)
      : this.extracurricularTracking.getMyExtracurricularTracking();
    action$
      .pipe(finalize(() => {
        this.loading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (state) => {
          this.applyState(state);
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.error = this.extractErrorMessage(error) || '加载课外活动记录失败。';
          this.records = [];
          this.editorActivities = [this.createEmptyActivity()];
          this.cdr.detectChanges();
        },
      });
  }

  private applyState(state: ExtracurricularTrackingStateVm): void {
    this.records = state.records;
    this.noteDraft = state.note || state.records[0]?.note || '';
    if (state.activities.length > 0) {
      this.editorActivities = state.activities.map((activity) => this.toDraft(activity));
    } else if (state.records[0]?.activities?.length > 0) {
      this.editorActivities = state.records[0].activities.map((activity) => this.toDraft(activity));
    } else {
      this.editorActivities = [this.createEmptyActivity()];
    }
  }

  private toActivityVm(activity: ActivityDraft): ExtracurricularActivityVm {
    return {
      activityType: activity.activityType || 'COMPETITION',
      activityName: activity.activityName.trim(),
      organization: activity.organization.trim(),
      role: activity.role.trim(),
      activityLevel: activity.activityLevel || '',
      awardOrResult: activity.awardOrResult.trim(),
      competitionCategory: '',
      activityDate: activity.activityType === 'COMPETITION' ? activity.activityDate.trim() : '',
      startDate: activity.activityType === 'COMPETITION' ? '' : activity.startDate.trim(),
      endDate: activity.activityType === 'COMPETITION' ? '' : activity.endDate.trim(),
      description: activity.description.trim(),
      admissionRelevance: '',
      proofContact: activity.proofContact.trim(),
      proofUrl: '',
    };
  }

  private toDraft(activity: ExtracurricularActivityVm): ActivityDraft {
    return {
      activityType: activity.activityType || 'COMPETITION',
      activityName: activity.activityName || '',
      organization: activity.organization || '',
      role: activity.role || '',
      activityLevel: activity.activityLevel || '',
      awardOrResult: activity.awardOrResult || '',
      activityDate: activity.activityDate || '',
      startDate: activity.startDate || '',
      endDate: activity.endDate || '',
      description: activity.description || '',
      proofContact: activity.proofContact || '',
    };
  }

  private isMeaningful(activity: ExtracurricularActivityVm): boolean {
    return !!(
      activity.activityName ||
      activity.organization ||
      activity.awardOrResult ||
      activity.description ||
      activity.activityDate ||
      activity.startDate ||
      activity.endDate
    );
  }

  private createEmptyActivity(): ActivityDraft {
    return {
      activityType: 'COMPETITION',
      activityName: '',
      organization: '',
      role: '',
      activityLevel: '',
      awardOrResult: '',
      activityDate: '',
      startDate: '',
      endDate: '',
      description: '',
      proofContact: '',
    };
  }

  private extractErrorMessage(error: unknown): string {
    const root = (error || {}) as { error?: unknown; message?: unknown };
    const payload = root.error as { message?: unknown; error?: unknown } | string | undefined;
    if (typeof payload === 'string' && payload.trim()) return payload.trim();
    if (payload && typeof payload === 'object') {
      const message = String(payload.message || payload.error || '').trim();
      if (message) return message;
    }
    return String(root.message || '').trim();
  }
}
