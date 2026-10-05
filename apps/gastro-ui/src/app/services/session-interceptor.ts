import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth-service';

export const sessionInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) return next(request);
  const auth = inject(AuthService);
  const router = inject(Router);
  return next(request.clone({ withCredentials: true })).pipe(
    catchError((error: HttpErrorResponse) => {
      if (
        (error.status === 401 || error.status === 403) &&
        !request.url.startsWith('/api/auth/') &&
        request.url !== '/api/viewer' &&
        request.url !== '/api/employees/me'
      ) {
        void auth
          .refresh()
          .then((viewer) => {
            if (!viewer && router.url.startsWith('/mitarbeiter')) {
              void router.navigate(['/anmelden'], { queryParams: { returnUrl: router.url } });
            }
          })
          .catch(() => undefined);
      }
      return throwError(() => error);
    }),
  );
};
