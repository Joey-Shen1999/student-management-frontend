import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, finalize } from 'rxjs/operators';

import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  showGlobalSignOut = false;
  signingOut = false;

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.refreshSignOutVisibility(this.router.url);

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
