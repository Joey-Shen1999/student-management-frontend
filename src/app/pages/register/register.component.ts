import { RegistrationHandoffService } from '../../services/registration-handoff.service';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, OnInit, OnDestroy } from '@angular/core';
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
  styleUrl: './register.scss',
})
export class RegisterComponent implements OnInit, OnDestroy {
  readonly ui = {
    savedTitle: uiText('注册成功！请保存你的登录信息', 'Account created! Save your sign-in details'),
    copy: uiText('复制', 'Copy'),
    copyAll: uiText('一键复制用户名和密码', 'Copy username and password'),
    show: uiText('显示', 'Show'),
    hide: uiText('隐藏', 'Hide'),
    copied: uiText('已复制', 'Copied'),
    copyFailed: uiText('复制失败，请显示后手动选择复制。', 'Copy failed. Reveal and select the details to copy manually.'),
    countdown: uiText('密码将在以下秒数后隐藏', 'Password will be hidden in this many seconds'),
    expired: uiText('密码已隐藏，请使用你保存的密码登录。', 'Password hidden. Sign in with your saved password.'),
    nextStep: uiText('登录后，请完善基本资料、学校及毕业年份。', 'After signing in, complete your personal details, school and graduation year.'),
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
    studentNameRequired: uiText(
      '请填写学生的姓和名。',
      'Please enter the student first and last name.'
    ),
    passwordMismatch: uiText(
      '两次输入的密码不一致。',
      'The password and confirmation password do not match.'
    ),
    registrationSuccess: uiText(
      '账号创建成功，请保存登录信息。',
      'Account created successfully. Save your sign-in details.'
    ),
    registrationFailed: uiText('注册失败。', 'Registration failed.'),
    inviteInvalid: uiText(
      '该邀请链接无效、已过期或已被使用。',
      'This invite link is invalid, expired, or already used.'
    ),
    requestTimedOut: uiText(
      '请求超时。请检查服务器是否运行，或稍后重试。',
      'Request timed out. Please check the server or try again shortly.'
    ),
  };

  registered = false;
  revealPassword = false;
  remainingSeconds = 60;
  copyStatus: string | LocalizedText = '';
  private countdownTimer?: ReturnType<typeof setInterval>;
  private handingOff = false;

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
    private route: ActivatedRoute,
    private handoff: RegistrationHandoffService = new RegistrationHandoffService(),
    private cdr: ChangeDetectorRef = null!
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

    if (this.loading || this.registered) return;

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

    if (!payload.firstName || !payload.lastName) {
      this.error = this.ui.studentNameRequired;
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
          this.handoff.start(payload.username, payload.password);
          this.username = payload.username;
          this.password = this.confirmPassword = '';
          this.registered = true;
          this.success = this.ui.registrationSuccess;
          this.countdownTimer = setInterval(() => {
            const value = this.handoff.peek();
            this.remainingSeconds = value ? Math.max(0, Math.ceil((value.expiresAt - Date.now()) / 1000)) : 0;
            if (!this.remainingSeconds) {
              this.revealPassword = false;
              clearInterval(this.countdownTimer);
            }
            this.cdr?.markForCheck();
          }, 1000);
          this.cdr?.markForCheck();
        },
        error: (err: {
          name?: string;
          error?: { message?: string; error?: string } | string;
          message?: string;
        }) => {
          this.error = this.extractErrorMessage(err) || this.ui.registrationFailed;
        },
      });
  }

  get savedPassword(): string { return this.handoff.peek()?.password || ''; }

  async copyCredentials(kind: 'username' | 'password' | 'all'): Promise<void> {
    const password = this.savedPassword;
    if (kind !== 'username' && !password) return;
    const text = kind === 'username' ? this.username : kind === 'password' ? password
      : `Username: ${this.username}\nPassword: ${password}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // HTTP test deployments do not expose the modern clipboard API.
        const field = document.createElement('textarea');
        field.value = text;
        field.setAttribute('readonly', '');
        field.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
        const focused = document.activeElement as HTMLElement | null;
        document.body.appendChild(field);
        try {
          field.focus();
          field.select();
          if (!document.execCommand('copy')) throw new Error('Copy unavailable');
        } finally {
          field.value = '';
          field.remove();
          focused?.focus();
        }
      }
      this.copyStatus = this.ui.copied;
    } catch { this.copyStatus = this.ui.copyFailed; }
    this.cdr?.markForCheck();
  }

  async goToLogin(): Promise<void> {
    this.handingOff = true;
    try {
      const navigated = await this.router.navigate(['/login']);
      if (navigated === false) this.handingOff = false;
    } catch { this.handingOff = false; }
  }

  @HostListener('window:pagehide')
  clearOnPageHide(): void {
    this.handoff.clear();
    this.password = this.confirmPassword = '';
    this.revealPassword = false;
    this.remainingSeconds = 0;
  }

  ngOnDestroy(): void {
    clearInterval(this.countdownTimer);
    this.password = this.confirmPassword = '';
    if (!this.handingOff) this.handoff.clear();
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
        error: (err: {
          name?: string;
          error?: { message?: string; error?: string } | string;
          message?: string;
        }) => {
          this.inviteValidationError = this.extractErrorMessage(err) || this.ui.inviteInvalid;
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

  private extractErrorMessage(err: {
    name?: string;
    error?: { message?: string; error?: string } | string;
    message?: string;
  }): string | LocalizedText {
    if (String(err?.name || '').toLowerCase() === 'timeouterror') {
      return this.ui.requestTimedOut;
    }
    if (err?.error && typeof err.error === 'object') {
      return err.error.message || err.error.error || '';
    }
    if (typeof err?.error === 'string') {
      return err.error;
    }
    return err?.message || '';
  }
}
