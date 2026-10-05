import { HttpErrorResponse } from '@angular/common/http';
export function apiError(
  error: unknown,
  fallback = 'Die Änderung konnte nicht übernommen werden.',
): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  if (error.status === 401) return 'Ihr Zugang ist abgelaufen. Bitte erneut anmelden.';
  if (error.status === 403) return 'Sie haben für diese Aktion keine Berechtigung.';
  if (error.status === 0 || error.status >= 500)
    return 'Der Server ist nicht erreichbar. Bitte erneut versuchen.';
  const message: unknown = error.error?.message;
  return typeof message === 'string'
    ? `${fallback} ${message}`
    : Array.isArray(message)
      ? `${fallback} ${message.join(' · ')}`
      : fallback;
}
