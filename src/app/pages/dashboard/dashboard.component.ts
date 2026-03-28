import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { finalize, timeout } from 'rxjs/operators';

import { AuthService, type LoginResponse } from '../../services/auth.service';
import { StudentProfileService } from '../../services/student-profile.service';
import {
  type GoalTaskStatus,
  type GoalTaskVm,
  type InfoTaskCategory,
  type InfoTaskVm,
  TaskCenterService,
} from '../../services/task-center.service';

interface GoalTaskCardVm extends GoalTaskVm {
  statusLabel: string;
  statusClass: string;
  dueAtLabel: string;
  updatedAtLabel: string;
  overdue: boolean;
  canStart: boolean;
  canComplete: boolean;
  canReopen: boolean;
}

interface InfoTaskCardVm extends InfoTaskVm {
  categoryLabel: string;
  createdAtLabel: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dashboard-page" (click)="closePersonalMenu()">
      <div class="dashboard-shell">
        <div class="dashboard-header">
          <div>
            <h2>Student Dashboard</h2>
            <p>Welcome {{ welcomeDisplayName }}</p>
          </div>
          <div class="header-actions">
            <div class="profile-menu" (click)="$event.stopPropagation()">
              <button
                type="button"
                class="action-btn ghost personal-btn"
                (click)="togglePersonalMenu()"
              >
                {{ personalMenuLabel }}
              </button>

              <div class="profile-menu-panel" *ngIf="personalMenuOpen">
                <button type="button" class="profile-menu-item" (click)="goAccountProfileFromMenu()">
                  Name Settings
                </button>
                <button type="button" class="profile-menu-item" (click)="goAccountFromMenu()">
                  Password change
                </button>
                <button
                  type="button"
                  class="profile-menu-item danger"
                  [disabled]="signingOut"
                  (click)="logoutFromMenu()"
                >
                  {{ signingOut ? 'Signing out...' : 'Sign Out' }}
                </button>
              </div>
            </div>
          </div>
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
                <span [class]="goal.statusClass">{{ goal.statusLabel }}</span>
              </div>

              <p class="goal-desc">{{ goal.description }}</p>

              <div class="goal-meta">
                <span>截止：{{ goal.dueAtLabel }}</span>
                <span *ngIf="goal.overdue" class="goal-overdue">已逾期</span>
                <span>更新：{{ goal.updatedAtLabel }}</span>
              </div>

              <div class="goal-actions">
                <button
                  type="button"
                  class="action-btn secondary compact"
                  *ngIf="goal.canStart"
                  (click)="startGoal(goal)"
                  [disabled]="updatingGoalId === goal.id"
                >
                  {{ updatingGoalId === goal.id ? '处理中...' : '开始任务' }}
                </button>

                <button
                  type="button"
                  class="action-btn primary compact"
                  *ngIf="goal.canComplete"
                  (click)="markGoalCompleted(goal)"
                  [disabled]="updatingGoalId === goal.id"
                >
                  {{ updatingGoalId === goal.id ? '处理中...' : '标记完成' }}
                </button>

                <button
                  type="button"
                  class="action-btn ghost compact"
                  *ngIf="goal.canReopen"
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
                  {{ info.categoryLabel }}
                </span>
              </div>

              <p class="info-content">{{ info.content }}</p>

              <div class="info-tags" *ngIf="info.tags.length > 0">
                <span class="info-tag" *ngFor="let tag of info.tags">#{{ tag }}</span>
              </div>

              <div class="info-meta">
                <span>发布时间：{{ info.createdAtLabel }}</span>
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
  goalItems: GoalTaskCardVm[] = [];
  updatingGoalId: number | null = null;

  infoLoading = false;
  infoError = '';
  infoItems: InfoTaskCardVm[] = [];
  infoUpdatingId: number | null = null;
  infoCategoryFilter: InfoTaskCategory | 'ALL' = 'ALL';
  infoTagFilter = '';
  infoUnreadOnly = false;
  signingOut = false;
  personalMenuOpen = false;
  welcomeNameOverride = '';

  private goalLoadWatchdog: number | null = null;
  private infoLoadWatchdog: number | null = null;
  private infoTagDebounceTimer: number | null = null;
  private goalRequestSeq = 0;
  private infoRequestSeq = 0;
  private rawGoalItems: GoalTaskVm[] = [];
  private rawInfoItems: InfoTaskVm[] = [];
  private readonly welcomeNameTimeoutMs = 8000;

