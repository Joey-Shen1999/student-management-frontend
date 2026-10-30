import { TeacherFormsService, TeacherForm } from '../../services/teacher-forms.service';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { AuthService, type LoginResponse } from '../../services/auth.service';
import { TranslatePipe } from '../../shared/i18n/translate.pipe';
import { uiText } from '../../shared/i18n/ui-translations';

@Component({
  selector: 'app-teacher-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  template: `
    <div class="dashboard-page">
      <div class="dashboard-shell">
        <div class="dashboard-header">
          <div>
            <h2>{{ ui.title | appTranslate }}</h2>
          </div>
          <button
            type="button"
            class="action-btn ghost signout-btn"
            [disabled]="signingOut"
            (click)="logout()"
          >
            {{ (signingOut ? ui.signingOut : ui.signOut) | appTranslate }}
          </button>
        </div>

        <section class="dashboard-card">
          <h3>{{ ui.quickActions | appTranslate }}</h3>
          <div class="quick-actions">
            <button *ngIf="isAdmin" type="button" class="action-btn secondary" (click)="goTeachers()">
              {{ ui.teacherManagement | appTranslate }}
            </button>
            <button type="button" class="action-btn primary" (click)="goGoals()">
              {{ ui.taskCenter | appTranslate }}
            </button>
            <button type="button" class="action-btn primary" (click)="goTasks()">
              {{ ui.noticeManagement | appTranslate }}
            </button>
            <button *ngFor="let form of personalForms" type="button" class="action-btn primary" [routerLink]="formsStore.path(form)" [queryParams]="form.custom ? {personalForm:form.id} : {}">{{form.name}}</button>
            <p *ngIf="!personalForms.length">尚未选择常用表单，请在个性化设置中添加。</p>
            <a class="action-btn secondary" routerLink="/teacher/forms">个性化设置 · 我的表单</a>
            <button type="button" class="action-btn primary" [routerLink]="['/teacher/applications/by-university']">
              {{ ui.universityApplicationOverview | appTranslate }}
            </button>
            <button type="button" class="action-btn primary" [routerLink]="['/teacher/applications/interviews']">
              {{ ui.interviewStudents | appTranslate }}
            </button>
            <button type="button" class="action-btn primary" [routerLink]="['/teacher/service-progress']">
              {{ ui.serviceProgress | appTranslate }}
            </button>
            <button type="button" class="action-btn secondary" (click)="goAccount()">
              {{ ui.accountSettings | appTranslate }}
            </button>
          </div>
        </section>
      </div>
    </div>
  `,
  styleUrl: './teacher-dashboard.component.scss',
})
export class TeacherDashboardComponent {
  readonly ui = {
    title: uiText('教师工作台', 'Teacher Dashboard'),
    signingOut: uiText('退出中...', 'Signing out...'),
    signOut: uiText('退出登录', 'Sign Out'),
    quickActions: uiText('快捷操作', 'Quick Actions'),
    teacherManagement: uiText('教师管理', 'Teacher Management'),
    taskCenter: uiText('任务系统', 'Task Center'),
    noticeManagement: uiText('通知管理', 'Notice Management'),
    studentManagement: uiText('学生管理', 'Student Management'),
    courseManagement: uiText('课程管理', 'Course Management'),
    ossltTracking: uiText('OSSLT 跟踪', 'OSSLT Tracking'),
    languageTracking: uiText('语言成绩跟踪', 'Language Score Tracking'),
    volunteerTracking: uiText('义工跟踪', 'Volunteer Tracking'),
    extracurricular: uiText('课外活动', 'Extracurricular Activities'),
    universityGoalManagement: uiText('升学目标', 'University Goals'),
    graduationManagement: uiText('申请管理', 'Application Management'),
    universityApplicationOverview: uiText('按大学查看申请', 'Applications by University'),
    interviewStudents: uiText('本年面试课学生', 'Interview Course Students This Year'),
    serviceProgress: uiText('服务进度档', 'Service Progress'),
    accountSettings: uiText('账号设置', 'Account Settings'),
  };

  formsStore: TeacherFormsService;
  personalForms: TeacherForm[] = [];
  session: LoginResponse | null;
  isAdmin = false;
  signingOut = false;

  constructor(private auth: AuthService, private router: Router) {
    this.formsStore = new TeacherFormsService(auth);
    this.personalForms = this.formsStore.load().filter(f => !f.hidden);
    this.session = this.auth.getSession();
    this.isAdmin = (this.session?.role || '').toUpperCase() === 'ADMIN';
  }

  goTeachers() {
    this.router.navigate(['/teacher/teachers']);
  }

  goStudents() {
    this.router.navigate(['/teacher/students']);
  }

  goCourses() {
    this.router.navigate(['/teacher/courses']);
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
