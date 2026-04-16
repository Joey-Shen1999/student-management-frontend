import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import type { LoginResponse } from '../../services/auth.service';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../shared/i18n/translate.pipe';
import { LocalizedText, uiText } from '../../shared/i18n/ui-translations';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './login.html',
})
export class Login implements OnInit {
  readonly ui = {
    title: uiText('登录', 'Log In'),
    username: uiText('用户名', 'Username'),
    password: uiText('密码', 'Password'),
    rememberUsername: uiText('记住用户名（30天）', 'Remember Username (30 days)'),
    rememberPassword: uiText('记住密码（30天）', 'Remember Password (30 days)'),
    signIn: uiText('登录', 'Log In'),
    signingIn: uiText('登录中...', 'Signing in...'),
    processing: uiText('请求处理中...', 'Processing request...'),
    emptyCredentials: uiText('请输入用户名和密码。', 'Please enter your username and password.'),
    loginFailed: uiText('登录失败。', 'Log in failed.'),
    archivedAccount: uiText(
      '该账号已归档，请联系管理员启用。',
      'This account has been archived. Please contact an administrator to reactivate it.'
    ),
  };

  username = '';
  password = '';
  error: string | LocalizedText = '';
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
      this.error = this.ui.emptyCredentials;
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
          } else if (this.shouldRedirectStudentToProfileSetup(resp)) {
            this.router.navigate(['/student/profile'], {
              queryParams: { onboarding: '1' },
            });
          } else {
            this.router.navigate(['/dashboard']);
          }
        },
        error: (err: unknown) => {
          const message = this.extractErrorMessage(err);
          this.error = message || this.ui.loginFailed;
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

  private extractErrorMessage(err: unknown): string | LocalizedText {
    const httpErr = err as HttpErrorResponse;
    const payload = httpErr?.error;

    if (payload && typeof payload === 'object') {
      const code = String((payload as Record<string, unknown>)['code'] || '').toUpperCase();
      if (this.isArchivedAccountCode(code)) {
        return this.ui.archivedAccount;
      }

      const message =
        (payload as Record<string, unknown>)['message'] ||
        (payload as Record<string, unknown>)['error'] ||
        '';
      if (this.looksLikeArchivedMessage(message)) {
        return this.ui.archivedAccount;
      }

      return String(message || '').trim();
    }

    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload) as Record<string, unknown>;
        const code = String(parsed['code'] || '').toUpperCase();
        if (this.isArchivedAccountCode(code)) {
          return this.ui.archivedAccount;
        }

        const message = parsed['message'] || parsed['error'] || payload;
        if (this.looksLikeArchivedMessage(message)) {
          return this.ui.archivedAccount;
        }

        return String(message || '').trim();
      } catch {
        if (this.looksLikeArchivedMessage(payload)) {
          return this.ui.archivedAccount;
        }
        return payload;
      }
    }

    return String(httpErr?.message || '').trim();
  }

  private isArchivedAccountCode(code: string): boolean {
    return code === 'ACCOUNT_ARCHIVED' || code === 'USER_ARCHIVED' || code === 'TEACHER_ARCHIVED';
  }

  private looksLikeArchivedMessage(message: unknown): boolean {
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

  private shouldRedirectStudentToProfileSetup(resp: LoginResponse): boolean {
    const role = String(resp?.role || '')
      .trim()
      .toUpperCase();
    if (role !== 'STUDENT') {
      return false;
    }

    const requiresProfileCompletion = this.toOptionalBoolean(
      resp?.requiresProfileCompletion ?? resp?.mustCompleteProfile
    );
    if (requiresProfileCompletion !== null) {
      return requiresProfileCompletion;
    }

    const firstLogin = this.toOptionalBoolean(resp?.firstLogin ?? resp?.isFirstLogin);
    if (firstLogin === true) {
      return true;
    }

    const profileCompleted = this.toOptionalBoolean(resp?.profileCompleted ?? resp?.isProfileCompleted);
    if (profileCompleted === false) {
      return true;
    }

    const onboardingState = String(resp?.onboardingState || '')
      .trim()
      .toUpperCase();
    return onboardingState === 'FIRST_LOGIN' || onboardingState === 'PROFILE_REQUIRED';
  }

  private toOptionalBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value;
    if (value === null || value === undefined) return null;

    const text = String(value).trim().toLowerCase();
    if (text === 'true' || text === '1' || text === 'yes') return true;
    if (text === 'false' || text === '0' || text === 'no') return false;
    return null;
  }
}
