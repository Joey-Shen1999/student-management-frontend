import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
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
      <h2>Set New Password</h2>

      <p style="color:#666; line-height:1.6;">
        First login must change password.
        <br/>Backend API: <code>/api/auth/set-password</code>
      </p>

      <div style="margin-top:14px; padding:12px; border:1px solid #ddd; border-radius:8px;">
        <label style="display:block;margin:12px 0 6px;">New password</label>
        <input [(ngModel)]="newPassword" type="password"
               [disabled]="loading"
               style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;" />
        <div style="margin-top:8px; padding:10px; border:1px solid #e2e2e2; border-radius:6px; background:#fafafa;">
          <div style="font-size:13px; font-weight:bold; margin-bottom:6px;">Password requirements</div>
          <div *ngFor="let check of passwordChecks" style="font-size:13px; line-height:1.5;">
            <span [style.color]="check.pass ? '#0b6b0b' : '#b00020'">
              {{ check.pass ? '\u2713' : '\u2717' }}
            </span>
            {{ check.label }}
          </div>
        </div>

        <label style="display:block;margin:12px 0 6px;">Confirm new password</label>
        <input [(ngModel)]="confirmPassword" type="password"
               [disabled]="loading"
               style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;" />

        <button type="button" (click)="submit()"
                [disabled]="loading"
                style="margin-top:12px;padding:10px 12px;">
          {{ loading ? 'Saving...' : 'Set Password' }}
        </button>

        <p *ngIf="successMsg" style="color:#0b6b0b;margin:10px 0 0;">{{ successMsg }}</p>
        <p *ngIf="error" style="color:#b00020;margin:10px 0 0;">{{ error }}</p>
      </div>

      <div style="margin-top:12px;">
        <a routerLink="/teacher/dashboard">Back to dashboard</a>
      </div>
    </div>
  `,
})
export class ChangePasswordComponent implements OnInit {
  userId: number | null = null;

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

  get passwordChecks(): PasswordPolicyCheck[] {
    const username = this.auth.getSession()?.username || '';
    return evaluatePasswordPolicy(this.newPassword, username).checks;
  }

  ngOnInit(): void {
    const raw = this.route.snapshot.queryParamMap.get('userId');
    const parsed = raw ? Number(raw) : NaN;
    const sessionUserId = this.auth.getSession()?.userId;

    if (Number.isFinite(parsed) && parsed > 0) {
      this.userId = parsed;
    } else if (typeof sessionUserId === 'number' && Number.isFinite(sessionUserId) && sessionUserId > 0) {
      this.userId = sessionUserId;
    }

    if (!this.userId) {
      this.error = 'Missing user id. Please login again.';
    }
  }

  submit(): void {
    this.error = '';
    this.successMsg = '';

    if (!this.userId) {
      this.error = 'Invalid user.';
      return;
    }

    if (!this.newPassword || !this.confirmPassword) {
      this.error = 'Please fill in all fields.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }

    const username = this.auth.getSession()?.username || '';
    const policy = evaluatePasswordPolicy(this.newPassword, username);
    if (!policy.isValid) {
      this.error = policy.message;
      return;
    }

    const payload: SetPasswordRequest = {
      userId: this.userId,
      newPassword: this.newPassword,
    };

    this.loading = true;

    this.auth
      .setPassword(payload)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res: ApiResponse) => {
          this.auth.clearMustChangePasswordFlag();
          this.successMsg = res?.message || 'Password set successfully.';

          setTimeout(() => {
            this.router.navigate(['/teacher/dashboard']);
          }, 500);
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.extractErrorMessage(err) || 'Failed to set password.';
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

