import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { AuthService, type LoginResponse } from '../../services/auth.service';

@Component({
  selector: 'app-teacher-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dashboard-page">
      <div class="dashboard-shell">
        <div class="dashboard-header">
          <div>
            <h2>教师工作台</h2>
            <p>当前工作区与快捷入口</p>
          </div>
          <button
            type="button"
            class="action-btn ghost signout-btn"
            [disabled]="signingOut"
            (click)="logout()"
          >
            {{ signingOut ? '退出中...' : '退出登录' }}
          </button>
        </div>

        <section class="dashboard-card">
          <h3>快捷操作</h3>
          <div class="quick-actions">
            <button *ngIf="isAdmin" type="button" class="action-btn secondary" (click)="goTeachers()">
              教师管理
            </button>
            <button type="button" class="action-btn primary" (click)="goGoals()">
              任务系统
            </button>
            <button type="button" class="action-btn primary" (click)="goTasks()">
              通知管理
            </button>
            <button type="button" class="action-btn primary" [routerLink]="['/teacher/students']">
              学生管理
            </button>
            <button type="button" class="action-btn primary" [routerLink]="['/teacher/osslt']">
              OSSLT 跟踪
            </button>
            <button type="button" class="action-btn primary" [routerLink]="['/teacher/ielts']">
              语言成绩跟踪
            </button>
            <button type="button" class="action-btn primary" [routerLink]="['/teacher/volunteer']">
              义工跟踪
            </button>
            <button type="button" class="action-btn secondary" (click)="goAccount()">
              账号设置
            </button>
          </div>
        </section>
      </div>
    </div>
  `,
  styleUrl: './teacher-dashboard.component.scss',
})
export class TeacherDashboardComponent {
  session: LoginResponse | null;
  isAdmin = false;
  signingOut = false;

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

  goIeltsTracking() {
    this.router.navigate(['/teacher/ielts']);
  }

  goGoals() {
    this.router.navigate(['/teacher/goals']);
  }

  goTasks() {
    this.router.navigate(['/teacher/tasks']);
  }

  goAccount() {
    this.router.navigate(['/teacher/account']);
  }

  logout() {
    if (this.signingOut) return;

    this.signingOut = true;
    this.auth
      .logout()
      .pipe(finalize(() => (this.signingOut = false)))
      .subscribe({
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
