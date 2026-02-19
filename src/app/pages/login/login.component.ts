import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div style="max-width:360px;margin:60px auto;font-family:Arial">
      <h2>Login</h2>

      <label style="display:block;margin:12px 0 6px;">Username</label>
      <input
        [(ngModel)]="username"
        (keyup.enter)="onSubmit()"
        style="width:100%; padding:8px;"
        autocomplete="username"
      />

      <label style="display:block;margin:12px 0 6px;">Password</label>
      <input
        [(ngModel)]="password"
        type="password"
        (keyup.enter)="onSubmit()"
        style="width:100%; padding:8px;"
        autocomplete="current-password"
      />

      <button
        type="button"
        (click)="onSubmit()"
        [disabled]="loading"
        style="margin-top:14px;padding:10px 14px;width:100%;"
      >
        {{ loading ? 'Logging in...' : 'Login' }}
      </button>

      <!-- 注册入口 -->
      <div style="margin-top:14px;text-align:center;">
        <span style="color:#666;">No account?</span>
        <a
          routerLink="/register"
          style="margin-left:6px;text-decoration:underline;cursor:pointer;"
        >
          Create one
        </a>
      </div>

      @if (error) {
        <p style="color:red; margin-top:12px;">{{ error }}</p>
      }
    </div>
  `,
})
export class LoginComponent {
  username = '';
  password = '';
  error = '';
  loading = false;

  constructor(private auth: AuthService, private router: Router) {}

  onSubmit() {
    if (this.loading) return;

    this.error = '';

    const username = this.username.trim();
    if (!username || !this.password) {
      this.error = 'Username and password are required.';
      return;
    }

    this.loading = true;

    this.auth
      .login({ username, password: this.password })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (resp) => {
          // ✅ 根据角色跳转
          if (resp?.role === 'TEACHER') {
            this.router.navigate(['/teacher/dashboard']);
          } else {
            this.router.navigate(['/dashboard']);
          }
        },
        error: (err) => {
          const msg =
            err?.error?.message ??
            err?.error?.error ??
            err?.message ??
            (typeof err?.error === 'string' ? err.error : '') ??
            'Login failed';

          this.error = msg;
        },
      });
  }
}
