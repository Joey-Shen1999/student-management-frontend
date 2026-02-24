import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

const MUST_CHANGE_PASSWORD_CODE = 'MUST_CHANGE_PASSWORD_REQUIRED';
const LOGIN_PATH = '/api/auth/login';
const REGISTER_PATH = '/api/auth/register';

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

function resolveRequestPath(url: string): string {
  if (!url) {
    return '';
  }

  if (!/^https?:\/\//i.test(url)) {
    return url;
  }

  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export const mustChangePasswordInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const requestPath = resolveRequestPath(req.url);
  const isProtectedApiRequest =
    requestPath.startsWith('/api/') &&
    !requestPath.startsWith(LOGIN_PATH) &&
    !requestPath.startsWith(REGISTER_PATH);

  const authorizationHeaderValue = auth.getAuthorizationHeaderValue();
  const requestWithAuth =
    isProtectedApiRequest && authorizationHeaderValue && !req.headers.has('Authorization')
      ? req.clone({
          setHeaders: {
            Authorization: authorizationHeaderValue,
          },
        })
      : req;

  return next(requestWithAuth).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      if (error.status === 401) {
        auth.clearAuthState();
        void router.navigate(['/login']);
        return throwError(() => error);
      }

      const mustChangePasswordRequired =
        error.status === 403 && extractErrorCode(error) === MUST_CHANGE_PASSWORD_CODE;

      if (mustChangePasswordRequired) {
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
