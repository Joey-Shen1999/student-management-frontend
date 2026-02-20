import { Routes } from '@angular/router';

import { Login } from './pages/login/login'; // ✅ 用 login.ts 这套
import { RegisterComponent } from './pages/register/register.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { TeacherDashboardComponent } from './pages/teacher-dashboard/teacher-dashboard.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // -----------------------
  // Auth
  // -----------------------
  { path: 'login', component: Login }, // ✅ 关键：别再指向 LoginComponent
  { path: 'register', component: RegisterComponent },

  // ✅ 兼容旧路径：如果你代码里还写 /change-password，就自动跳到老师改密页
  { path: 'change-password', redirectTo: 'teacher/change-password', pathMatch: 'full' },

  // -----------------------
  // Student
  // -----------------------
  { path: 'dashboard', component: DashboardComponent },

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
      { path: 'dashboard', component: TeacherDashboardComponent },

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

      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },

  // -----------------------
  // Fallback
  // -----------------------
  { path: '**', redirectTo: 'login' },
];
