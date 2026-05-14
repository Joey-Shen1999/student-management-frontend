import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { finalize, timeout } from 'rxjs/operators';

import { AuthService, type LoginResponse } from '../../services/auth.service';
import { StudentProfileService } from '../../services/student-profile.service';
import {
  type InfoTaskVm,
  TaskCenterService,
} from '../../services/task-center.service';
import {
  GraduationApplication,
  GraduationApplicationStageService,
} from '../../services/graduation-application-stage.service';

interface ApplicationProgressGroup {
  universityName: string;
  applications: GraduationApplication[];
}

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

        <section class="dashboard-card application-progress-card" *ngIf="applicationStageEnabled">
          <div class="section-head">
            <div>
              <h3>大学申请进度</h3>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="border-radius:999px;padding:3px 10px;background:#eef4ff;color:#1d4f9b;font-size:12px;font-weight:800;white-space:nowrap;">{{ applicationProgressCount }} 个专业</span>
            </div>
          </div>

          <div style="display:grid;gap:10px;">
            <article
              class="application-university"
              style="border:1px solid #dbe6f5;border-radius:10px;padding:10px;background:#fff;"
              *ngFor="let group of applicationProgressGroups; trackBy: trackApplicationGroup"
            >
              <header style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
                <h4 style="margin:0;color:#203047;font-size:15px;">{{ group.universityName }}</h4>
                <span style="border-radius:999px;padding:3px 10px;background:#eef4ff;color:#1d4f9b;font-size:12px;font-weight:800;white-space:nowrap;">{{ group.applications.length }} 个专业</span>
              </header>
              <div style="display:grid;gap:8px;">
                <div
                  class="program-progress-row"
                  style="display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid #dbe6f5;border-radius:10px;padding:10px;background:#fff;"
                  *ngFor="let application of group.applications; trackBy: trackApplication"
                >
                  <div style="display:grid;gap:3px;">
                    <strong style="color:#22324a;font-size:14px;">{{ application.programName }}</strong>
                    <small style="color:#6b7890;font-size:12px;">最近更新：{{ displayUpdatedAt(application.updatedAt) }}</small>
                  </div>
                  <span style="border-radius:999px;padding:3px 10px;background:#eef4ff;color:#1d4f9b;font-size:12px;font-weight:800;white-space:nowrap;">
                    {{ graduationStage.statusLabel(application.status) }}
                  </span>
                </div>
              </div>
            </article>
          </div>
        </section>

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
            <button
              type="button"
              class="action-btn ghost compact"
              (click)="toggleReadInfos()"
              [disabled]="infoLoading"
            >
              {{ showReadInfos ? '收起已读通知' : '展开已读通知' }}
            </button>
          </div>

          <div *ngIf="infoLoading" class="state-text">正在加载通知...</div>

          <div *ngIf="!infoLoading && infoError" class="error-banner">
            <span>{{ infoError }}</span>
            <button type="button" class="action-btn ghost compact" (click)="refreshInfos()">重试</button>
          </div>

          <div *ngIf="!infoLoading && !infoError && unreadInfoItems.length === 0" class="state-text">
            当前没有未读通知。
          </div>

          <div *ngIf="!infoLoading && !infoError && unreadInfoItems.length > 0" class="info-list">
            <article class="info-item" *ngFor="let info of unreadInfoItems; trackBy: trackInfo">
              <div class="info-head">
                <h4>{{ info.title }}</h4>
              </div>

              <p class="info-content">{{ info.content }}</p>

              <div class="info-meta">
                <span>发布时间：{{ displayUpdatedAt(info.createdAt) }}</span>
                <span>发布老师：{{ info.publishedByTeacherName }}</span>
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

          <div *ngIf="!infoLoading && !infoError && showReadInfos" class="read-info-section">
            <h4>已读通知</h4>
            <div *ngIf="readInfoItems.length === 0" class="state-text">
              暂无已读通知。
            </div>
            <div *ngIf="readInfoItems.length > 0" class="info-list">
              <article class="info-item read" *ngFor="let info of readInfoItems; trackBy: trackInfo">
                <div class="info-head">
                  <h4>{{ info.title }}</h4>
                  <span class="read-pill">已读</span>
                </div>

                <p class="info-content">{{ info.content }}</p>

                <div class="info-meta">
                  <span>发布时间：{{ displayUpdatedAt(info.createdAt) }}</span>
                  <span>发布老师：{{ info.publishedByTeacherName }}</span>
                  <span *ngIf="info.readAt">已读时间：{{ displayUpdatedAt(info.readAt) }}</span>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section class="dashboard-card">
          <h3>快捷操作</h3>
          <div class="quick-actions">
            <button type="button" class="action-btn primary" (click)="goDocumentUpload()">
              上传材料
            </button>
            <button type="button" class="action-btn primary" (click)="goProfile()">学生档案</button>
            <button type="button" class="action-btn primary" (click)="goUniversityGoals()">
              大学目标
            </button>
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
            <button type="button" class="action-btn primary" (click)="goExtracurricularRecords()">
              课外活动
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
  showReadInfos = false;
  signingOut = false;
  welcomeNameOverride = '';
  applicationStageEnabled = false;
  applicationProgressGroups: ApplicationProgressGroup[] = [];
  applicationProgressLoading = false;
  applicationProgressError = '';

  private infoLoadWatchdog: number | null = null;
  private readonly welcomeNameTimeoutMs = 8000;

  constructor(
    private auth: AuthService,
    private router: Router,
    private taskCenter: TaskCenterService,
    private profileApi: StudentProfileService,
    public graduationStage: GraduationApplicationStageService = new GraduationApplicationStageService(),
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
    this.loadApplicationProgress();
    this.loadInfos();
  }

  goProfile() {
    this.router.navigate(['/student/profile']);
  }

  get unreadInfoItems(): InfoTaskVm[] {
    return this.infoItems.filter((info) => !info.read);
  }

  get readInfoItems(): InfoTaskVm[] {
    return this.showReadInfos ? this.infoItems.filter((info) => info.read) : [];
  }

  get applicationProgressCount(): number {
    return this.applicationProgressGroups.reduce((total, group) => total + group.applications.length, 0);
  }

  goUniversityGoals() {
    this.router.navigate(['/student/university-goals']);
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

  goExtracurricularRecords() {
    this.router.navigate(['/student/extracurricular']);
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

  toggleReadInfos(): void {
    this.showReadInfos = !this.showReadInfos;
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
          const nextItems = this.infoItems.map((row) => (row.id === updatedInfo.id ? updatedInfo : row));
          this.infoItems = this.showReadInfos ? nextItems : nextItems.filter((row) => !row.read);
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.infoError = this.extractErrorMessage(error) || '更新信息状态失败。';
          this.cdr.detectChanges();
        },
      });
  }

  trackInfo = (_index: number, info: InfoTaskVm): number => info.id;

  trackApplicationGroup = (_index: number, group: ApplicationProgressGroup): string => group.universityName;

  trackApplication = (_index: number, application: GraduationApplication): string | number => application.id;

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
        category: 'ALL',
        tag: '',
        unreadOnly: !this.showReadInfos,
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

  private loadApplicationProgress(): void {
    const studentId = Number(this.session?.studentId);
    if (!Number.isFinite(studentId) || studentId <= 0) {
      this.applicationStageEnabled = false;
      this.applicationProgressGroups = [];
      return;
    }

    this.applicationProgressLoading = true;
    this.applicationProgressError = '';
    this.graduationStage
      .listApplications(studentId)
      .pipe(
        finalize(() => {
          this.applicationProgressLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (applications) => {
          this.applicationStageEnabled = applications.length > 0;
          this.applicationProgressGroups = this.groupApplicationsByUniversity(applications);
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.applicationStageEnabled = false;
          this.applicationProgressGroups = [];
          this.applicationProgressError = this.extractErrorMessage(error) || '加载大学申请进度失败。';
          this.cdr.detectChanges();
        },
      });
  }

  private groupApplicationsByUniversity(applications: GraduationApplication[]): ApplicationProgressGroup[] {
    const groups = new Map<string, GraduationApplication[]>();
    for (const application of applications) {
      const key = application.universityName.trim() || '未命名大学';
      groups.set(key, [...(groups.get(key) || []), application]);
    }
    return Array.from(groups.entries()).map(([universityName, rows]) => ({
      universityName,
      applications: rows.sort((left, right) => left.sortOrder - right.sortOrder),
    }));
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