  constructor(
    private auth: AuthService,
    private router: Router,
    private taskCenter: TaskCenterService,
    private profileApi: StudentProfileService,
    private cdr: ChangeDetectorRef = { detectChanges: () => {} } as ChangeDetectorRef
  ) {
    this.session = this.auth.getSession();
  }

  get welcomeDisplayName(): string {
    if (this.welcomeNameOverride) return this.welcomeNameOverride;

    const source = this.toRecord(this.session) || {};
    const fromSession = this.resolveNameFromPayload(source);
    if (fromSession) return fromSession;

    return 'Student';
  }

  get personalMenuLabel(): string {
    return 'Account';
  }

  ngOnInit(): void {
    this.loadWelcomeNameIfNeeded();
    this.loadGoals();
    this.loadInfos();
  }

  ngOnDestroy(): void {
    this.clearGoalLoadWatchdog();
    this.clearInfoLoadWatchdog();
    this.clearInfoTagDebounce();
  }

  goProfile() {
    this.router.navigate(['/student/profile']);
  }

  goAccountProfile() {
    const nameParts = this.resolveNamePartsFromPayload(this.session);
    const resolvedName = this.toText(this.welcomeDisplayName);
    const navState: {
      currentFirstName?: string;
      currentLastName?: string;
      currentDisplayName?: string;
    } = {};

    if (nameParts.firstName) navState.currentFirstName = nameParts.firstName;
    if (nameParts.lastName) navState.currentLastName = nameParts.lastName;

    if (!navState.currentFirstName && !navState.currentLastName) {
      const tokenized = this.tokenizeName(this.welcomeNameOverride || resolvedName);
      if (tokenized.length >= 2) {
        navState.currentLastName = tokenized[0];
        navState.currentFirstName = tokenized.slice(1).join(' ');
      }
    }

    if (resolvedName && resolvedName.toLowerCase() !== 'student') {
      navState.currentDisplayName = resolvedName;
    }

    if (Object.keys(navState).length > 0) {
      this.router.navigate(['/account/profile'], { state: navState });
      return;
    }

    this.router.navigate(['/account/profile']);
  }

  goAccount() {
    this.router.navigate(['/account']);
  }

  goAccountFromMenu(): void {
    this.personalMenuOpen = false;
    this.goAccount();
  }

  goAccountProfileFromMenu(): void {
    this.personalMenuOpen = false;
    this.goAccountProfile();
  }

  refreshGoals(): void {
    this.loadGoals();
  }

  refreshInfos(): void {
    this.clearInfoTagDebounce();
    this.loadInfos();
  }

  onInfoCategoryChange(value: string): void {
    const normalized = String(value || '').trim().toUpperCase();
    this.infoCategoryFilter =
      normalized === 'ACTIVITY' || normalized === 'VOLUNTEER'
        ? (normalized as InfoTaskCategory)
        : 'ALL';
    this.clearInfoTagDebounce();
    this.loadInfos();
  }

  onInfoTagInput(value: string): void {
    this.infoTagFilter = String(value || '');
    this.scheduleInfoReload();
  }

