import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { HttpErrorResponse } from '@angular/common/http';

import type { LoginResponse } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
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
            this.router.navigate(['/teacher/change-password'], {
              queryParams: { username },
            });
            return;
          }

          if ((resp?.role || '').toUpperCase() === 'TEACHER') {
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
      return (payload as any).message || (payload as any).error || '';
    }

    // 字符串（JSON 字符串或纯文本）
    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        return parsed?.message || parsed?.error || payload;
      } catch {
        return payload;
      }
    }

    return httpErr?.message || '';
  }
}
