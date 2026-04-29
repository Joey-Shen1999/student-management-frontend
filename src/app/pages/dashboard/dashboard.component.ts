import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { finalize, timeout } from 'rxjs/operators';

import { AuthService, type LoginResponse } from '../../services/auth.service';
import { StudentProfileService } from '../../services/student-profile.service';
import {
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
            <h2>学生工作台</h2>
            <p>欢迎，{{ welcomeDisplayName }}</p>
          </div>
          <button
            type="button"
            class="action-btn ghost signout-btn"
            [disabled]="signingOut"
            (click)="logout()"
          >
            {{ signingOut ? '退出中...' : '退出登录' }}
          </button>
        </div>

        <section class="dashboard-card">
          <div class="section-head">
            <h3>通知信息</h3>
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
              placeholder="按标签过滤（例如 志愿）"
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
          <h3>快捷操作</h3>
          <div class="quick-actions">
            <button type="button" class="action-btn primary" (click)="goDocumentUpload()">
              上传材料
            </button>
            <button type="button" class="action-btn primary" (click)="goProfile()">学生档案</button>
            <button type="button" class="action-btn primary" (click)="goCoursePlanner()">
              课程规划
            </button>
            <button type="button" class="action-btn primary" (click)="goIeltsTracking()">
              语言成绩跟踪
            </button>
            <button type="button" class="action-btn primary" (click)="goOssltTracking()">
              OSSLT 登记
            </button>
            <button type="button" class="action-btn primary" (click)="goVolunteerRecords()">
              义工记录
            </button>
            <button type="button" class="action-btn secondary" (click)="goAccountProfile()">
              姓名设置
            </button>
            <button type="button" class="action-btn secondary" (click)="goAccount()">
              账号设置
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

  infoLoading = false;
  infoError = '';
  infoItems: InfoTaskVm[] = [];
  infoUpdatingId: number | null = null;
  infoCategoryFilter: InfoTaskCategory | 'ALL' = 'ALL';
  infoTagFilter = '';
  infoUnreadOnly = false;
  signingOut = false;
  welcomeNameOverride = '';

  private infoLoadWatchdog: number | null = null;
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

    return '学生';
  }

  ngOnInit(): void {
    this.loadWelcomeNameIfNeeded();
    this.loadInfos();
  }

  goProfile() {
    this.router.navigate(['/student/profile']);
  }

  goDocumentUpload() {
    this.router.navigate(['/student/documents']);
  }

  goCoursePlanner() {
    this.router.navigate(['/student/course-plan']);
  }

  goIeltsTracking() {
    this.router.navigate(['/student/ielts']);
  }

  goOssltTracking() {
    this.router.navigate(['/student/osslt']);
  }

  goVolunteerRecords() {
    this.router.navigate(['/student/volunteer']);
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

    if (resolvedName && !this.isPlaceholderStudentName(resolvedName)) {
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

  trackInfo = (_index: number, info: InfoTaskVm): number => info.id;

  infoCategoryLabel(category: InfoTaskCategory): string {
    return category === 'VOLUNTEER' ? '义工' : '活动';
  }

  displayUpdatedAt(value: string): string {
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) {
      return value || '-';
    }

    return new Date(timestamp).toLocaleString();
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

  private loadWelcomeNameIfNeeded(): void {
    if (!this.isPlaceholderStudentName(this.welcomeDisplayName)) return;

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
          // Keep placeholder fallback silently for dashboard header.
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