  toggleUnreadOnly(): void {
    this.infoUnreadOnly = !this.infoUnreadOnly;
    this.clearInfoTagDebounce();
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
          this.rawInfoItems = this.rawInfoItems.map((row) =>
            row.id === updatedInfo.id ? updatedInfo : row
          );
          this.infoItems = this.toInfoCards(this.rawInfoItems);
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.infoError = this.extractErrorMessage(error) || '更新信息状态失败。';
          this.cdr.detectChanges();
        },
      });
  }

  trackGoal = (_index: number, goal: GoalTaskCardVm): number => goal.id;
  trackInfo = (_index: number, info: InfoTaskCardVm): number => info.id;

  private goalStatusLabel(status: GoalTaskStatus): string {
    if (status === 'NOT_STARTED') return '未开始';
    if (status === 'IN_PROGRESS') return '进行中';
    return '已完成';
  }

  private goalStatusClass(status: GoalTaskStatus): string {
    if (status === 'NOT_STARTED') return 'goal-status not-started';
    if (status === 'IN_PROGRESS') return 'goal-status in-progress';
    return 'goal-status completed';
  }

  private infoCategoryLabel(category: InfoTaskCategory): string {
    return category === 'VOLUNTEER' ? '义工' : '活动';
  }

  private displayDueAt(goal: GoalTaskVm): string {
    if (!goal.dueAt) return '无截止日期';

    const timestamp = Date.parse(goal.dueAt);
    if (!Number.isFinite(timestamp)) {
      return goal.dueAt;
    }

    return new Date(timestamp).toLocaleDateString();
  }

  private displayUpdatedAt(value: string): string {
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) {
      return value || '-';
    }

    return new Date(timestamp).toLocaleString();
  }

  private isOverdue(goal: GoalTaskVm): boolean {
    if (goal.status === 'COMPLETED' || !goal.dueAt) return false;

    const date = new Date(goal.dueAt);
    if (Number.isNaN(date.getTime())) return false;

    date.setHours(23, 59, 59, 999);
    return date.getTime() < Date.now();
  }

  private canStart(goal: GoalTaskVm): boolean {
    return goal.status === 'NOT_STARTED';
  }

  private canComplete(goal: GoalTaskVm): boolean {
    return goal.status === 'IN_PROGRESS';
  }

  private canReopen(goal: GoalTaskVm): boolean {
    return goal.status === 'COMPLETED';
  }

  private toGoalCards(items: GoalTaskVm[]): GoalTaskCardVm[] {
    return items.map((goal) => ({
      ...goal,
      statusLabel: this.goalStatusLabel(goal.status),
      statusClass: this.goalStatusClass(goal.status),
      dueAtLabel: this.displayDueAt(goal),
      updatedAtLabel: this.displayUpdatedAt(goal.updatedAt),
      overdue: this.isOverdue(goal),
      canStart: this.canStart(goal),
      canComplete: this.canComplete(goal),
      canReopen: this.canReopen(goal),
    }));
  }

  private toInfoCards(items: InfoTaskVm[]): InfoTaskCardVm[] {
    return items.map((info) => ({
      ...info,
      categoryLabel: this.infoCategoryLabel(info.category),
      createdAtLabel: this.displayUpdatedAt(info.createdAt),
    }));
  }

  logout() {
    if (this.signingOut) return;

    this.signingOut = true;
    this.auth
      .logout()
      .pipe(finalize(() => (this.signingOut = false)))
      .subscribe({
        next: () => {
          this.router.navigate(['/login']);
        },
        error: () => {
          this.auth.clearAuthState();
          this.router.navigate(['/login']);
        },
      });
  }

  logoutFromMenu(): void {
    this.personalMenuOpen = false;
    this.logout();
  }

  togglePersonalMenu(): void {
    this.personalMenuOpen = !this.personalMenuOpen;
  }

  closePersonalMenu(): void {
    this.personalMenuOpen = false;
  }

  private loadGoals(): void {
    const requestSeq = ++this.goalRequestSeq;
    this.goalLoading = true;
    this.goalError = '';
    this.startGoalLoadWatchdog();
    this.cdr.detectChanges();

    this.taskCenter
      .listMyGoals({ status: 'ALL', page: 1, size: 8 })
      .pipe(
        finalize(() => {
          if (requestSeq !== this.goalRequestSeq) return;
          this.goalLoading = false;
          this.clearGoalLoadWatchdog();
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (resp) => {
          if (requestSeq !== this.goalRequestSeq) return;
          this.rawGoalItems = this.sortGoals(resp.items || []);
          this.goalItems = this.toGoalCards(this.rawGoalItems);
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          if (requestSeq !== this.goalRequestSeq) return;
          this.goalError = this.extractErrorMessage(error) || '加载目标任务失败。';
          this.rawGoalItems = [];
          this.goalItems = [];
          this.cdr.detectChanges();
        },
      });
  }

  private loadInfos(): void {
    const requestSeq = ++this.infoRequestSeq;
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
          if (requestSeq !== this.infoRequestSeq) return;
          this.infoLoading = false;
          this.clearInfoLoadWatchdog();
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (resp) => {
          if (requestSeq !== this.infoRequestSeq) return;
          this.rawInfoItems = [...(resp.items || [])];
          this.infoItems = this.toInfoCards(this.rawInfoItems);
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          if (requestSeq !== this.infoRequestSeq) return;
          this.infoError = this.extractErrorMessage(error) || '加载信息列表失败。';
          this.rawInfoItems = [];
          this.infoItems = [];
          this.cdr.detectChanges();
        },
      });
  }

  private scheduleInfoReload(): void {
    this.clearInfoTagDebounce();
    this.infoTagDebounceTimer = window.setTimeout(() => {
      this.infoTagDebounceTimer = null;
      this.loadInfos();
    }, 280);
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

  private clearInfoTagDebounce(): void {
    if (this.infoTagDebounceTimer === null) return;
    window.clearTimeout(this.infoTagDebounceTimer);
    this.infoTagDebounceTimer = null;
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
          const nextItems = this.rawGoalItems.map((item) =>
            item.id === updatedGoal.id ? updatedGoal : item
          );
          this.rawGoalItems = this.sortGoals(nextItems);
          this.goalItems = this.toGoalCards(this.rawGoalItems);
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

  private loadWelcomeNameIfNeeded(): void {
    if (this.welcomeDisplayName !== 'Student') return;

    this.profileApi
      .getMyProfile()
      .pipe(timeout(this.welcomeNameTimeoutMs))
      .subscribe({
        next: (payload: unknown) => {
          const fromProfile = this.resolveNameFromPayload(payload);
          if (!fromProfile) return;

          this.welcomeNameOverride = fromProfile;
          this.cdr.detectChanges();
        },
        error: () => {
          // Keep Student fallback silently for dashboard header.
        },
      });
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

  private toText(value: unknown): string {
    return String(value ?? '').trim();
  }

  private toRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  }

  private resolveNameFromPayload(payload: unknown): string {
    const parts = this.resolveNamePartsFromPayload(payload);
    const directName = this.toText(parts.directName);
    const legalName = this.buildLastFirstName(parts.lastName, parts.firstName);

    if (directName && !this.isPlaceholderStudentName(directName)) return directName;
    return legalName;
  }

  private resolveNamePartsFromPayload(payload: unknown): {
    directName: string;
    firstName: string;
    lastName: string;
  } {
    const source = this.toRecord(payload);
    if (!source) return { directName: '', firstName: '', lastName: '' };

    const queue: Record<string, unknown>[] = [];
    const visited = new Set<Record<string, unknown>>();
    const maxNodeCount = 30;
    const enqueue = (value: unknown): void => {
      const node = this.toRecord(value);
      if (!node || visited.has(node) || queue.length >= maxNodeCount) return;
      visited.add(node);
      queue.push(node);
    };

    enqueue(source);

    const nestedKeys = [
      'profile',
      'student',
      'user',
      'data',
      'result',
      'payload',
      'account',
      'currentUser',
      'current_user',
      'loginUser',
      'login_user',
      'userInfo',
      'user_info',
      'me',
    ];

    while (queue.length > 0) {
      const node = queue.shift() as Record<string, unknown>;
      const directName = this.pickFirstText(node, [
        'preferredName',
        'preferred_name',
        'nickName',
        'nickname',
        'displayName',
        'display_name',
        'fullName',
        'full_name',
        'name',
      ]);
      const lastName = this.pickFirstText(node, [
        'legalLastName',
        'lastName',
        'surname',
        'familyName',
        'legal_last_name',
        'last_name',
        'family_name',
      ]);
      const firstName = this.pickFirstText(node, [
        'legalFirstName',
        'firstName',
        'givenName',
        'legal_first_name',
        'first_name',
        'given_name',
      ]);

      if (directName || firstName || lastName) {
        return { directName, firstName, lastName };
      }

      for (const key of nestedKeys) {
        enqueue(node[key]);
      }
    }

    return { directName: '', firstName: '', lastName: '' };
  }

  private pickFirstText(node: Record<string, unknown>, keys: string[]): string {
    const targets = new Set(keys.map((key) => key.toLowerCase()));
    for (const [key, value] of Object.entries(node)) {
      if (!targets.has(String(key).toLowerCase())) continue;
      const text = this.toText(value);
      if (text) return text;
    }
    return '';
  }

  private isPlaceholderStudentName(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    return normalized === 'student' || normalized === 'students' || value.trim() === '学生';
  }

  private buildLastFirstName(lastName: unknown, firstName: unknown): string {
    return [this.toText(lastName), this.toText(firstName)].filter(Boolean).join(' ').trim();
  }

  private tokenizeName(value: unknown): string[] {
    return this.toText(value).split(/\s+/).filter(Boolean);
  }
}
