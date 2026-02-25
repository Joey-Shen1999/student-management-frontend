import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';
import {
  AuthService,
  RegisterRequest,
  RegisterResponse,
  StudentInvitePreviewResponse,
} from '../../services/auth.service';
import { evaluatePasswordPolicy, PasswordPolicyCheck } from '../../utils/password-policy';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.html',
})
export class RegisterComponent implements OnInit {
  role: 'STUDENT' = 'STUDENT';

  username = '';
  password = '';
  confirmPassword = '';

  firstName = '';
  lastName = '';
  preferredName = '';

  error = '';
  success = '';
  loading = false;
  inviteToken = '';
  inviteValidationLoading = false;
  inviteValidationError = '';
  invitePreview: StudentInvitePreviewResponse | null = null;

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const inviteToken = String(this.route.snapshot.queryParamMap.get('inviteToken') || '').trim();
    if (!inviteToken) return;

    this.inviteToken = inviteToken;
    this.validateInviteToken(inviteToken);
  }

  get passwordChecks(): PasswordPolicyCheck[] {
    return evaluatePasswordPolicy(this.password, this.username).checks;
  }

  submit(e?: Event) {
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
      this.error = '请输入用户名和密码。';
      return;
    }

    if (this.inviteToken && this.inviteValidationLoading) {
      this.error = '邀请链接正在校验中，请稍后重试。';
      return;
    }

    if (this.inviteToken && this.inviteValidationError) {
      this.error = this.inviteValidationError;
      return;
    }

    const policy = evaluatePasswordPolicy(this.password, this.username);
    if (!policy.isValid) {
      this.error = policy.message;
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error = '两次输入的密码不一致。';
      return;
    }

    this.loading = true;

    this.auth
      .register(payload)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res: RegisterResponse) => {
          // ✅ 这里现在能确认 studentId 是否生成
          console.log('[Register] created', res);

          this.success = '账号创建成功，正在跳转到登录页...';
          setTimeout(() => this.router.navigate(['/login']), 600);
        },
        error: (err) => {
          console.error('[Register] error', err);

          // Spring Boot 默认错误结构里经常是 err.error.error / err.error.message / err.error.path...
          this.error =
            err?.error?.message ||
            err?.error?.error ||
            err?.message ||
            '注册失败。';
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
            this.inviteValidationError = '该邀请链接无效、已过期或已被使用。';
            return;
          }

          this.invitePreview = resp;
        },
        error: (err) => {
          this.inviteValidationError =
            err?.error?.message ||
            err?.error?.error ||
            err?.message ||
            '该邀请链接无效、已过期或已被使用。';
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
