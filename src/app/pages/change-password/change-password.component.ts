import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import { AuthService, ApiResponse, SetPasswordRequest } from '../../services/auth.service';
import { evaluatePasswordPolicy, PasswordPolicyCheck } from '../../utils/password-policy';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div style="max-width:760px;margin:40px auto;font-family:Arial">
      <h2>设置新密码</h2>

      <p style="color:#666; line-height:1.6;">
        首次登录必须修改密码。
        <br/>后端接口：<code>/api/auth/set-password</code>
      </p>

      <div style="margin-top:14px; padding:12px; border:1px solid #ddd; border-radius:8px;">
        <label style="display:block;margin:12px 0 6px;">新密码</label>
        <input [(ngModel)]="newPassword" type="password"
               [disabled]="loading"
               style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;" />
        <div style="margin-top:8px; padding:10px; border:1px solid #e2e2e2; border-radius:6px; background:#fafafa;">
          <div style="font-size:13px; font-weight:bold; margin-bottom:6px;">密码要求</div>
          <div *ngFor="let check of passwordChecks" style="font-size:13px; line-height:1.5;">
            <span [style.color]="check.pass ? '#0b6b0b' : '#b00020'">
              {{ check.pass ? '\u2713' : '\u2717' }}
            </span>
            {{ check.label }}
          </div>
        </div>

        <label style="display:block;margin:12px 0 6px;">确认新密码</label>
        <input [(ngModel)]="confirmPassword" type="password"
               [disabled]="loading"
               style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;" />

        <button type="button" (click)="submit()"
                [disabled]="loading"
                style="margin-top:12px;padding:10px 12px;">
          {{ loading ? '保存中...' : '设置密码' }}
        </button>

        <p *ngIf="successMsg" style="color:#0b6b0b;margin:10px 0 0;">{{ successMsg }}</p>
        <p *ngIf="error" style="color:#b00020;margin:10px 0 0;">{{ error }}</p>
      </div>
    </div>
  `,
})
export class ChangePasswordComponent implements OnInit {
  newPassword = '';
  confirmPassword = '';

  error = '';
  successMsg = '';
  loading = false;

  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  get passwordChecks(): PasswordPolicyCheck[] {
    const username = this.auth.getSession()?.username || '';
    return evaluatePasswordPolicy(this.newPassword, username).checks;
  }

  ngOnInit(): void {
    const authHeader = this.auth.getAuthorizationHeaderValue();
    if (!authHeader) {
      this.error = '登录会话已失效，请重新登录。';
    }
  }

  submit(): void {
    this.error = '';
    this.successMsg = '';

    const authHeader = this.auth.getAuthorizationHeaderValue();
    if (!authHeader) {
      this.error = '登录会话已失效，请重新登录。';
      return;
    }

    if (!this.newPassword || !this.confirmPassword) {
      this.error = '请填写完整信息。';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.error = '两次输入的密码不一致。';
      return;
    }

    const username = this.auth.getSession()?.username || '';
    const policy = evaluatePasswordPolicy(this.newPassword, username);
    if (!policy.isValid) {
      this.error = policy.message;
      return;
    }

    const payload: SetPasswordRequest = {
      newPassword: this.newPassword,
    };

    this.loading = true;

    this.auth
      .setPassword(payload)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res: ApiResponse) => {
          this.auth.clearMustChangePasswordFlag();
          this.successMsg = res?.message || '密码设置成功。';

          const role = String(this.auth.getSession()?.role || '').toUpperCase();
          const redirectTo = role === 'TEACHER' || role === 'ADMIN' ? '/teacher/dashboard' : '/dashboard';

          setTimeout(() => {
            this.router.navigate([redirectTo]);
          }, 500);
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.extractErrorMessage(err) || '设置密码失败。';
        },
      });
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    const payload = err?.error;

    if (payload && typeof payload === 'object') {
      return (payload as any).message || (payload as any).error || '';
    }

    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        return parsed?.message || parsed?.error || payload;
      } catch {
        return payload;
      }
    }

    return err?.message || '';
  }
}

