import { Routes } from '@angular/router';

import { teacherRouteGuard } from './guards/teacher-route.guard';
import { adminOnlyGuard } from './guards/admin-only.guard';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { Login } from './pages/login/login';
import { TeacherDashboardComponent } from './pages/teacher-dashboard/teacher-dashboard.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  { path: 'login', component: Login },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register.component').then((m) => m.RegisterComponent),
  },

  {
    path: 'change-password',
    loadComponent: () =>
      import('./pages/change-password/change-password.component').then(
        (m) => m.ChangePasswordComponent
      ),
    data: {
      passwordMode: 'set',
    },
  },

  {
    path: 'account',
    loadComponent: () =>
      import('./pages/change-password/change-password.component').then(
        (m) => m.ChangePasswordComponent
      ),
    data: {
      passwordMode: 'change',
    },
  },

  { path: 'dashboard', component: DashboardComponent },

  {
    path: 'student/profile',
    loadComponent: () =>
      import('./pages/student-profile/student-profile').then((m) => m.StudentProfile),
  },

  {
    path: 'teacher',
    canActivateChild: [teacherRouteGuard],
    children: [
      { path: 'dashboard', component: TeacherDashboardComponent },

      {
        path: 'invites',
        canActivate: [adminOnlyGuard],
        loadComponent: () =>
          import('./pages/teacher-invites/teacher-invites.component').then(
            (m) => m.TeacherInvitesComponent
          ),
      },

      {
        path: 'teachers',
        canActivate: [adminOnlyGuard],
        loadComponent: () =>
          import('./pages/teacher-management/teacher-management.component').then(
            (m) => m.TeacherManagementComponent
          ),
      },

      {
        path: 'students/:studentId/profile',
        loadComponent: () =>
          import('./pages/student-profile/student-profile').then((m) => m.StudentProfile),
      },

      {
        path: 'students',
        loadComponent: () =>
          import('./pages/student-management/student-management.component').then(
            (m) => m.StudentManagementComponent
          ),
      },

      {
        path: 'tasks',
        loadComponent: () =>
          import('./pages/task-management/task-management.component').then(
            (m) => m.TaskManagementComponent
          ),
      },

      {
        path: 'change-password',
        loadComponent: () =>
          import('./pages/change-password/change-password.component').then(
            (m) => m.ChangePasswordComponent
          ),
        data: {
          passwordMode: 'set',
        },
      },

      {
        path: 'account',
        loadComponent: () =>
          import('./pages/change-password/change-password.component').then(
            (m) => m.ChangePasswordComponent
          ),
        data: {
          passwordMode: 'change',
        },
      },

      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },

  { path: '**', redirectTo: 'login' },
];
