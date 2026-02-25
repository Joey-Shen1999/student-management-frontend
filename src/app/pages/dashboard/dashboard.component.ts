import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div style="max-width:600px;margin:40px auto;font-family:Arial">
      <h2>学生主页</h2>

      <button type="button" (click)="goProfile()" style="margin-bottom:12px;">
        完善 / 编辑学生档案
      </button>

      <pre>{{ session | json }}</pre>

      <button type="button" (click)="logout()">退出登录</button>
    </div>
  `,
})
export class DashboardComponent {
  session: any;

  constructor(private auth: AuthService, private router: Router) {
    this.session = this.auth.getSession();
  }

  goProfile() {
    this.router.navigate(['/student/profile']);
  }

  logout() {
    this.auth.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: () => {
        this.auth.clearAuthState();
        this.router.navigate(['/login']);
      },
    });
  }
}
