import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';

import {
  AuthService,
  RegisterRequest,
  RegisterResponse,
  StudentInvitePreviewResponse,
} from '../../services/auth.service';
import { TranslatePipe } from '../../shared/i18n/translate.pipe';
import { LocalizedText, uiText } from '../../shared/i18n/ui-translations';
import { evaluatePasswordPolicy, PasswordPolicyCheck } from '../../utils/password-policy';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslatePipe],
  templateUrl: './register.html',
})
export class RegisterComponent implements OnInit {
  readonly ui = {
    title: uiText('创建账号', 'Create Account'),
    inviteTitle: uiText('邀请注册', 'Invite Registration'),
    inviteDescription: uiText(
      '该链接仅可注册一个新的学生账号。',
      'This link can only be used to register one new student account.'
    ),
    inviteValidating: uiText('正在校验邀请链接...', 'Validating invitation link...'),
    inviteExpiresAt: uiText('过期时间', 'Expires At'),
    username: uiText('用户名', 'Username'),
    password: uiText('密码', 'Password'),
    passwordPolicy: uiText('密码要求', 'Password Requirements'),
    confirmPassword: uiText('确认密码', 'Confirm Password'),
    studentInfo: uiText('学生信息', 'Student Information'),
    lastName: uiText('姓', 'Last Name'),
    firstName: uiText('名', 'First Name'),
    preferredName: uiText('常用名', 'Preferred Name'),
    createAccount: uiText('创建账号', 'Create Account'),
    creatingAccount: uiText('注册中...', 'Creating account...'),
    alreadyHaveAccount: uiText('已有账号？', 'Already have an account?'),
    goToLogin: uiText('去登录', 'Go to Login'),
    inviteRequiredMessage: uiText(
      '缺少邀请链接，无法注册。请联系老师获取邀请链接。',
      'An invitation link is required to register. Please contact your teacher for a valid link.'
    ),
    inviteValidationInProgress: uiText(
      '邀请链接正在校验中，请稍后重试。',
      'The invitation link is still being validated. Please try again shortly.'
    ),
    credentialsRequired: uiText(
      '请输入用户名和密码。',
      'Please enter your username and password.'
    ),
    passwordMismatch: uiText(
      '两次输入的密码不一致。',
      'The password and confirmation password do not match.'
    ),
    registrationSuccess: uiText(
      '账号创建成功，正在跳转到登录页...',
      'Account created successfully. Redirecting to the login page...'
    ),
    registrationFailed: uiText('注册失败。', 'Registration failed.'),
    inviteInvalid: uiText(
      '该邀请链接无效、已过期或已被使用。',
      'This invite link is invalid, expired, or already used.'
    ),
  };

  role: 'STUDENT' = 'STUDENT';
  readonly inviteRequiredMessage = this.ui.inviteRequiredMessage;

  username = '';
  password = '';
  confirmPassword = '';

  firstName = '';
  lastName = '';
  preferredName = '';

  error: string | LocalizedText = '';
  success: string | LocalizedText = '';
  loading = false;
  inviteToken = '';
  inviteValidationLoading = false;
  inviteValidationError: string | LocalizedText = '';
  invitePreview: StudentInvitePreviewResponse | null = null;

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const inviteToken = String(this.route.snapshot.queryParamMap.get('inviteToken') || '').trim();
    if (!inviteToken) {
      this.inviteValidationError = this.inviteRequiredMessage;
      return;
    }

    this.inviteToken = inviteToken;
    this.validateInviteToken(inviteToken);
  }

  get passwordChecks(): PasswordPolicyCheck[] {
    return evaluatePasswordPolicy(this.password, this.username).checks;
  }

  submit(e?: Event): void {
    e?.preventDefault();

    if (this.loading) return;

    this.error = '';
    this.success = '';

    const payload: RegisterRequest = {
      username: this.username.trim(),
      password: this.password,
      role: this.role,
      firstName: this.firstName.trim(),
      lastName: this.lastName.trim(),
      preferredName: this.preferredName.trim(),
    };

    if (this.inviteToken) {
      payload.inviteToken = this.inviteToken;
    }

    if (!payload.username || !payload.password) {
      this.error = this.ui.credentialsRequired;
      return;
    }

    if (!this.inviteToken) {
      this.error = this.inviteRequiredMessage;
      return;
    }

    if (this.inviteValidationLoading) {
      this.error = this.ui.inviteValidationInProgress;
      return;
    }

    if (this.inviteValidationError) {
      this.error = this.inviteValidationError;
      return;
    }

    const policy = evaluatePasswordPolicy(this.password, this.username);
    if (!policy.isValid && policy.message) {
      this.error = policy.message;
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error = this.ui.passwordMismatch;
      return;
    }

    this.loading = true;

    this.auth
      .register(payload)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (_res: RegisterResponse) => {
          this.success = this.ui.registrationSuccess;
          setTimeout(() => this.router.navigate(['/login']), 600);
        },
        error: (err: { error?: { message?: string; error?: string }; message?: string }) => {
          this.error =
            err?.error?.message ||
            err?.error?.error ||
            err?.message ||
            this.ui.registrationFailed;
        },
      });
  }

  private validateInviteToken(inviteToken: string): void {
    this.inviteValidationLoading = true;
    this.inviteValidationError = '';
    this.invitePreview = null;

    this.auth
      .getStudentInvitePreview(inviteToken)
      .pipe(finalize(() => (this.inviteValidationLoading = false)))
      .subscribe({
        next: (resp: StudentInvitePreviewResponse) => {
          if (this.isInviteInvalid(resp)) {
            this.inviteValidationError = this.ui.inviteInvalid;
            return;
          }

          this.invitePreview = resp;
        },
        error: (err: { error?: { message?: string; error?: string }; message?: string }) => {
          this.inviteValidationError =
            err?.error?.message ||
            err?.error?.error ||
            err?.message ||
            this.ui.inviteInvalid;
        },
      });
  }

  private isInviteInvalid(resp: StudentInvitePreviewResponse | null | undefined): boolean {
    if (!resp) return false;
    if (resp.valid === false) return true;

    const status = String(resp.status || '')
      .trim()
      .toUpperCase();

    return status === 'EXPIRED' || status === 'USED' || status === 'INVALID' || status === 'ARCHIVED';
  }
}
