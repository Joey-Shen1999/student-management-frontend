import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, finalize } from 'rxjs/operators';

import { AppLanguageService } from './services/app-language.service';
import { AuthService } from './services/auth.service';
import { LegacyUiTranslationService } from './shared/i18n/legacy-ui-translation.service';
import { uiText } from './shared/i18n/ui-translations';
import { LanguageToggleComponent } from './shared/language-toggle/language-toggle.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LanguageToggleComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  showGlobalSignOut = false;
  showPageNavigation = false;
  showStudentSurface = false;
  signingOut = false;
  private pageTrail: string[] = [];

  private readonly auth = inject(AuthService);
  private readonly language = inject(AppLanguageService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly legacyUiTranslation = inject(LegacyUiTranslationService);

  constructor() {
    this.refreshSignOutVisibility(this.router.url);
    this.recordPageRoute(this.router.url);
    void this.legacyUiTranslation;

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => {
        this.refreshSignOutVisibility(event.urlAfterRedirects);
        this.recordPageRoute(event.urlAfterRedirects);
      });
  }

  goHome(): void {
    const home = this.homeRoute();
    this.pageTrail = [home];
    void this.router.navigateByUrl(home);
  }

  goBack(): void {
    const current = this.pageTrail[this.pageTrail.length - 1] ?? this.router.url;
    if (this.pageTrail.length > 1) {
      this.pageTrail.pop();
      void this.router.navigateByUrl(this.pageTrail[this.pageTrail.length - 1]);
      return;
    }
    const parent = this.fallbackParent(current);
    this.pageTrail = [parent];
    void this.router.navigateByUrl(parent);
  }

  get homeLabel(): string {
    return this.language.translate(uiText('主页', 'Home'));
  }

  get backLabel(): string {
    return this.language.translate(uiText('返回上一级', 'Back One Level'));
  }

  signOut(): void {
    if (this.signingOut) return;

    this.signingOut = true;
    this.auth
      .logout()
      .pipe(finalize(() => (this.signingOut = false)))
      .subscribe({
        next: () => {
          this.refreshSignOutVisibility('/login');
          this.router.navigate(['/login']);
        },
        error: () => {
          this.auth.clearAuthState();
          this.refreshSignOutVisibility('/login');
          this.router.navigate(['/login']);
        },
      });
  }

  get globalSignOutLabel(): string {
    return this.language.translate(
      this.signingOut ? uiText('退出中...', 'Signing out...') : uiText('退出登录', 'Sign Out')
    );
  }

  private refreshSignOutVisibility(url: string): void {
    const path = this.normalizePath(url);
    const hasSession = !!this.auth.getSession()?.accessToken;
    const isPreLoginRoute = path === '/login' || path === '/register';
    const isDashboardRoute = path === '/dashboard' || path === '/teacher/dashboard';

    this.showGlobalSignOut = hasSession && !isPreLoginRoute && !isDashboardRoute;
    this.showPageNavigation = this.showGlobalSignOut;
    this.showStudentSurface = this.auth.getSession()?.role?.toUpperCase() === 'STUDENT' &&
      (path === '/dashboard' || path.startsWith('/student/') || path === '/account' || path === '/account/profile');
  }

  private recordPageRoute(url: string): void {
    const path = this.normalizePath(url);
    if (path === '/' || path === '/login' || path === '/register') {
      this.pageTrail = [];
      return;
    }

    const last = this.pageTrail[this.pageTrail.length - 1];
    if (last === url) return;
    if (last && this.normalizePath(last) === path) {
      this.pageTrail[this.pageTrail.length - 1] = url;
      return;
    }
    if (
      this.pageTrail.length > 1 &&
      this.normalizePath(this.pageTrail[this.pageTrail.length - 2]) === path
    ) {
      this.pageTrail.pop();
      this.pageTrail[this.pageTrail.length - 1] = url;
      return;
    }
    this.pageTrail.push(url);
  }

  private fallbackParent(url: string): string {
    const path = this.normalizePath(url);
    if (/^\/teacher\/students\/[^/]+\/graduation-applications\/setup$/.test(path)) {
      return path.replace(/\/setup$/, '');
    }
    if (/^\/teacher\/students\/[^/]+\//.test(path)) return '/teacher/students';
    if (path === '/teacher/applications/by-university') return '/teacher/graduation';
    if (path.startsWith('/student/') && this.isTeacher() && url.includes('studentId=')) {
      return '/teacher/students';
    }
    return this.homeRoute();
  }

  private homeRoute(): string {
    return this.isTeacher() ? '/teacher/dashboard' : '/dashboard';
  }

  private isTeacher(): boolean {
    const role = this.auth.getSession()?.role?.toUpperCase();
    return role === 'TEACHER' || role === 'ADMIN';
  }

  private normalizePath(url: string): string {
    const raw = String(url || '');
    const withoutQuery = raw.split('?')[0].split('#')[0];
    if (!withoutQuery) return '/';
    return withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  }
}
