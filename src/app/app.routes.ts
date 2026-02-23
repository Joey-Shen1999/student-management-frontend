import { Routes } from '@angular/router';

import { teacherRouteGuard } from './guards/teacher-route.guard';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { Login } from './pages/login/login';
import { RegisterComponent } from './pages/register/register.component';
import { TeacherDashboardComponent } from './pages/teacher-dashboard/teacher-dashboard.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  { path: 'login', component: Login },
  { path: 'register', component: RegisterComponent },

  { path: 'change-password', redirectTo: 'teacher/change-password', pathMatch: 'full' },

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
        loadComponent: () =>
          import('./pages/teacher-invites/teacher-invites.component').then(
            (m) => m.TeacherInvitesComponent
          ),
      },

      {
        path: 'change-password',
        loadComponent: () =>
          import('./pages/change-password/change-password.component').then(
            (m) => m.ChangePasswordComponent
          ),
      },

      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },

  { path: '**', redirectTo: 'login' },
];
