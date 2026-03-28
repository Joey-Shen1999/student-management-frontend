import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import {
  ApiResponse,
  AuthService,
  ChangePasswordRequest,
  SetPasswordRequest,
} from '../../services/auth.service';
import { evaluatePasswordPolicy, PasswordPolicyCheck } from '../../utils/password-policy';

type PasswordMode = 'set' | 'change';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div style="max-width:760px;margin:40px auto;font-family:Arial">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <h2 style="margin:0;">{{ isSetMode ? 'Set New Password' : 'Password change' }}</h2>
        <button
          *ngIf="!isSetMode"
          type="button"
          [routerLink]="[backRoute]"
          class="account-back-btn"
          style="margin-left:auto;"
        >
          Back
        </button>
      </div>

      <p style="color:#666; line-height:1.6;">
        <ng-container *ngIf="isSetMode; else changeModeTip">
          For security reasons, your first sign-in requires setting a new password before continuing.
        </ng-container>
        <ng-template #changeModeTip>
          Use this page to securely update your account password.
        </ng-template>
      </p>

      <div style="margin-top:14px; padding:12px; border:1px solid #ddd; border-radius:8px;">
        <div *ngIf="!isSetMode">
          <label style="display:block;margin:12px 0 6px;">Current Password</label>
          <input
            [(ngModel)]="oldPassword"
            type="password"
            [disabled]="loading"
            class="account-input"
            style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;"
          />
        </div>

        <label style="display:block;margin:12px 0 6px;">New Password</label>
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
          <div style="font-size:13px; font-weight:bold; margin-bottom:6px;">Password Policy</div>
          <div *ngFor="let check of passwordChecks" style="font-size:13px; line-height:1.5;">
            <span [style.color]="check.pass ? '#0b6b0b' : '#b00020'">
              {{ check.pass ? '\u2713' : '\u2717' }}
            </span>
            {{ check.label }}
          </div>
        </div>

        <label style="display:block;margin:12px 0 6px;">Confirm New Password</label>
        <input
          [(ngModel)]="confirmPassword"
          type="password"
          [disabled]="loading"
          class="account-input"
          style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;"
        />

        <div style="display:flex;align-items:center;gap:12px;margin-top:12px;flex-wrap:wrap;">
          <button type="button" (click)="submit()" [disabled]="loading" style="padding:10px 12px;">
            {{ loading ? 'Saving...' : submitLabel }}
          </button>
        </div>

        <p *ngIf="successMsg" style="color:#0b6b0b;margin:10px 0 0;">{{ successMsg }}</p>
        <p *ngIf="error" style="color:#b00020;margin:10px 0 0;">{{ error }}</p>
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
  mode: PasswordMode = 'set';
  oldPassword = '';
  newPassword = '';
  confirmPassword = '';

  error = '';
  successMsg = '';
  loading = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  get isSetMode(): boolean {
    return this.mode === 'set';
  }

  get submitLabel(): string {
    return this.isSetMode ? 'Set Password' : 'Change Password';
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
      this.error = 'Login session expired. Please sign in again.';
    }
  }

  submit(): void {
    this.error = '';
    this.successMsg = '';

    const authHeader = this.auth.getAuthorizationHeaderValue();
    if (!authHeader) {
      this.error = 'Login session expired. Please sign in again.';
      return;
    }

    if (!this.newPassword || !this.confirmPassword) {
      this.error = 'Please complete all required fields.';
      return;
    }

    if (!this.isSetMode && !this.oldPassword) {
      this.error = 'Current password is required.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.error = 'The new password confirmation does not match.';
      return;
    }

    if (!this.isSetMode && this.oldPassword === this.newPassword) {
      this.error = 'New password must be different from current password.';
      return;
    }

    const username = this.auth.getSession()?.username || '';
    const policy = evaluatePasswordPolicy(this.newPassword, username);
    if (!policy.isValid) {
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
          this.error = this.extractErrorMessage(err) || 'Password update failed.';
        },
      });
  }

  private onSaveSuccess(res: ApiResponse): void {
    this.successMsg = res?.message || (this.isSetMode ? 'Password set successfully.' : 'Password updated.');

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
