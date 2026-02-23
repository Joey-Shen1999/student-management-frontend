import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

const MUST_CHANGE_PASSWORD_CODE = 'MUST_CHANGE_PASSWORD_REQUIRED';

type ApiErrorPayload = {
  code?: unknown;
  [key: string]: unknown;
};

function extractErrorCode(error: HttpErrorResponse): string {
  const payload = error?.error as ApiErrorPayload | string | null | undefined;

  if (payload && typeof payload === 'object') {
    return String(payload.code || '');
  }

  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload) as ApiErrorPayload;
      return String(parsed?.code || '');
    } catch {
      return '';
    }
  }

  return '';
}

export const mustChangePasswordInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      const isTeacherManagementApi = req.url.startsWith('/api/teacher/');
      const mustChangePasswordRequired =
        error.status === 403 && extractErrorCode(error) === MUST_CHANGE_PASSWORD_CODE;

      if (isTeacherManagementApi && mustChangePasswordRequired) {
        auth.markMustChangePasswordRequired();
        const currentUserId = auth.getCurrentUserId();

        void router.navigate(['/teacher/change-password'], {
          queryParams: currentUserId ? { userId: currentUserId } : undefined,
        });
      }

      return throwError(() => error);
    })
  );
};
