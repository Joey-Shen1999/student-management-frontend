import { Routes } from '@angular/router';

import { teacherRouteGuard } from './guards/teacher-route.guard';
import { adminOnlyGuard } from './guards/admin-only.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
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

  {
    path: 'account/profile',
    loadComponent: () =>
      import('./pages/account-profile/account-profile.component').then(
        (m) => m.AccountProfileComponent
      ),
  },

  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },

  {
    path: 'student/profile',
    loadComponent: () =>
      import('./pages/student-profile/student-profile').then((m) => m.StudentProfile),
  },

  {
    path: 'teacher',
    canActivateChild: [teacherRouteGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/teacher-dashboard/teacher-dashboard.component').then(
            (m) => m.TeacherDashboardComponent
          ),
      },

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
        path: 'goals',
        loadComponent: () =>
          import('./pages/goal-management/goal-management.component').then(
            (m) => m.GoalManagementComponent
          ),
      },

      {
        path: 'tasks',
        loadComponent: () =>
          import('./pages/info-management/info-management.component').then(
            (m) => m.InfoManagementComponent
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
