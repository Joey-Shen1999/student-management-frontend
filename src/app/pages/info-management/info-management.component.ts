import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';

import {
  type CreateInfoRequestVm,
  type InfoTaskCategory,
  type InfoTaskVm,
  TaskCenterService,
} from '../../services/task-center.service';

@Component({
  selector: 'app-info-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="info-page">
      <div class="info-shell">
        <div class="info-header">
          <h2>通知发布与管理</h2>
          <button type="button" class="info-back-btn" (click)="goDashboard()">返回</button>
        </div>

        <section class="info-card">
          <h3>发布通知</h3>
          <div class="create-grid">
            <select [(ngModel)]="createInfoCategory" [disabled]="creatingInfo">
              <option value="ACTIVITY">活动</option>
              <option value="VOLUNTEER">义工</option>
            </select>
            <input [(ngModel)]="createInfoTags" [disabled]="creatingInfo" placeholder="Tags: A,B,C" />
            <input
              [(ngModel)]="createInfoTitle"
              [disabled]="creatingInfo"
              placeholder="通知标题"
              class="full-width"
            />
            <textarea
              [(ngModel)]="createInfoContent"
              [disabled]="creatingInfo"
              rows="4"
              placeholder="通知内容"
              class="full-width"
            ></textarea>
          </div>

          <div class="create-actions">
            <button type="button" (click)="createInfo()" [disabled]="creatingInfo">
              {{ creatingInfo ? '发布中...' : '发布通知' }}
            </button>
            <button type="button" (click)="resetCreateInfoForm()" [disabled]="creatingInfo">清空</button>
          </div>

          <div *ngIf="createInfoError" class="error-text">{{ createInfoError }}</div>
          <div *ngIf="createInfoSuccess" class="success-text">{{ createInfoSuccess }}</div>
        </section>

        <section class="info-card">
          <div class="info-toolbar">
            <h3>已发布通知</h3>
            <select [(ngModel)]="infoFilterCategory" [disabled]="infosLoading">
              <option value="ALL">全部分类</option>
              <option value="ACTIVITY">活动</option>
              <option value="VOLUNTEER">义工</option>
            </select>
            <input
              type="search"
              [(ngModel)]="infoFilterTag"
              [disabled]="infosLoading"
              placeholder="tag"
            />
            <input
              type="search"
              [(ngModel)]="infoFilterKeyword"
              [disabled]="infosLoading"
              placeholder="关键字"
            />
            <button type="button" (click)="applyInfoFilters()" [disabled]="infosLoading">查询</button>
            <button type="button" (click)="clearInfoFilters()" [disabled]="infosLoading">重置</button>
            <button type="button" (click)="refreshInfos()" [disabled]="infosLoading">刷新</button>
            <span class="count-text">{{ infos.length }} 条</span>
          </div>

          <div *ngIf="infosLoading" class="state-text">正在加载通知...</div>
          <div *ngIf="!infosLoading && infosError" class="error-text">{{ infosError }}</div>
          <div *ngIf="!infosLoading && !infosError && infos.length === 0" class="state-text">
            暂无通知。
          </div>

          <article *ngFor="let info of infos; trackBy: trackInfo" class="info-item">
            <div class="info-item-header">
              <strong>{{ info.title }}</strong>
              <span class="info-category">{{ infoCategoryLabel(info.category) }}</span>
            </div>
            <div class="info-content">{{ info.content }}</div>
            <div class="info-tags">
              <span *ngFor="let tag of info.tags">#{{ tag }}</span>
            </div>
          </article>
        </section>
      </div>
    </div>
  `,
  styles: [
    `
      .info-page {
        min-height: 100vh;
        padding: 20px 12px 30px;
        background: linear-gradient(180deg, #f6f8fc 0%, #edf2fb 100%);
      }

      .info-shell {
        max-width: 980px;
        margin: 0 auto;
        display: grid;
        gap: 12px;
        font-family:
          'Segoe UI',
          -apple-system,
          BlinkMacSystemFont,
          'Helvetica Neue',
          sans-serif;
      }

      .info-header {
        display: flex;
        gap: 10px;
        align-items: center;
      }

      .info-header h2 {
        margin: 0;
        color: #1f2f47;
      }

      .info-back-btn {
        margin-left: auto;
        border: 1px solid #c8d2e0;
        border-radius: 999px;
        background: #ffffff;
        color: #1f2f47;
        padding: 8px 14px;
        font-size: 13px;
        font-weight: 600;
        line-height: 1;
        cursor: pointer;
        box-shadow: 0 8px 18px rgba(21, 40, 68, 0.12);
      }

      .info-card {
        border: 1px solid #dfe6f4;
        border-radius: 12px;
        padding: 12px;
        background: #fff;
        display: grid;
        gap: 10px;
      }

      .info-card h3 {
        margin: 0;
      }

      .create-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 8px;
      }

      .create-grid input,
      .create-grid select,
      .create-grid textarea {
        padding: 8px;
      }

      .create-grid .full-width {
        grid-column: 1 / -1;
      }

      .create-actions {
        display: flex;
        gap: 8px;
      }

      .info-toolbar {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .info-toolbar h3 {
        margin: 0;
      }

      .info-toolbar input,
      .info-toolbar select {
        padding: 6px 8px;
      }

      .count-text {
        margin-left: auto;
        color: #5a6476;
        font-size: 13px;
      }

      .info-item {
        border: 1px solid #dfe6f4;
        border-radius: 10px;
        padding: 10px;
        background: #fff;
        display: grid;
        gap: 6px;
      }

      .info-item-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }

      .info-category {
        font-size: 12px;
        color: #3f5f86;
        background: #ebf3ff;
        border: 1px solid #bfd5f4;
        border-radius: 999px;
        padding: 2px 8px;
      }

      .info-content {
        color: #465163;
        line-height: 1.6;
      }

      .info-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        font-size: 12px;
        color: #48607f;
      }

      .state-text {
        color: #5f6878;
      }

      .error-text {
        color: #b00020;
      }

      .success-text {
        color: #1b5e20;
      }

      @media (max-width: 720px) {
        .count-text {
          margin-left: 0;
        }
      }
    `,
  ],
})
export class InfoManagementComponent implements OnInit {
  infos: InfoTaskVm[] = [];
  infosLoading = false;
  infosError = '';

  infoFilterCategory: InfoTaskCategory | 'ALL' = 'ALL';
  infoFilterTag = '';
  infoFilterKeyword = '';

  createInfoCategory: InfoTaskCategory = 'ACTIVITY';
  createInfoTitle = '';
  createInfoContent = '';
  createInfoTags = '';
  creatingInfo = false;
  createInfoError = '';
  createInfoSuccess = '';

  private infosLoadWatchdog: number | null = null;

  constructor(
    private taskCenter: TaskCenterService,
    private router: Router,
    private cdr: ChangeDetectorRef = { detectChanges: () => {} } as ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadInfos();
  }

  goDashboard(): void {
    this.router.navigate(['/teacher/dashboard']);
  }

  refreshInfos(): void {
    this.loadInfos();
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

  resetCreateInfoForm(): void {
    this.createInfoCategory = 'ACTIVITY';
    this.createInfoTitle = '';
    this.createInfoContent = '';
    this.createInfoTags = '';
    this.createInfoError = '';
    this.createInfoSuccess = '';
  }

  createInfo(): void {
    if (this.creatingInfo) return;

    const title = this.createInfoTitle.trim();
    if (!title) {
      this.createInfoError = '请填写通知标题。';
      this.createInfoSuccess = '';
      return;
    }

    const content = this.createInfoContent.trim();
    if (!content) {
      this.createInfoError = '请填写通知内容。';
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
          this.createInfoSuccess = `通知已发布：#${info.id} ${info.title}`;
          this.createInfoTitle = '';
          this.createInfoContent = '';
          this.createInfoTags = '';
          this.loadInfos();
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.createInfoError = this.extractErrorMessage(error) || '发布通知失败。';
          this.cdr.detectChanges();
        },
      });
  }

  trackInfo = (_index: number, info: InfoTaskVm): number => info.id;

  infoCategoryLabel(category: InfoTaskCategory): string {
    return category === 'VOLUNTEER' ? '义工' : '活动';
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
          this.infosError = this.extractErrorMessage(error) || '加载通知失败。';
          this.infos = [];
          this.cdr.detectChanges();
        },
      });
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
