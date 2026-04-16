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
  signingOut = false;

  private readonly auth = inject(AuthService);
  private readonly language = inject(AppLanguageService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly legacyUiTranslation = inject(LegacyUiTranslationService);

  constructor() {
    this.refreshSignOutVisibility(this.router.url);
    void this.legacyUiTranslation;

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => {
        this.refreshSignOutVisibility(event.urlAfterRedirects);
      });
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
  }

  private normalizePath(url: string): string {
    const raw = String(url || '');
    const withoutQuery = raw.split('?')[0].split('#')[0];
    if (!withoutQuery) return '/';
    return withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  }
}
