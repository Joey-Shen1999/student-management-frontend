import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

export const adminOnlyGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const session = auth.getSession();
  const hasAuthToken = !!auth.getAuthorizationHeaderValue();
  const role = (session?.role || '').toUpperCase();

  if (!session || !hasAuthToken) {
    return router.createUrlTree(['/login']);
  }

  if (role !== 'ADMIN') {
    return router.createUrlTree(['/teacher/dashboard']);
  }

  return true;
};
