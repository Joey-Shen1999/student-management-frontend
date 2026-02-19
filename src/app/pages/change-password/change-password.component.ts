import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div style="max-width:760px;margin:40px auto;font-family:Arial">
      <h2>Change Password</h2>

      <p style="color:#666; line-height:1.6;">
        这里是“首次登录必须改密码”的页面骨架。
        <br/>下一步我们会接后端 API：/api/auth/change-password
      </p>

      <div style="margin-top:14px; padding:12px; border:1px solid #ddd; border-radius:8px;">
        <label style="display:block;margin:8px 0 6px;">Old password</label>
        <input [(ngModel)]="oldPassword" type="password"
               style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;" />

        <label style="display:block;margin:12px 0 6px;">New password</label>
        <input [(ngModel)]="newPassword" type="password"
               style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;" />

        <label style="display:block;margin:12px 0 6px;">Confirm new password</label>
        <input [(ngModel)]="confirmPassword" type="password"
               style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;" />

        <button type="button" (click)="submit()" style="margin-top:12px;padding:10px 12px;">
          Update Password (TODO)
        </button>

        <p *ngIf="error" style="color:#b00020;margin:10px 0 0;">{{ error }}</p>
      </div>

      <div style="margin-top:12px;">
        <a routerLink="/teacher/dashboard">← Back to dashboard</a>
      </div>
    </div>
  `,
})
export class ChangePasswordComponent {
  oldPassword = '';
  newPassword = '';
  confirmPassword = '';
  error = '';

  constructor(private router: Router) {}

  submit() {
    this.error = '';

    if (!this.oldPassword || !this.newPassword) {
      this.error = 'Please fill in all fields.';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.error = 'New password and confirmation do not match.';
      return;
    }

    // 下一步：调用后端 /api/auth/change-password 成功后跳转
    alert('TODO: call /api/auth/change-password');
    // this.router.navigate(['/teacher/dashboard']);
  }
}
