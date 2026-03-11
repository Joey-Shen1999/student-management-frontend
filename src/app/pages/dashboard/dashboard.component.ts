import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { AuthService, type LoginResponse } from '../../services/auth.service';
import {
  type GoalTaskStatus,
  type GoalTaskVm,
  type InfoTaskCategory,
  type InfoTaskVm,
  TaskCenterService,
} from '../../services/task-center.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dashboard-page">
      <div class="dashboard-shell">
        <div class="dashboard-header">
          <div>
            <h2>Student Dashboard</h2>
            <p>Goal 和 Info 会直接显示在首页，便于你快速跟进。</p>
          </div>
          <button type="button" class="action-btn ghost" (click)="logout()">Sign Out</button>
        </div>

        <section class="dashboard-card">
          <div class="section-head">
            <h3>近期目标 Goals</h3>
            <button
              type="button"
              class="action-btn ghost compact"
              (click)="refreshGoals()"
              [disabled]="goalLoading || updatingGoalId !== null"
            >
              {{ goalLoading ? '刷新中...' : '刷新' }}
            </button>
          </div>

          <div *ngIf="goalLoading" class="state-text">正在加载目标任务...</div>

          <div *ngIf="!goalLoading && goalError" class="error-banner">
            <span>{{ goalError }}</span>
            <button type="button" class="action-btn ghost compact" (click)="refreshGoals()">重试</button>
          </div>

          <div *ngIf="!goalLoading && !goalError && goalItems.length === 0" class="state-text">
            当前没有 Goal 任务。
          </div>

          <div *ngIf="!goalLoading && !goalError && goalItems.length > 0" class="goal-list">
            <article class="goal-item" *ngFor="let goal of goalItems; trackBy: trackGoal">
              <div class="goal-row">
                <h4 class="goal-title">{{ goal.title }}</h4>
                <span [class]="goalStatusClass(goal.status)">{{ goalStatusLabel(goal.status) }}</span>
              </div>

              <p class="goal-desc">{{ goal.description }}</p>

              <div class="goal-meta">
                <span>截止：{{ displayDueAt(goal) }}</span>
                <span *ngIf="isOverdue(goal)" class="goal-overdue">已逾期</span>
                <span>更新：{{ displayUpdatedAt(goal.updatedAt) }}</span>
              </div>

              <div class="goal-actions">
                <button
                  type="button"
                  class="action-btn secondary compact"
                  *ngIf="canStart(goal)"
                  (click)="startGoal(goal)"
                  [disabled]="updatingGoalId === goal.id"
                >
                  {{ updatingGoalId === goal.id ? '处理中...' : '开始任务' }}
                </button>

                <button
                  type="button"
                  class="action-btn primary compact"
                  *ngIf="canComplete(goal)"
                  (click)="markGoalCompleted(goal)"
                  [disabled]="updatingGoalId === goal.id"
                >
                  {{ updatingGoalId === goal.id ? '处理中...' : '标记完成' }}
                </button>

                <button
                  type="button"
                  class="action-btn ghost compact"
                  *ngIf="canReopen(goal)"
                  (click)="reopenGoal(goal)"
                  [disabled]="updatingGoalId === goal.id"
                >
                  {{ updatingGoalId === goal.id ? '处理中...' : '重新打开' }}
                </button>
              </div>
            </article>
          </div>
        </section>

        <section class="dashboard-card">
          <div class="section-head">
            <h3>信息 Info</h3>
            <button
              type="button"
              class="action-btn ghost compact"
              (click)="refreshInfos()"
              [disabled]="infoLoading || infoUpdatingId !== null"
            >
              {{ infoLoading ? '刷新中...' : '刷新' }}
            </button>
          </div>

          <div class="info-filters">
            <select
              [disabled]="infoLoading"
              [value]="infoCategoryFilter"
              (change)="onInfoCategoryChange($any($event.target).value)"
            >
              <option value="ALL">全部分类</option>
              <option value="ACTIVITY">活动</option>
              <option value="VOLUNTEER">义工</option>
            </select>

            <input
              type="search"
              [disabled]="infoLoading"
              [value]="infoTagFilter"
              placeholder="按 tag 过滤（例如 Volunteer）"
              (input)="onInfoTagInput($any($event.target).value)"
            />

            <button
              type="button"
              class="action-btn ghost compact"
              (click)="toggleUnreadOnly()"
              [disabled]="infoLoading"
            >
              {{ infoUnreadOnly ? '仅未读' : '全部' }}
            </button>
          </div>

          <div *ngIf="infoLoading" class="state-text">正在加载信息...</div>

          <div *ngIf="!infoLoading && infoError" class="error-banner">
            <span>{{ infoError }}</span>
            <button type="button" class="action-btn ghost compact" (click)="refreshInfos()">重试</button>
          </div>

          <div *ngIf="!infoLoading && !infoError && infoItems.length === 0" class="state-text">
            当前没有符合筛选条件的信息。
          </div>

          <div *ngIf="!infoLoading && !infoError && infoItems.length > 0" class="info-list">
            <article class="info-item" *ngFor="let info of infoItems; trackBy: trackInfo">
              <div class="info-head">
                <h4>{{ info.title }}</h4>
                <span [class]="'info-badge ' + info.category.toLowerCase()">
                  {{ infoCategoryLabel(info.category) }}
                </span>
              </div>

              <p class="info-content">{{ info.content }}</p>

              <div class="info-tags" *ngIf="info.tags.length > 0">
                <span class="info-tag" *ngFor="let tag of info.tags">#{{ tag }}</span>
              </div>

              <div class="info-meta">
                <span>发布时间：{{ displayUpdatedAt(info.createdAt) }}</span>
                <span>发布老师：{{ info.publishedByTeacherName }}</span>
                <span>覆盖学生：{{ info.targetStudentCount }}</span>
              </div>

              <div class="info-actions">
                <button
                  type="button"
                  class="action-btn secondary compact"
                  (click)="markInfoRead(info)"
                  [disabled]="info.read || infoUpdatingId === info.id"
                >
                  {{ infoUpdatingId === info.id ? '处理中...' : (info.read ? '已读' : '标记已读') }}
                </button>
              </div>
            </article>
          </div>
        </section>

        <section class="dashboard-card">
          <h3>Quick Actions</h3>
          <div class="quick-actions">
            <button type="button" class="action-btn primary" (click)="goProfile()">Student Profile</button>
            <button type="button" class="action-btn secondary" (click)="goAccount()">
              Account Settings
            </button>
          </div>
        </section>
      </div>
    </div>
  `,
  styleUrl: './dashboard.scss',
})
export class DashboardComponent implements OnInit {
  session: LoginResponse | null;

  goalLoading = false;
  goalError = '';
  goalItems: GoalTaskVm[] = [];
  updatingGoalId: number | null = null;

  infoLoading = false;
  infoError = '';
  infoItems: InfoTaskVm[] = [];
  infoUpdatingId: number | null = null;
  infoCategoryFilter: InfoTaskCategory | 'ALL' = 'ALL';
  infoTagFilter = '';
  infoUnreadOnly = false;

  private goalLoadWatchdog: number | null = null;
  private infoLoadWatchdog: number | null = null;

  constructor(
    private auth: AuthService,
    private router: Router,
    private taskCenter: TaskCenterService,
    private cdr: ChangeDetectorRef = { detectChanges: () => {} } as ChangeDetectorRef
  ) {
    this.session = this.auth.getSession();
  }

  ngOnInit(): void {
    this.loadGoals();
    this.loadInfos();
  }

  goProfile() {
    this.router.navigate(['/student/profile']);
  }

  goAccount() {
    this.router.navigate(['/account']);
  }

  refreshGoals(): void {
    this.loadGoals();
  }

  refreshInfos(): void {
    this.loadInfos();
  }

  onInfoCategoryChange(value: string): void {
    const normalized = String(value || '').trim().toUpperCase();
    this.infoCategoryFilter =
      normalized === 'ACTIVITY' || normalized === 'VOLUNTEER'
        ? (normalized as InfoTaskCategory)
        : 'ALL';
    this.loadInfos();
  }

  onInfoTagInput(value: string): void {
    this.infoTagFilter = String(value || '');
    this.loadInfos();
  }

  toggleUnreadOnly(): void {
    this.infoUnreadOnly = !this.infoUnreadOnly;
    this.loadInfos();
  }

  startGoal(goal: GoalTaskVm): void {
    this.updateGoalStatus(goal, 'IN_PROGRESS');
  }

  markGoalCompleted(goal: GoalTaskVm): void {
    this.updateGoalStatus(goal, 'COMPLETED');
  }

  reopenGoal(goal: GoalTaskVm): void {
    this.updateGoalStatus(goal, 'IN_PROGRESS');
  }

  markInfoRead(info: InfoTaskVm): void {
    if (this.infoUpdatingId !== null || info.read) return;

    this.infoUpdatingId = info.id;
    this.infoError = '';
    this.cdr.detectChanges();

    this.taskCenter
      .markMyInfoAsRead(info.id)
      .pipe(
        finalize(() => {
          this.infoUpdatingId = null;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (updatedInfo) => {
          this.infoItems = this.infoItems.map((row) => (row.id === updatedInfo.id ? updatedInfo : row));
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.infoError = this.extractErrorMessage(error) || '更新信息状态失败。';
          this.cdr.detectChanges();
        },
      });
  }

  trackGoal = (_index: number, goal: GoalTaskVm): number => goal.id;
  trackInfo = (_index: number, info: InfoTaskVm): number => info.id;

  goalStatusLabel(status: GoalTaskStatus): string {
    if (status === 'NOT_STARTED') return '未开始';
    if (status === 'IN_PROGRESS') return '进行中';
    return '已完成';
  }

  goalStatusClass(status: GoalTaskStatus): string {
    if (status === 'NOT_STARTED') return 'goal-status not-started';
    if (status === 'IN_PROGRESS') return 'goal-status in-progress';
    return 'goal-status completed';
  }

  infoCategoryLabel(category: InfoTaskCategory): string {
    return category === 'VOLUNTEER' ? '义工' : '活动';
  }

  displayDueAt(goal: GoalTaskVm): string {
    if (!goal.dueAt) return '无截止日期';

    const timestamp = Date.parse(goal.dueAt);
    if (!Number.isFinite(timestamp)) {
      return goal.dueAt;
    }

    return new Date(timestamp).toLocaleDateString();
  }

  displayUpdatedAt(value: string): string {
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) {
      return value || '-';
    }

    return new Date(timestamp).toLocaleString();
  }

  isOverdue(goal: GoalTaskVm): boolean {
    if (goal.status === 'COMPLETED' || !goal.dueAt) return false;

    const date = new Date(goal.dueAt);
    if (Number.isNaN(date.getTime())) return false;

    date.setHours(23, 59, 59, 999);
    return date.getTime() < Date.now();
  }

  canStart(goal: GoalTaskVm): boolean {
    return goal.status === 'NOT_STARTED';
  }

  canComplete(goal: GoalTaskVm): boolean {
    return goal.status === 'IN_PROGRESS';
  }

  canReopen(goal: GoalTaskVm): boolean {
    return goal.status === 'COMPLETED';
  }

  logout() {
    this.auth.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: () => {
        this.auth.clearAuthState();
        this.router.navigate(['/login']);
      },
    });
  }

  private loadGoals(): void {
    this.goalLoading = true;
    this.goalError = '';
    this.startGoalLoadWatchdog();
    this.cdr.detectChanges();

    this.taskCenter
      .listMyGoals({ status: 'ALL', page: 1, size: 8 })
      .pipe(
        finalize(() => {
          this.goalLoading = false;
          this.clearGoalLoadWatchdog();
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (resp) => {
          this.goalItems = this.sortGoals(resp.items || []);
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.goalError = this.extractErrorMessage(error) || '加载目标任务失败。';
          this.goalItems = [];
          this.cdr.detectChanges();
        },
      });
  }

  private loadInfos(): void {
    this.infoLoading = true;
    this.infoError = '';
    this.startInfoLoadWatchdog();
    this.cdr.detectChanges();

    this.taskCenter
      .listMyInfos({
        category: this.infoCategoryFilter,
        tag: this.infoTagFilter,
        unreadOnly: this.infoUnreadOnly,
        page: 1,
        size: 10,
      })
      .pipe(
        finalize(() => {
          this.infoLoading = false;
          this.clearInfoLoadWatchdog();
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (resp) => {
          this.infoItems = [...(resp.items || [])];
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.infoError = this.extractErrorMessage(error) || '加载信息列表失败。';
          this.infoItems = [];
          this.cdr.detectChanges();
        },
      });
  }

  private startGoalLoadWatchdog(): void {
    this.clearGoalLoadWatchdog();
    this.goalLoadWatchdog = window.setTimeout(() => {
      if (!this.goalLoading) return;
      this.goalLoading = false;
      if (!this.goalError) {
        this.goalError = '请求超时，请检查后端服务或网络连接。';
      }
      this.cdr.detectChanges();
    }, 15000);
  }

  private clearGoalLoadWatchdog(): void {
    if (this.goalLoadWatchdog === null) return;
    window.clearTimeout(this.goalLoadWatchdog);
    this.goalLoadWatchdog = null;
  }

  private startInfoLoadWatchdog(): void {
    this.clearInfoLoadWatchdog();
    this.infoLoadWatchdog = window.setTimeout(() => {
      if (!this.infoLoading) return;
      this.infoLoading = false;
      if (!this.infoError) {
        this.infoError = '请求超时，请检查后端服务或网络连接。';
      }
      this.cdr.detectChanges();
    }, 15000);
  }

  private clearInfoLoadWatchdog(): void {
    if (this.infoLoadWatchdog === null) return;
    window.clearTimeout(this.infoLoadWatchdog);
    this.infoLoadWatchdog = null;
  }

  private updateGoalStatus(goal: GoalTaskVm, status: GoalTaskStatus): void {
    if (this.updatingGoalId !== null) return;

    this.updatingGoalId = goal.id;
    this.goalError = '';
    this.cdr.detectChanges();

    this.taskCenter
      .updateMyGoalStatus(goal.id, {
        status,
        progressNote: status === 'COMPLETED' ? '学生已在主页面标记完成。' : goal.progressNote,
      })
      .pipe(
        finalize(() => {
          this.updatingGoalId = null;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (updatedGoal) => {
          const nextItems = this.goalItems.map((item) =>
            item.id === updatedGoal.id ? updatedGoal : item
          );
          this.goalItems = this.sortGoals(nextItems);
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.goalError = this.extractErrorMessage(error) || '更新任务状态失败。';
          this.cdr.detectChanges();
        },
      });
  }

  private sortGoals(items: GoalTaskVm[]): GoalTaskVm[] {
    return [...items].sort((a, b) => {
      const statusRankA = a.status === 'COMPLETED' ? 1 : 0;
      const statusRankB = b.status === 'COMPLETED' ? 1 : 0;
      if (statusRankA !== statusRankB) return statusRankA - statusRankB;

      const dueA = this.toSortableTimestamp(a.dueAt, Number.MAX_SAFE_INTEGER);
      const dueB = this.toSortableTimestamp(b.dueAt, Number.MAX_SAFE_INTEGER);
      if (dueA !== dueB) return dueA - dueB;

      const updatedA = this.toSortableTimestamp(a.updatedAt, 0);
      const updatedB = this.toSortableTimestamp(b.updatedAt, 0);
      return updatedB - updatedA;
    });
  }

  private toSortableTimestamp(value: string | null | undefined, fallback: number): number {
    const timestamp = Date.parse(String(value || ''));
    return Number.isFinite(timestamp) ? timestamp : fallback;
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
      statusText?: unknown;
    };

    if (obj.error && typeof obj.error === 'object') {
      const payload = obj.error as {
        message?: unknown;
        error?: unknown;
      };
      if (typeof payload.message === 'string' && payload.message.trim()) {
        return payload.message.trim();
      }
      if (typeof payload.error === 'string' && payload.error.trim()) {
        return payload.error.trim();
      }
    }

    if (typeof obj.error === 'string' && obj.error.trim()) {
      return obj.error.trim();
    }
    if (typeof obj.message === 'string' && obj.message.trim()) {
      return obj.message.trim();
    }

    const status = Number(obj.status);
    if (Number.isFinite(status) && status > 0) {
      return `请求失败（HTTP ${status}）。`;
    }

    return '';
  }
}
