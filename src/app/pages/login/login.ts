import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../services/auth.service';
import type { LoginResponse } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
})
export class Login implements OnInit {
  username = '';
  password = '';
  error = '';
  loading = false;
  rememberUsername = true;
  rememberPassword = true;

  private readonly rememberedUsernameCookieKey = 'sm_remember_username';
  private readonly rememberedUsernameDays = 30;
  private readonly rememberedPasswordCookieKey = 'sm_remember_password';
  private readonly rememberedPasswordDays = 30;

  constructor(
    private auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const rememberedUsername = this.getCookie(this.rememberedUsernameCookieKey);
    if (rememberedUsername) {
      this.username = rememberedUsername;
      this.rememberUsername = true;
    }

    const rememberedPassword = this.getCookie(this.rememberedPasswordCookieKey);
    if (rememberedPassword) {
      this.password = rememberedPassword;
      this.rememberPassword = true;
    }
  }

  onSubmit(): void {
    if (this.loading) return;

    this.error = '';

    const username = (this.username || '').trim();
    const password = this.password || '';

    if (!username || !password) {
      this.error = '请输入用户名和密码。';
      this.cdr.detectChanges();
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();

    this.auth
      .login({ username, password })
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (resp: LoginResponse) => {
          this.persistRememberedUsername(username);
          this.persistRememberedPassword(password);

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
          const msg = this.extractErrorMessage(err);
          this.error = msg || '登录失败。';
          this.cdr.detectChanges();
        },
      });
  }

  private persistRememberedUsername(username: string): void {
    if (this.rememberUsername) {
      this.setCookie(this.rememberedUsernameCookieKey, username, this.rememberedUsernameDays);
      return;
    }

    this.deleteCookie(this.rememberedUsernameCookieKey);
  }

  private persistRememberedPassword(password: string): void {
    if (this.rememberPassword) {
      this.setCookie(this.rememberedPasswordCookieKey, password, this.rememberedPasswordDays);
      return;
    }

    this.deleteCookie(this.rememberedPasswordCookieKey);
  }

  private extractErrorMessage(err: unknown): string {
    const httpErr = err as HttpErrorResponse;
    const payload = httpErr?.error;

    if (payload && typeof payload === 'object') {
      const code = String((payload as any).code || '').toUpperCase();
      if (this.isArchivedAccountCode(code)) {
        return '该账号已归档，请联系管理员启用。';
      }

      const message = (payload as any).message || (payload as any).error || '';
      if (this.looksLikeArchivedMessage(message)) {
        return '该账号已归档，请联系管理员启用。';
      }

      return message;
    }

    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        const code = String(parsed?.code || '').toUpperCase();
        if (this.isArchivedAccountCode(code)) {
          return '该账号已归档，请联系管理员启用。';
        }

        const message = parsed?.message || parsed?.error || payload;
        if (this.looksLikeArchivedMessage(message)) {
          return '该账号已归档，请联系管理员启用。';
        }

        return message;
      } catch {
        if (this.looksLikeArchivedMessage(payload)) {
          return '该账号已归档，请联系管理员启用。';
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

  private setCookie(name: string, value: string, days: number): void {
    if (typeof document === 'undefined') {
      return;
    }

    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  }

  private getCookie(name: string): string {
    if (typeof document === 'undefined') {
      return '';
    }

    const target = `${name}=`;
    const cookies = String(document.cookie || '').split(';');

    for (const rawCookie of cookies) {
      const cookie = rawCookie.trim();
      if (!cookie.startsWith(target)) {
        continue;
      }

      return decodeURIComponent(cookie.slice(target.length));
    }

    return '';
  }

  private deleteCookie(name: string): void {
    if (typeof document === 'undefined') {
      return;
    }

    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  }
}
