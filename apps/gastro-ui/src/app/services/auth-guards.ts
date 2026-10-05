import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import type { EmployeeRole } from '@smart-restaurant/contracts';
import { AuthService } from './auth-service';

export const staffGuard: CanActivateFn = async (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  try {
    await auth.ensure();
  } catch {
    return router.createUrlTree(['/anmelden']);
  }
  if (!auth.staff())
    return router.createUrlTree(['/anmelden'], { queryParams: { returnUrl: state.url } });
  const roles = route.data['roles'] as EmployeeRole[] | undefined;
  return !roles || auth.hasRole(...roles) ? true : router.createUrlTree(['/mitarbeiter']);
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  try {
    await auth.ensure();
  } catch {
    return router.createUrlTree(['/gastzugang']);
  }
  return !!auth.guest() || router.createUrlTree(['/gastzugang']);
};
