import { Routes } from '@angular/router';

import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { TeacherDashboardComponent } from './pages/teacher-dashboard/teacher-dashboard.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // -----------------------
  // Auth
  // -----------------------
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },

  // -----------------------
  // Student
  // -----------------------
  { path: 'dashboard', component: DashboardComponent }, // student dashboard

  {
    path: 'student/profile',
    loadComponent: () =>
      import('./pages/student-profile/student-profile')
        .then((m) => m.StudentProfile),
  },

  // -----------------------
  // Teacher Module
  // -----------------------
  {
    path: 'teacher',
    children: [
      {
        path: 'dashboard',
        component: TeacherDashboardComponent,
      },
      {
        path: 'invites',
        loadComponent: () =>
          import('./pages/teacher-invites/teacher-invites.component')
            .then((m) => m.TeacherInvitesComponent),
      },
      {
        path: 'change-password',
        loadComponent: () =>
          import('./pages/change-password/change-password.component')
            .then((m) => m.ChangePasswordComponent),
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      }
    ]
  },

  // -----------------------
  // Fallback
  // -----------------------
  { path: '**', redirectTo: 'login' },
];
