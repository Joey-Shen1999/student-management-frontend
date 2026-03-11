import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';

import {
  type AssignableStudentOptionVm,
  type CreateGoalRequestVm,
  type CreateInfoRequestVm,
  type GoalTaskStatus,
  type GoalTaskVm,
  type InfoTaskCategory,
  type InfoTaskVm,
  TaskCenterService,
} from '../../services/task-center.service';

@Component({
  selector: 'app-task-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div style="max-width:1100px;margin:24px auto;padding:0 12px;font-family:Arial,sans-serif;display:grid;gap:12px;">
      <div style="display:flex;gap:10px;align-items:center;">
        <h2 style="margin:0;">Task Management</h2>
        <button type="button" (click)="goDashboard()" style="margin-left:auto;">返回 Teacher Dashboard</button>
      </div>

      <section style="border:1px solid #dfe6f4;border-radius:10px;padding:12px;background:#fff;display:grid;gap:8px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <h3 style="margin:0;">创建 Goal</h3>
          <button type="button" (click)="refreshAssignableStudents()" [disabled]="studentsLoading || creating" style="margin-left:auto;">
            {{ studentsLoading ? '加载学生中...' : '刷新学生列表' }}
          </button>
        </div>

        <div *ngIf="studentsError" style="color:#b00020;">{{ studentsError }}</div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;">
          <select [(ngModel)]="createStudentId" [disabled]="studentsLoading || creating" style="padding:8px;">
            <option [ngValue]="null">请选择学生</option>
            <option *ngFor="let student of studentOptions; trackBy: trackStudent" [ngValue]="student.studentId">
              {{ student.studentId }} - {{ student.studentName }}
            </option>
          </select>

          <input type="date" [(ngModel)]="createDueAt" [disabled]="creating" style="padding:8px;" />
          <input [(ngModel)]="createTitle" [disabled]="creating" placeholder="Goal 标题" style="padding:8px;grid-column:1 / -1;" />
          <textarea [(ngModel)]="createDescription" [disabled]="creating" rows="3" placeholder="Goal 描述" style="padding:8px;grid-column:1 / -1;"></textarea>
        </div>

        <div style="display:flex;gap:8px;">
          <button type="button" (click)="createGoal()" [disabled]="creating || studentsLoading">{{ creating ? '创建中...' : '创建 Goal' }}</button>
          <button type="button" (click)="resetCreateForm()" [disabled]="creating">清空</button>
        </div>

        <div *ngIf="createError" style="color:#b00020;">{{ createError }}</div>
        <div *ngIf="createSuccess" style="color:#1b5e20;">{{ createSuccess }}</div>
      </section>

      <section style="border:1px solid #dfe6f4;border-radius:10px;padding:12px;background:#fff;display:grid;gap:8px;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <h3 style="margin:0;">Goal 列表</h3>
          <select [(ngModel)]="filterStatus" [disabled]="goalsLoading" style="padding:6px 8px;">
            <option value="ALL">全部状态</option>
            <option value="NOT_STARTED">未开始</option>
            <option value="IN_PROGRESS">进行中</option>
            <option value="COMPLETED">已完成</option>
          </select>
          <input type="search" [(ngModel)]="filterKeyword" [disabled]="goalsLoading" placeholder="关键字" style="padding:6px 8px;min-width:180px;" />
          <button type="button" (click)="applyFilters()" [disabled]="goalsLoading">查询</button>
          <button type="button" (click)="clearFilters()" [disabled]="goalsLoading">重置</button>
          <button type="button" (click)="refreshGoals()" [disabled]="goalsLoading">刷新</button>
          <span style="margin-left:auto;color:#666;">{{ goals.length }} 条</span>
        </div>

        <div *ngIf="goalsLoading" style="color:#666;">正在加载任务...</div>
        <div *ngIf="!goalsLoading && goalsError" style="color:#b00020;">{{ goalsError }}</div>
        <div *ngIf="!goalsLoading && !goalsError && goals.length === 0" style="color:#666;">暂无任务。</div>

        <div *ngIf="!goalsLoading && !goalsError && goals.length > 0" style="display:grid;gap:8px;">
          <article
            *ngFor="let goal of goals; trackBy: trackGoal"
            (click)="selectGoal(goal)"
            [style.border]="'1px solid ' + (selectedGoalId === goal.id ? '#1f5fbd' : '#dfe6f4')"
            style="border-radius:10px;padding:10px;background:#fff;display:grid;gap:6px;cursor:pointer;"
          >
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
              <strong>{{ goal.title }}</strong>
              <span>{{ goalStatusLabel(goal.status) }}</span>
            </div>
            <div style="color:#555;font-size:13px;">学生：{{ goal.assignedStudentName }} | 截止：{{ displayDueAt(goal) }}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button" (click)="$event.stopPropagation(); setGoalStatus(goal, 'NOT_STARTED')" [disabled]="updatingGoalId === goal.id || goal.status === 'NOT_STARTED'">未开始</button>
              <button type="button" (click)="$event.stopPropagation(); setGoalStatus(goal, 'IN_PROGRESS')" [disabled]="updatingGoalId === goal.id || goal.status === 'IN_PROGRESS'">进行中</button>
              <button type="button" (click)="$event.stopPropagation(); setGoalStatus(goal, 'COMPLETED')" [disabled]="updatingGoalId === goal.id || goal.status === 'COMPLETED'">完成</button>
            </div>
          </article>
        </div>

        <div *ngIf="updateError" style="color:#b00020;">{{ updateError }}</div>
      </section>

      <section style="border:1px solid #dfe6f4;border-radius:10px;padding:12px;background:#fff;display:grid;gap:8px;">
        <h3 style="margin:0;">发布 Info</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;">
          <select [(ngModel)]="createInfoCategory" [disabled]="creatingInfo" style="padding:8px;">
            <option value="ACTIVITY">活动</option>
            <option value="VOLUNTEER">义工</option>
          </select>
          <input [(ngModel)]="createInfoTags" [disabled]="creatingInfo" placeholder="Tags: A,B,C" style="padding:8px;" />
          <input [(ngModel)]="createInfoTitle" [disabled]="creatingInfo" placeholder="Info 标题" style="padding:8px;grid-column:1 / -1;" />
          <textarea [(ngModel)]="createInfoContent" [disabled]="creatingInfo" rows="3" placeholder="Info 内容" style="padding:8px;grid-column:1 / -1;"></textarea>
        </div>
        <div style="display:flex;gap:8px;">
          <button type="button" (click)="createInfo()" [disabled]="creatingInfo">{{ creatingInfo ? '发布中...' : '发布 Info' }}</button>
          <button type="button" (click)="resetCreateInfoForm()" [disabled]="creatingInfo">清空</button>
        </div>
        <div *ngIf="createInfoError" style="color:#b00020;">{{ createInfoError }}</div>
        <div *ngIf="createInfoSuccess" style="color:#1b5e20;">{{ createInfoSuccess }}</div>
      </section>

      <section style="border:1px solid #dfe6f4;border-radius:10px;padding:12px;background:#fff;display:grid;gap:8px;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <h3 style="margin:0;">Info 列表</h3>
          <select [(ngModel)]="infoFilterCategory" [disabled]="infosLoading" style="padding:6px 8px;">
            <option value="ALL">全部分类</option>
            <option value="ACTIVITY">活动</option>
            <option value="VOLUNTEER">义工</option>
          </select>
          <input type="search" [(ngModel)]="infoFilterTag" [disabled]="infosLoading" placeholder="tag" style="padding:6px 8px;min-width:140px;" />
          <input type="search" [(ngModel)]="infoFilterKeyword" [disabled]="infosLoading" placeholder="关键字" style="padding:6px 8px;min-width:180px;" />
          <button type="button" (click)="applyInfoFilters()" [disabled]="infosLoading">查询</button>
          <button type="button" (click)="clearInfoFilters()" [disabled]="infosLoading">重置</button>
          <button type="button" (click)="refreshInfos()" [disabled]="infosLoading">刷新</button>
          <span style="margin-left:auto;color:#666;">{{ infos.length }} 条</span>
        </div>

        <div *ngIf="infosLoading" style="color:#666;">正在加载信息...</div>
        <div *ngIf="!infosLoading && infosError" style="color:#b00020;">{{ infosError }}</div>
        <div *ngIf="!infosLoading && !infosError && infos.length === 0" style="color:#666;">暂无信息。</div>
        <article *ngFor="let info of infos; trackBy: trackInfo" style="border:1px solid #dfe6f4;border-radius:10px;padding:10px;background:#fff;display:grid;gap:6px;">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
            <strong>{{ info.title }}</strong>
            <span>{{ infoCategoryLabel(info.category) }}</span>
          </div>
          <div style="color:#444;line-height:1.5;">{{ info.content }}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <span *ngFor="let tag of info.tags" style="font-size:12px;color:#48607f;">#{{ tag }}</span>
          </div>
        </article>
      </section>
    </div>
  `,
})
export class TaskManagementComponent implements OnInit {
  studentOptions: AssignableStudentOptionVm[] = [];
  studentsLoading = false;
  studentsError = '';

  goals: GoalTaskVm[] = [];
  goalsLoading = false;
  goalsError = '';

  infos: InfoTaskVm[] = [];
  infosLoading = false;
  infosError = '';

  filterStudentId: number | null = null;
  filterStatus: GoalTaskStatus | 'ALL' = 'ALL';
  filterKeyword = '';

  infoFilterCategory: InfoTaskCategory | 'ALL' = 'ALL';
  infoFilterTag = '';
  infoFilterKeyword = '';

  createStudentId: number | null = null;
  createTitle = '';
  createDescription = '';
  createDueAt = '';
  creating = false;
  createError = '';
  createSuccess = '';

  createInfoCategory: InfoTaskCategory = 'ACTIVITY';
  createInfoTitle = '';
  createInfoContent = '';
  createInfoTags = '';
  creatingInfo = false;
  createInfoError = '';
  createInfoSuccess = '';

  selectedGoalId: number | null = null;
  updatingGoalId: number | null = null;
  updateError = '';

  private studentsLoadWatchdog: number | null = null;
  private goalsLoadWatchdog: number | null = null;
  private infosLoadWatchdog: number | null = null;

  constructor(
    private taskCenter: TaskCenterService,
    private router: Router,
    private cdr: ChangeDetectorRef = { detectChanges: () => {} } as ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAssignableStudents();
    this.loadGoals();
    this.loadInfos();
  }

  get selectedGoal(): GoalTaskVm | null {
    if (!this.selectedGoalId) {
      return null;
    }
    return this.goals.find((goal) => goal.id === this.selectedGoalId) || null;
  }

  goDashboard(): void {
    this.router.navigate(['/teacher/dashboard']);
  }

  refreshAssignableStudents(): void {
    this.loadAssignableStudents();
  }

  refreshGoals(): void {
    this.loadGoals();
  }

  refreshInfos(): void {
    this.loadInfos();
  }

  applyFilters(): void {
    this.loadGoals();
  }

  clearFilters(): void {
    this.filterStudentId = null;
    this.filterStatus = 'ALL';
    this.filterKeyword = '';
    this.loadGoals();
  }

  applyInfoFilters(): void {
    this.loadInfos();
  }

  clearInfoFilters(): void {
    this.infoFilterCategory = 'ALL';
    this.infoFilterTag = '';
    this.infoFilterKeyword = '';
    this.loadInfos();
  }

  resetCreateForm(): void {
    this.createTitle = '';
    this.createDescription = '';
    this.createDueAt = '';
    this.createError = '';
    this.createSuccess = '';
  }

  resetCreateInfoForm(): void {
    this.createInfoCategory = 'ACTIVITY';
    this.createInfoTitle = '';
    this.createInfoContent = '';
    this.createInfoTags = '';
    this.createInfoError = '';
    this.createInfoSuccess = '';
  }

  createGoal(): void {
    if (this.creating) return;

    const studentId = Number(this.createStudentId);
    if (!Number.isFinite(studentId) || studentId <= 0) {
      this.createError = '请选择目标学生。';
      this.createSuccess = '';
      return;
    }

    const title = this.createTitle.trim();
    if (!title) {
      this.createError = '请填写 Goal 标题。';
      this.createSuccess = '';
      return;
    }

    const description = this.createDescription.trim();
    if (!description) {
      this.createError = '请填写 Goal 描述。';
      this.createSuccess = '';
      return;
    }

    const request: CreateGoalRequestVm = {
      studentId,
      title,
      description,
      dueAt: this.createDueAt.trim() || null,
    };

    this.creating = true;
    this.createError = '';
    this.createSuccess = '';
    this.cdr.detectChanges();

    this.taskCenter
      .createGoal(request)
      .pipe(
        finalize(() => {
          this.creating = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (goal) => {
          this.createSuccess = `Goal 已创建：#${goal.id} ${goal.title}`;
          this.createTitle = '';
          this.createDescription = '';
          this.createDueAt = '';
          this.selectedGoalId = goal.id;
          this.loadGoals();
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.createError = this.extractErrorMessage(error) || '创建 Goal 失败。';
          this.cdr.detectChanges();
        },
      });
  }

  createInfo(): void {
    if (this.creatingInfo) return;

    const title = this.createInfoTitle.trim();
    if (!title) {
      this.createInfoError = '请填写 Info 标题。';
      this.createInfoSuccess = '';
      return;
    }

    const content = this.createInfoContent.trim();
    if (!content) {
      this.createInfoError = '请填写 Info 内容。';
      this.createInfoSuccess = '';
      return;
    }

    const request: CreateInfoRequestVm = {
      category: this.createInfoCategory,
      title,
      content,
      tags: this.parseTags(this.createInfoTags),
    };

    this.creatingInfo = true;
    this.createInfoError = '';
    this.createInfoSuccess = '';
    this.cdr.detectChanges();

    this.taskCenter
      .createInfo(request)
      .pipe(
        finalize(() => {
          this.creatingInfo = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (info) => {
          this.createInfoSuccess = `Info 已发布：#${info.id} ${info.title}`;
          this.createInfoTitle = '';
          this.createInfoContent = '';
          this.createInfoTags = '';
          this.loadInfos();
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.createInfoError = this.extractErrorMessage(error) || '发布 Info 失败。';
          this.cdr.detectChanges();
        },
      });
  }

  selectGoal(goal: GoalTaskVm): void {
    this.selectedGoalId = goal.id;
    this.updateError = '';
  }

  setGoalStatus(goal: GoalTaskVm, status: GoalTaskStatus): void {
    if (this.updatingGoalId !== null) return;

    this.updatingGoalId = goal.id;
    this.updateError = '';
    this.cdr.detectChanges();

    this.taskCenter
      .updateTeacherGoalStatus(goal.id, {
        status,
        progressNote: status === 'COMPLETED' ? '老师已在任务管理页标记完成。' : goal.progressNote,
      })
      .pipe(
        finalize(() => {
          this.updatingGoalId = null;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (updatedGoal) => {
          const nextRows = this.goals.map((item) => (item.id === updatedGoal.id ? updatedGoal : item));
          this.goals = this.sortGoals(nextRows);
          this.selectedGoalId = updatedGoal.id;
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.updateError = this.extractErrorMessage(error) || '更新 Goal 状态失败。';
          this.cdr.detectChanges();
        },
      });
  }

  trackStudent = (_index: number, student: AssignableStudentOptionVm): number => student.studentId;
  trackGoal = (_index: number, goal: GoalTaskVm): number => goal.id;
  trackInfo = (_index: number, info: InfoTaskVm): number => info.id;

  goalStatusLabel(status: GoalTaskStatus): string {
    if (status === 'NOT_STARTED') return '未开始';
    if (status === 'IN_PROGRESS') return '进行中';
    return '已完成';
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

  private loadAssignableStudents(): void {
    this.studentsLoading = true;
    this.studentsError = '';
    this.startStudentsLoadWatchdog();
    this.cdr.detectChanges();

    this.taskCenter
      .listAssignableStudents()
      .pipe(
        finalize(() => {
          this.studentsLoading = false;
          this.clearStudentsLoadWatchdog();
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (students) => {
          this.studentOptions = [...students].sort((a, b) => a.studentId - b.studentId);
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.studentsError = this.extractErrorMessage(error) || '加载学生列表失败。';
          this.studentOptions = [];
          this.cdr.detectChanges();
        },
      });
  }

  private loadGoals(): void {
    this.goalsLoading = true;
    this.goalsError = '';
    this.startGoalsLoadWatchdog();
    this.cdr.detectChanges();

    this.taskCenter
      .listTeacherGoals({
        studentId: this.filterStudentId,
        status: this.filterStatus,
        keyword: this.filterKeyword,
        page: 1,
        size: 100,
      })
      .pipe(
        finalize(() => {
          this.goalsLoading = false;
          this.clearGoalsLoadWatchdog();
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (resp) => {
          this.goals = this.sortGoals(resp.items || []);
          if (this.selectedGoalId && !this.goals.some((goal) => goal.id === this.selectedGoalId)) {
            this.selectedGoalId = this.goals.length > 0 ? this.goals[0].id : null;
          }
          if (!this.selectedGoalId && this.goals.length > 0) {
            this.selectedGoalId = this.goals[0].id;
          }
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.goalsError = this.extractErrorMessage(error) || '加载 Goal 列表失败。';
          this.goals = [];
          this.selectedGoalId = null;
          this.cdr.detectChanges();
        },
      });
  }

  private loadInfos(): void {
    this.infosLoading = true;
    this.infosError = '';
    this.startInfosLoadWatchdog();
    this.cdr.detectChanges();

    this.taskCenter
      .listTeacherInfos({
        category: this.infoFilterCategory,
        tag: this.infoFilterTag,
        keyword: this.infoFilterKeyword,
        page: 1,
        size: 100,
      })
      .pipe(
        finalize(() => {
          this.infosLoading = false;
          this.clearInfosLoadWatchdog();
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (resp) => {
          this.infos = [...(resp.items || [])];
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.infosError = this.extractErrorMessage(error) || '加载 Info 列表失败。';
          this.infos = [];
          this.cdr.detectChanges();
        },
      });
  }

  private startStudentsLoadWatchdog(): void {
    this.clearStudentsLoadWatchdog();
    this.studentsLoadWatchdog = window.setTimeout(() => {
      if (!this.studentsLoading) return;
      this.studentsLoading = false;
      if (!this.studentsError) {
        this.studentsError = '请求超时，请检查后端服务或网络连接。';
      }
      this.cdr.detectChanges();
    }, 15000);
  }

  private clearStudentsLoadWatchdog(): void {
    if (this.studentsLoadWatchdog === null) return;
    window.clearTimeout(this.studentsLoadWatchdog);
    this.studentsLoadWatchdog = null;
  }

  private startGoalsLoadWatchdog(): void {
    this.clearGoalsLoadWatchdog();
    this.goalsLoadWatchdog = window.setTimeout(() => {
      if (!this.goalsLoading) return;
      this.goalsLoading = false;
      if (!this.goalsError) {
        this.goalsError = '请求超时，请检查后端服务或网络连接。';
      }
      this.cdr.detectChanges();
    }, 15000);
  }

  private clearGoalsLoadWatchdog(): void {
    if (this.goalsLoadWatchdog === null) return;
    window.clearTimeout(this.goalsLoadWatchdog);
    this.goalsLoadWatchdog = null;
  }

  private startInfosLoadWatchdog(): void {
    this.clearInfosLoadWatchdog();
    this.infosLoadWatchdog = window.setTimeout(() => {
      if (!this.infosLoading) return;
      this.infosLoading = false;
      if (!this.infosError) {
        this.infosError = '请求超时，请检查后端服务或网络连接。';
      }
      this.cdr.detectChanges();
    }, 15000);
  }

  private clearInfosLoadWatchdog(): void {
    if (this.infosLoadWatchdog === null) return;
    window.clearTimeout(this.infosLoadWatchdog);
    this.infosLoadWatchdog = null;
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

  private parseTags(raw: string): string[] {
    return Array.from(
      new Set(
        String(raw || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      )
    );
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
