import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';

import {
  ApiResponse,
  AuthService,
  ChangePasswordRequest,
  SetPasswordRequest,
} from '../../services/auth.service';
import { TranslatePipe } from '../../shared/i18n/translate.pipe';
import { LocalizedText, uiText } from '../../shared/i18n/ui-translations';
import { evaluatePasswordPolicy, PasswordPolicyCheck } from '../../utils/password-policy';

type PasswordMode = 'set' | 'change';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslatePipe],
  template: `
    <div style="max-width:760px;margin:40px auto;font-family:Arial">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <h2 style="margin:0;">{{ (isSetMode ? ui.setModeTitle : ui.changeModeTitle) | appTranslate }}</h2>
        <button
          *ngIf="!isSetMode"
          type="button"
          [routerLink]="[backRoute]"
          class="account-back-btn"
          style="margin-left:auto;"
        >
          {{ ui.back | appTranslate }}
        </button>
      </div>

      <p style="color:#666; line-height:1.6;">
        <ng-container *ngIf="isSetMode; else changeModeTip">
          {{ ui.setModeTip | appTranslate }}
        </ng-container>
        <ng-template #changeModeTip>
          {{ ui.changeModeTip | appTranslate }}
        </ng-template>
      </p>

      <div style="margin-top:14px; padding:12px; border:1px solid #ddd; border-radius:8px;">
        <div *ngIf="!isSetMode">
          <label style="display:block;margin:12px 0 6px;">{{ ui.currentPassword | appTranslate }}</label>
          <input
            [(ngModel)]="oldPassword"
            type="password"
            [disabled]="loading"
            class="account-input"
            style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;"
          />
        </div>

        <label style="display:block;margin:12px 0 6px;">{{ ui.newPassword | appTranslate }}</label>
        <input
          [(ngModel)]="newPassword"
          type="password"
          [disabled]="loading"
          class="account-input"
          style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;"
        />

        <div
          style="margin-top:8px; padding:10px; border:1px solid #e2e2e2; border-radius:6px; background:#fafafa;"
        >
          <div style="font-size:13px; font-weight:bold; margin-bottom:6px;">
            {{ ui.passwordPolicy | appTranslate }}
          </div>
          <div *ngFor="let check of passwordChecks" style="font-size:13px; line-height:1.5;">
            <span [style.color]="check.pass ? '#0b6b0b' : '#b00020'">
              {{ check.pass ? '\u2713' : '\u2717' }}
            </span>
            {{ check.label | appTranslate }}
          </div>
        </div>

        <label style="display:block;margin:12px 0 6px;">{{ ui.confirmNewPassword | appTranslate }}</label>
        <input
          [(ngModel)]="confirmPassword"
          type="password"
          [disabled]="loading"
          class="account-input"
          style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;"
        />

        <div style="display:flex;align-items:center;gap:12px;margin-top:12px;flex-wrap:wrap;">
          <button type="button" (click)="submit()" [disabled]="loading" style="padding:10px 12px;">
            {{ (loading ? ui.saving : submitLabel) | appTranslate }}
          </button>
        </div>

        <p *ngIf="successMsg" style="color:#0b6b0b;margin:10px 0 0;">{{ successMsg | appTranslate }}</p>
        <p *ngIf="error" style="color:#b00020;margin:10px 0 0;">{{ error | appTranslate }}</p>
      </div>
    </div>
  `,
  styles: [
    `
      .account-input {
        box-sizing: border-box;
        max-width: 100%;
      }

      .account-back-btn {
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
        transition:
          border-color 0.15s ease,
          box-shadow 0.15s ease,
          transform 0.15s ease;
      }

      .account-back-btn:hover {
        border-color: #9db2d0;
        box-shadow: 0 10px 22px rgba(21, 40, 68, 0.16);
        transform: translateY(-1px);
      }

      .account-back-btn:focus-visible {
        outline: 2px solid #8aa8d3;
        outline-offset: 2px;
      }
    `,
  ],
})
export class ChangePasswordComponent implements OnInit {
  readonly ui = {
    setModeTitle: uiText('设置新密码', 'Set New Password'),
    changeModeTitle: uiText('账号设置', 'Account Settings'),
    back: uiText('返回', 'Back'),
    setModeTip: uiText(
      '为了账号安全，首次登录后需要先设置新密码，才能继续使用系统。',
      'For security reasons, your first sign-in requires setting a new password before continuing.'
    ),
    changeModeTip: uiText(
      '你可以在这里安全地更新账号密码。',
      'Use this page to securely update your account password.'
    ),
    currentPassword: uiText('当前密码', 'Current Password'),
    newPassword: uiText('新密码', 'New Password'),
    passwordPolicy: uiText('密码规则', 'Password Policy'),
    confirmNewPassword: uiText('确认新密码', 'Confirm New Password'),
    saving: uiText('保存中...', 'Saving...'),
    setPassword: uiText('设置密码', 'Set Password'),
    changePassword: uiText('修改密码', 'Change Password'),
    sessionExpired: uiText('登录会话已过期，请重新登录。', 'Login session expired. Please sign in again.'),
    requiredFields: uiText('请填写所有必填项。', 'Please complete all required fields.'),
    currentPasswordRequired: uiText('请输入当前密码。', 'Current password is required.'),
    confirmationMismatch: uiText('新密码确认不匹配。', 'The new password confirmation does not match.'),
    newPasswordDifferent: uiText(
      '新密码必须与当前密码不同。',
      'New password must be different from current password.'
    ),
    updateFailed: uiText('密码更新失败。', 'Password update failed.'),
    setSuccess: uiText('密码设置成功。', 'Password set successfully.'),
    updateSuccess: uiText('密码已更新。', 'Password updated.'),
  };

