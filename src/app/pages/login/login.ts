import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { HttpErrorResponse } from '@angular/common/http';

import type { LoginResponse } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
})
export class Login {
  username = '';
  password = '';
  error = '';
  loading = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  onSubmit(): void {
    if (this.loading) return;

    this.error = '';

    const username = (this.username || '').trim();
    const password = this.password || '';

    if (!username || !password) {
      this.error = 'Username and password are required.';
      this.cdr.detectChanges();
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();

    this.auth
      .login({ username, password })
      .pipe(
        finalize(() => {
          // ✅ 兜底：无论如何都解锁
          this.loading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (resp: LoginResponse) => {
          // ✅ 成功也解锁（双保险）
          this.loading = false;
          this.cdr.detectChanges();

          if (resp?.mustChangePassword) {
            this.router.navigate(['/change-password'], {
              queryParams: { userId: resp.userId },
            });
            return;
          }

          const role = (resp?.role || '').toUpperCase();
          if (role === 'TEACHER' || role === 'ADMIN') {
            this.router.navigate(['/teacher/dashboard']);
          } else {
            this.router.navigate(['/dashboard']);
          }
        },
        error: (err: unknown) => {
          // ✅ 失败立刻解锁 + 显示错误（双保险）
          this.loading = false;

          const msg = this.extractErrorMessage(err);
          this.error = msg || 'Login failed';

          this.cdr.detectChanges();
        },
      });
  }

  private extractErrorMessage(err: unknown): string {
    const httpErr = err as HttpErrorResponse;
    const payload = httpErr?.error;

    // 后端 JSON：{ status, message }
    if (payload && typeof payload === 'object') {
      const code = String((payload as any).code || '').toUpperCase();
      if (this.isArchivedAccountCode(code)) {
        return 'This account has been archived. Please contact an admin to enable it.';
      }

      const message = (payload as any).message || (payload as any).error || '';
      if (this.looksLikeArchivedMessage(message)) {
        return 'This account has been archived. Please contact an admin to enable it.';
      }

      return message;
    }

    // 字符串（JSON 字符串或纯文本）
    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        const code = String(parsed?.code || '').toUpperCase();
        if (this.isArchivedAccountCode(code)) {
          return 'This account has been archived. Please contact an admin to enable it.';
        }

        const message = parsed?.message || parsed?.error || payload;
        if (this.looksLikeArchivedMessage(message)) {
          return 'This account has been archived. Please contact an admin to enable it.';
        }

        return message;
      } catch {
        if (this.looksLikeArchivedMessage(payload)) {
          return 'This account has been archived. Please contact an admin to enable it.';
        }
        return payload;
      }
    }

    return httpErr?.message || '';
  }

  private isArchivedAccountCode(code: string): boolean {
    return code === 'ACCOUNT_ARCHIVED' || code === 'USER_ARCHIVED' || code === 'TEACHER_ARCHIVED';
  }

  private looksLikeArchivedMessage(message: string): boolean {
    return String(message || '').toLowerCase().includes('archived');
  }
}
