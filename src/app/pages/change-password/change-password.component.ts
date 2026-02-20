import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule, HttpErrorResponse } from '@angular/common/http';

type SetPasswordRequest = {
  userId: number;
  newPassword: string;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
};

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HttpClientModule],
  template: `
    <div style="max-width:760px;margin:40px auto;font-family:Arial">
      <h2>Set New Password</h2>

      <p style="color:#666; line-height:1.6;">
        首次登录必须改密码。
        <br/>后端 API：<code>/api/auth/set-password</code>
      </p>

      <div style="margin-top:14px; padding:12px; border:1px solid #ddd; border-radius:8px;">
        <label style="display:block;margin:12px 0 6px;">New password</label>
        <input [(ngModel)]="newPassword" type="password"
               [disabled]="loading"
               style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;" />

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
        <a routerLink="/teacher/dashboard">← Back to dashboard</a>
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
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    const raw = this.route.snapshot.queryParamMap.get('username'); // 你目前用 username=4
    const parsed = raw ? Number(raw) : NaN;
    this.userId = Number.isFinite(parsed) ? parsed : null;

    if (!this.userId) {
      this.error = 'Missing user id.';
    }
  }

  submit() {
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

    if (this.newPassword.length < 8) {
      this.error = 'Password must be at least 8 characters.';
      return;
    }

    const payload: SetPasswordRequest = {
      userId: this.userId,
      newPassword: this.newPassword,
    };

    this.loading = true;

    this.http.post<ApiResponse>('/api/auth/set-password', payload).subscribe({
      next: (res) => {
        this.loading = false;
        this.successMsg = res?.message || 'Password set successfully.';

        setTimeout(() => {
          this.router.navigate(['/teacher/dashboard']);
        }, 500);
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.error = err.error?.message || 'Failed to set password.';
      }
    });
  }
}
