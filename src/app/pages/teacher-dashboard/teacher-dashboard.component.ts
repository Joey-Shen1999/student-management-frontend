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
    <div class="dashboard-page" (click)="closePersonalMenu()">
      <div class="dashboard-shell">
        <div class="dashboard-header">
          <div>
            <h2>Teacher Dashboard</h2>
            <p>Current workspace and quick navigation</p>
          </div>
          <div class="header-actions">
            <div class="profile-menu" (click)="$event.stopPropagation()">
              <button
                type="button"
                class="action-btn ghost personal-btn"
                (click)="togglePersonalMenu()"
              >
                {{ personalMenuLabel }}
              </button>

              <div class="profile-menu-panel" *ngIf="personalMenuOpen">
                <button type="button" class="profile-menu-item" (click)="goAccountFromMenu()">
                  Password change
                </button>
                <button
                  type="button"
                  class="profile-menu-item danger"
                  [disabled]="signingOut"
                  (click)="logoutFromMenu()"
                >
                  {{ signingOut ? 'Signing out...' : 'Sign Out' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <section class="dashboard-card">
          <h3>Quick Actions</h3>
          <div class="quick-actions">
            <button *ngIf="isAdmin" type="button" class="action-btn secondary" (click)="goTeachers()">
              Teacher Management
            </button>
            <button type="button" class="action-btn primary" (click)="goGoals()">
              Goal Management
            </button>
            <button type="button" class="action-btn primary" (click)="goTasks()">
              Notification Management
            </button>
            <button type="button" class="action-btn primary" (click)="goStudents()">
              Student Management
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
  personalMenuOpen = false;

  constructor(private auth: AuthService, private router: Router) {
    this.session = this.auth.getSession();
    this.isAdmin = (this.session?.role || '').toUpperCase() === 'ADMIN';
  }

  get personalMenuLabel(): string {
    return 'Account';
  }

  goTeachers() {
    this.router.navigate(['/teacher/teachers']);
  }

  goStudents() {
    this.router.navigate(['/teacher/students']);
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

  goAccountFromMenu(): void {
    this.personalMenuOpen = false;
    this.goAccount();
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

  logoutFromMenu(): void {
    this.personalMenuOpen = false;
    this.logout();
  }

  togglePersonalMenu(): void {
    this.personalMenuOpen = !this.personalMenuOpen;
  }

  closePersonalMenu(): void {
    this.personalMenuOpen = false;
  }
}
