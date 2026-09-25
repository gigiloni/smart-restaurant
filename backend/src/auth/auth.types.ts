import type { IncomingHttpHeaders } from 'node:http';
import type { EmployeeRole } from '../generated/prisma/enums.js';
import type { Viewer } from './viewer.types.js';

export type AuthenticatedEmployee = {
  id: number;
  role: EmployeeRole;
};

export type AuthenticatedRequest = {
  method: string;
  headers: IncomingHttpHeaders;
  /**
   * Set for staff only. On routes marked `@AllowGuests()` or
   * `@AllowAnonymous()` it is undefined for guests; read `viewer` there.
   */
  employee: AuthenticatedEmployee;
  /** Who is asking. Undefined only on `@AllowAnonymous()` routes. */
  viewer: Viewer;
};
