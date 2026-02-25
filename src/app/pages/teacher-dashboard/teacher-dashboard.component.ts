import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-teacher-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div style="max-width:760px;margin:40px auto;font-family:Arial">
      <h2>教师主页</h2>

      <div style="margin:12px 0; padding:12px; border:1px solid #ddd; border-radius:8px;">
        <div style="font-weight:bold;">会话信息</div>
        <pre style="margin:8px 0 0;">{{ session | json }}</pre>
      </div>

      <div style="display:flex; gap:10px; margin:12px 0; flex-wrap:wrap;">
        <button *ngIf="isAdmin" type="button" (click)="goTeachers()" style="padding:10px 12px;">
          教师账号管理
        </button>

        <button type="button" (click)="goStudents()" style="padding:10px 12px;">
          学生账号管理
        </button>

        <button type="button" (click)="logout()" style="padding:10px 12px;margin-left:auto;">
          退出登录
        </button>
      </div>

    </div>
  `,
})
export class TeacherDashboardComponent {
  session: any;
  isAdmin = false;

  constructor(private auth: AuthService, private router: Router) {
    this.session = this.auth.getSession();
    this.isAdmin = (this.session?.role || '').toUpperCase() === 'ADMIN';
  }

  goTeachers() {
    this.router.navigate(['/teacher/teachers']);
  }

  goStudents() {
    this.router.navigate(['/teacher/students']);
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
