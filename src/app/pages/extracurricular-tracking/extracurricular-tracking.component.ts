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
import { navigateBack } from '../../utils/navigate-back';

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
            <h2>{{ teacherMode ? '教师课外活动记录' : '我的课外活动' }}</h2>
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
            <div>
              <strong>{{ teacherMode ? '学生课外活动' : '课外活动' }}</strong>
              <p class="sub-title">已填写的活动会显示在这里，新增和编辑请在弹窗中完成。</p>
            </div>
            <button type="button" class="primary-btn" (click)="openAddActivityModal()" [disabled]="saving">
              新增活动
            </button>
          </div>

          <div *ngIf="noteDraft" class="record-note readonly-note">{{ noteDraft }}</div>

          <div *ngIf="displayedActivities.length > 0; else emptyActivities" class="activity-read-list">
            <article class="activity-read-card" *ngFor="let activity of displayedActivities; let index = index; trackBy: trackActivity">
              <div class="activity-read-head">
                <div>
                  <strong>{{ activity.activityName || '未命名活动' }}</strong>
                  <div class="record-meta">
                    <span>{{ activityTypeLabel(activity.activityType) }}</span>
                    <span>{{ activityDateLabel(activity) }}</span>
                    <span *ngIf="activity.activityLevel">{{ activityLevelLabel(activity.activityLevel) }}</span>
                  </div>
                </div>
                <div class="activity-card-actions">
                  <button type="button" class="ghost-btn compact" (click)="openEditActivityModal(index)" [disabled]="saving">
                    编辑
                  </button>
                  <button type="button" class="ghost-btn compact danger" (click)="deleteActivity(index)" [disabled]="saving">
                    删除
                  </button>
                </div>
              </div>

              <dl class="activity-detail-grid">
                <div *ngIf="activity.organization">
                  <dt>主办方 / 机构</dt>
                  <dd>{{ activity.organization }}</dd>
                </div>
                <div *ngIf="activity.role">
                  <dt>角色 / 身份</dt>
                  <dd>{{ activity.role }}</dd>
                </div>
                <div *ngIf="activity.awardOrResult">
                  <dt>奖项 / 成绩</dt>
                  <dd>{{ activity.awardOrResult }}</dd>
                </div>
                <div *ngIf="activity.proofContact">
                  <dt>证明人 / 联系方式</dt>
                  <dd>{{ activity.proofContact }}</dd>
                </div>
                <div class="span-2" *ngIf="activity.description">
                  <dt>活动内容</dt>
                  <dd>{{ activity.description }}</dd>
                </div>
              </dl>
            </article>
          </div>

          <ng-template #emptyActivities>
            <div class="state-text empty-activity-state">暂无课外活动，请点击“新增活动”添加第一条。</div>
          </ng-template>
        </section>

        <section class="record-list" *ngIf="!loading && records.length > 1">
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
            <button type="button" class="ghost-btn compact" (click)="loadRecordToEditor(record)" [disabled]="saving">
              载入此记录
            </button>
          </article>
        </section>
      </div>
    </div>

    <div class="modal-backdrop" *ngIf="activityModalOpen" (click)="closeActivityModal()"></div>
    <section class="activity-modal" *ngIf="activityModalOpen" role="dialog" aria-modal="true" aria-label="课外活动编辑窗口">
      <div class="activity-modal-head">
        <strong>{{ editingActivityIndex === null ? '新增课外活动' : '编辑课外活动' }}</strong>
        <button type="button" class="ghost-btn compact" (click)="closeActivityModal()" [disabled]="saving">关闭</button>
      </div>

      <div class="task-grid modal-grid">
        <label>
          活动类型
          <select
            [(ngModel)]="activityDraft.activityType"
            [disabled]="saving"
            (ngModelChange)="onActivityTypeChange(activityDraft)"
          >
            <option *ngFor="let option of activityTypeOptions" [ngValue]="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
        <label>
          活动名称
          <input [(ngModel)]="activityDraft.activityName" [disabled]="saving" />
        </label>
        <label>
          主办方 / 机构
          <input [(ngModel)]="activityDraft.organization" [disabled]="saving" />
        </label>
        <label>
          角色 / 身份
          <input [(ngModel)]="activityDraft.role" [disabled]="saving" />
        </label>
        <label>
          活动级别
          <select [(ngModel)]="activityDraft.activityLevel" [disabled]="saving">
            <option *ngFor="let option of activityLevelOptions" [ngValue]="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
        <label>
          奖项 / 成绩
          <input [(ngModel)]="activityDraft.awardOrResult" [disabled]="saving" />
        </label>

        <ng-container *ngIf="activityDraft.activityType === 'COMPETITION'; else modalRangeDates">
          <label>
            竞赛日期
            <input [(ngModel)]="activityDraft.activityDate" [disabled]="saving" type="date" />
          </label>
        </ng-container>
        <ng-template #modalRangeDates>
          <label>
            开始日期
            <input [(ngModel)]="activityDraft.startDate" [disabled]="saving" type="date" />
          </label>
          <label>
            结束日期
            <input [(ngModel)]="activityDraft.endDate" [disabled]="saving" type="date" />
          </label>
        </ng-template>

        <label class="span-2">
          活动内容
          <textarea [(ngModel)]="activityDraft.description" [disabled]="saving" rows="3"></textarea>
        </label>
        <label>
          证明人 / 联系方式
          <input [(ngModel)]="activityDraft.proofContact" [disabled]="saving" />
        </label>
      </div>

      <div class="editor-footer modal-footer">
        <button type="button" class="ghost-btn" (click)="closeActivityModal()" [disabled]="saving">取消</button>
        <button type="button" class="primary-btn" (click)="saveActivityDraft()" [disabled]="saving">
          {{ saving ? '保存中...' : '保存活动' }}
        </button>
      </div>
    </section>
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
  activityModalOpen = false;
  editingActivityIndex: number | null = null;
  activityDraft: ActivityDraft = this.createEmptyActivity();

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

  get displayedActivities(): ExtracurricularActivityVm[] {
    return this.meaningfulEditorActivities;
  }

  refresh(): void {
    this.loadTracking();
  }

  openAddActivityModal(): void {
    this.error = '';
    this.successMessage = '';
    this.editingActivityIndex = null;
    this.activityDraft = this.createEmptyActivity();
    this.activityModalOpen = true;
  }

  openEditActivityModal(index: number): void {
    const activity = this.editorActivities[index];
    if (!activity) return;
    this.error = '';
    this.successMessage = '';
    this.editingActivityIndex = index;
    this.activityDraft = { ...activity };
    this.activityModalOpen = true;
  }

  closeActivityModal(): void {
    if (this.saving) return;
    this.activityModalOpen = false;
    this.editingActivityIndex = null;
    this.activityDraft = this.createEmptyActivity();
  }

  saveActivityDraft(): void {
    const activity = this.toActivityVm(this.activityDraft);
    if (!this.isMeaningful(activity)) {
      this.error = '请至少填写活动名称、机构、奖项、内容或日期。';
      return;
    }

    const nextActivities = [...this.editorActivities];
    if (this.editingActivityIndex === null) {
      nextActivities.push({ ...this.activityDraft });
    } else {
      nextActivities[this.editingActivityIndex] = { ...this.activityDraft };
    }
    this.editorActivities = nextActivities;
    this.saveTracking(true);
  }

  deleteActivity(index: number): void {
    if (!this.editorActivities[index]) return;
    this.editorActivities = this.editorActivities.filter((_, currentIndex) => currentIndex !== index);
    this.saveTracking();
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

  saveTracking(closeModalAfterSave = false): void {
    const activities = this.meaningfulEditorActivities;

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
          if (closeModalAfterSave) {
            this.activityModalOpen = false;
            this.editingActivityIndex = null;
            this.activityDraft = this.createEmptyActivity();
          }
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
    navigateBack(this.router, this.teacherMode ? ['/teacher/extracurricular'] : ['/dashboard']);
  }

  trackActivity = (index: number): number => index;
  trackRecord = (_: number, record: ExtracurricularTrackingRecordVm): number => record.id;

  activityTypeLabel(type: ExtracurricularActivityType): string {
    return this.activityTypeOptions.find((option) => option.value === type)?.label || type;
  }

  activityLevelLabel(level: ExtracurricularActivityLevel): string {
    return this.activityLevelOptions.find((option) => option.value === level)?.label || level;
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
          this.editorActivities = [];
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
      this.editorActivities = [];
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
