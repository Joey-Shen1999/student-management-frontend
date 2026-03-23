import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
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
            <h2>Teacher Dashboard</h2>
            <p>Current workspace and quick navigation</p>
          </div>
          <button
            type="button"
            class="action-btn ghost signout-btn"
            [disabled]="signingOut"
            (click)="logout()"
          >
            {{ signingOut ? 'Signing out...' : 'Sign Out' }}
          </button>
        </div>

        <section class="dashboard-card">
          <h3>Quick Actions</h3>
          <div class="quick-actions">
            <button *ngIf="isAdmin" type="button" class="action-btn secondary" (click)="goTeachers()">
              Teacher Management
            </button>
            <button type="button" class="action-btn primary" (click)="goTasks()">
              Task Management
            </button>
            <button type="button" class="action-btn primary" (click)="goStudents()">
              Student Management
            </button>
            <button type="button" class="action-btn secondary" (click)="goAccount()">
              Account Settings
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
