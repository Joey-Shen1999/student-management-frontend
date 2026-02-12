import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { RegisterComponent } from './pages/register/register.component';
import { StudentProfileComponent } from './pages/student-profile/student-profile.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },   // 👈 放在前面
  { path: 'dashboard', component: DashboardComponent },
  { path: 'student/profile', loadComponent: () => import('./pages/student-profile/student-profile').then(m => m.StudentProfile) },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }                   // 👈 永远最后
];
