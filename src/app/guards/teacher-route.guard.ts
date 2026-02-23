import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

export const teacherRouteGuard: CanActivateChildFn = (childRoute, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const session = auth.getSession();
  const role = (session?.role || '').toUpperCase();

  if (!session || role !== 'TEACHER') {
    return router.createUrlTree(['/login']);
  }

  const isChangePasswordRoute =
    childRoute.routeConfig?.path === 'change-password' ||
    state.url.startsWith('/teacher/change-password');

  if (session.mustChangePassword && !isChangePasswordRoute) {
    return router.createUrlTree(['/teacher/change-password'], {
      queryParams: { userId: session.userId },
    });
  }

  return true;
};
