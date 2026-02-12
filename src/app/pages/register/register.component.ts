import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService, RegisterRequest, RegisterResponse } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.html',
})
export class RegisterComponent {
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

  constructor(private auth: AuthService, private router: Router) {}

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

    if (!payload.username || !payload.password) {
      this.error = 'Username and password are required.';
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
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

          this.success = 'Account created. Redirecting to login...';
          setTimeout(() => this.router.navigate(['/login']), 600);
        },
        error: (err) => {
          console.error('[Register] error', err);

          // Spring Boot 默认错误结构里经常是 err.error.error / err.error.message / err.error.path...
          this.error =
            err?.error?.message ||
            err?.error?.error ||
            err?.message ||
            'Register failed';
        },
      });
  }
}
