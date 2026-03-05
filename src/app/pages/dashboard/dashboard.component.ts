import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService, type LoginResponse } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dashboard-page">
      <div class="dashboard-shell">
        <div class="dashboard-header">
          <div>
            <h2>Student Dashboard</h2>
            <p>Current workspace and quick navigation</p>
          </div>
          <button type="button" class="action-btn ghost" (click)="logout()">Sign Out</button>
        </div>

        <section class="dashboard-card">
          <h3>Quick Actions</h3>
          <div class="quick-actions">
            <button type="button" class="action-btn primary" (click)="goProfile()">Student Profile</button>
            <button type="button" class="action-btn secondary" (click)="goAccount()">
              Account Settings
            </button>
          </div>
        </section>
      </div>
    </div>
  `,
  styleUrl: './dashboard.scss',
})
export class DashboardComponent {
  session: LoginResponse | null;

  constructor(private auth: AuthService, private router: Router) {
    this.session = this.auth.getSession();
  }

  goProfile() {
    this.router.navigate(['/student/profile']);
  }

  goAccount() {
    this.router.navigate(['/account']);
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
