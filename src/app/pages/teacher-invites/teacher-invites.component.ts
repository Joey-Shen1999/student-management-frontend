import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';

import {
  TeacherInviteService,
  CreateTeacherInviteResponse,
} from '../../services/teacher-invite.service';

@Component({
  selector: 'app-teacher-invites',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div style="max-width:760px;margin:40px auto;font-family:Arial">
      <div style="display:flex;align-items:center;">
        <h2 style="margin:0;">教师邀请</h2>
        <a routerLink="/teacher/teachers" style="margin-left:auto;">返回</a>
      </div>

      <div style="margin-top:16px;padding:12px;border:1px solid #ddd;border-radius:8px;">
        <div style="font-weight:bold;margin-bottom:8px;">创建新教师账号</div>

        <label style="display:block;margin:10px 0 6px;">用户名</label>
        <input
          [(ngModel)]="username"
          placeholder="请输入用户名"
          style="display:block;width:100%;box-sizing:border-box;padding:10px;border:1px solid #ccc;border-radius:6px;"
        />

        <label style="display:block;margin:10px 0 6px;">显示名称（可选）</label>
        <input
          [(ngModel)]="displayName"
          placeholder="请输入显示名称"
          style="display:block;width:100%;box-sizing:border-box;padding:10px;border:1px solid #ccc;border-radius:6px;"
        />

        <button
          type="button"
          (click)="create()"
          [disabled]="loading || !username.trim()"
          style="margin-top:12px;padding:10px 12px;"
        >
          {{ loading ? '创建中...' : '生成 8 位临时密码' }}
        </button>

        <div
          *ngIf="error"
          style="margin-top:12px;padding:10px;border:1px solid #f2b8b5;background:#fff1f0;border-radius:8px;"
        >
          <div style="font-weight:bold;color:#b00020;">请求失败</div>
          <div style="margin-top:6px;color:#b00020;white-space:pre-wrap;">{{ error }}</div>
        </div>
      </div>

      <div
        *ngIf="result"
        style="margin-top:16px;padding:12px;border:1px solid #cfe8cf;background:#f3fff3;border-radius:8px;"
      >
        <div style="font-weight:bold;">创建成功</div>

        <div style="margin-top:8px;">
          <div><b>用户名：</b> {{ result.username }}</div>

          <div style="margin-top:10px;">
            <b>临时密码（仅显示一次）：</b>
            <div style="font-size:13px;color:#666;margin-top:4px;">
              请立即复制给对方。刷新页面后不会再次显示。
            </div>

            <pre
              style="margin:8px 0 0;padding:10px;background:#fff;border:1px solid #ddd;border-radius:6px;font-size:16px;"
            >{{ result.tempPassword }}</pre>
          </div>

          <div style="margin-top:10px;color:#666;">
            首次登录将强制修改密码。
          </div>
        </div>
      </div>
    </div>
  `,
})
export class TeacherInvitesComponent {
  username = '';
  displayName = '';
  loading = false;
  error = '';
  result: null | CreateTeacherInviteResponse = null;

  constructor(
    private inviteApi: TeacherInviteService,
    private cdr: ChangeDetectorRef
  ) {}

  create(): void {
    if (this.loading) return;

    this.error = '';
    this.result = null;
    this.loading = true;
    this.cdr.detectChanges();

    this.inviteApi
      .createInvite(this.username.trim(), this.displayName.trim())
      .pipe(
        finalize((): void => {
          this.loading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (res: CreateTeacherInviteResponse): void => {
          this.result = res;
          this.cdr.detectChanges();
        },
        error: (e: HttpErrorResponse): void => {
          console.error('[Invite error]', e);
          console.error('[Invite error body]', (e as any).error);

          const status = e?.status;

          let msg = '';
          const body: any = (e as any).error;

          // 后端 JSON: { status, message }
          if (body && typeof body === 'object') {
            msg = body.message ? String(body.message) : JSON.stringify(body);
          } else if (typeof body === 'string') {
            msg = body;
          } else {
            msg = e?.message || '请求失败';
          }

          this.error = status ? `${status} ${msg}` : msg;

          this.cdr.detectChanges();
        },
      });
  }
}
