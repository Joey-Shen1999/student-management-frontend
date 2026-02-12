import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div style="max-width:360px;margin:60px auto;font-family:Arial">
      <h2>Login</h2>

      <label style="display:block;margin:12px 0 6px;">Username</label>
      <input [(ngModel)]="username" style="width:100%; padding:8px;" />

      <label style="display:block;margin:12px 0 6px;">Password</label>
      <input [(ngModel)]="password" type="password" style="width:100%; padding:8px;" />

      <button (click)="onSubmit()" style="margin-top:14px;padding:10px 14px;width:100%;">
        Login
      </button>

      <!-- 注册入口 -->
      <div style="margin-top:14px;text-align:center;">
        <span style="color:#666;">No account?</span>
        <a routerLink="/register" style="margin-left:6px;text-decoration:underline;cursor:pointer;">
          Create one
        </a>
      </div>

      @if (error) {
        <p style="color:red; margin-top:12px;">{{ error }}</p>
      }
    </div>
  `
})
export class LoginComponent {
  username = '';
  password = '';
  error = '';

  constructor(private auth: AuthService, private router: Router) {}

  onSubmit() {
    this.error = '';
    this.auth.login({ username: this.username, password: this.password }).subscribe({
      next: (resp) => {
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.error = 'Login failed';
      }
    });
  }
}