  mode: PasswordMode = 'set';
  oldPassword = '';
  newPassword = '';
  confirmPassword = '';

  error: string | LocalizedText = '';
  successMsg: string | LocalizedText = '';
  loading = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  get isSetMode(): boolean {
    return this.mode === 'set';
  }

  get submitLabel(): LocalizedText {
    return this.isSetMode ? this.ui.setPassword : this.ui.changePassword;
  }

  get backRoute(): string {
    const role = String(this.auth.getSession()?.role || '').toUpperCase();
    return role === 'TEACHER' || role === 'ADMIN' ? '/teacher/dashboard' : '/dashboard';
  }

  get passwordChecks(): PasswordPolicyCheck[] {
    const username = this.auth.getSession()?.username || '';
    return evaluatePasswordPolicy(this.newPassword, username).checks;
  }

  ngOnInit(): void {
    this.mode = this.resolvePasswordMode();

    const authHeader = this.auth.getAuthorizationHeaderValue();
    if (!authHeader) {
      this.error = this.ui.sessionExpired;
    }
  }

  submit(): void {
    this.error = '';
    this.successMsg = '';

    const authHeader = this.auth.getAuthorizationHeaderValue();
    if (!authHeader) {
      this.error = this.ui.sessionExpired;
      return;
    }

    if (!this.newPassword || !this.confirmPassword) {
      this.error = this.ui.requiredFields;
      return;
    }

    if (!this.isSetMode && !this.oldPassword) {
      this.error = this.ui.currentPasswordRequired;
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.error = this.ui.confirmationMismatch;
      return;
    }

    if (!this.isSetMode && this.oldPassword === this.newPassword) {
      this.error = this.ui.newPasswordDifferent;
      return;
    }

    const username = this.auth.getSession()?.username || '';
    const policy = evaluatePasswordPolicy(this.newPassword, username);
    if (!policy.isValid && policy.message) {
      this.error = policy.message;
      return;
    }

    this.loading = true;

    const request$ = this.isSetMode
      ? this.auth.setPassword({
          newPassword: this.newPassword,
        } satisfies SetPasswordRequest)
      : this.auth.changePassword({
          oldPassword: this.oldPassword,
          newPassword: this.newPassword,
        } satisfies ChangePasswordRequest);

    request$
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res: ApiResponse) => {
          this.onSaveSuccess(res);
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.extractErrorMessage(err) || this.ui.updateFailed;
        },
      });
  }

  private onSaveSuccess(res: ApiResponse): void {
    this.successMsg = res?.message || (this.isSetMode ? this.ui.setSuccess : this.ui.updateSuccess);

    if (this.isSetMode) {
      this.auth.clearMustChangePasswordFlag();
      setTimeout(() => {
        this.router.navigate([this.backRoute]);
      }, 500);
      return;
    }

    this.oldPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
  }

  private resolvePasswordMode(): PasswordMode {
    if (this.auth.mustChangePassword()) {
      return 'set';
    }

    const modeInData = String(this.route.snapshot.data['passwordMode'] || '').toLowerCase();
    if (modeInData === 'set' || modeInData === 'change') {
      return modeInData;
    }

    return 'change';
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    const payload = err?.error;

    if (payload && typeof payload === 'object') {
      const details = this.extractValidationDetails(payload as Record<string, unknown>);
      const message = String((payload as any).message || (payload as any).error || '').trim();
      if (!message) return details;
      if (!details || message.includes(details)) return message;
      return `${message} ${details}`;
    }

    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        const details = this.extractValidationDetails(parsed as Record<string, unknown>);
        const message = String(parsed?.message || parsed?.error || payload).trim();
        if (!message) return details;
        if (!details || message.includes(details)) return message;
        return `${message} ${details}`;
      } catch {
        return payload;
      }
    }

    return err?.message || '';
  }

  private extractValidationDetails(payload: Record<string, unknown>): string {
    const details = payload['details'];
    if (!Array.isArray(details) || details.length <= 0) return '';

    const normalized: string[] = [];
    for (const item of details) {
      if (item === null || item === undefined) continue;

      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
        const text = String(item).trim();
        if (text) normalized.push(text);
        continue;
      }

      if (typeof item === 'object') {
        const node = item as Record<string, unknown>;
        const field = String(node['field'] || node['path'] || '').trim();
        const message = String(node['message'] || node['error'] || '').trim();
        if (field && message) {
          normalized.push(`${field} ${message}`);
          continue;
        }
        if (message) {
          normalized.push(message);
        }
      }
    }

    return normalized.join('; ');
  }
}
