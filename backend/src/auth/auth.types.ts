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
  /** The signed-in member of staff; undefined for guests and anonymous callers. */
  employee?: AuthenticatedEmployee;
  /** Who is asking: staff or a seated guest. Undefined for anonymous callers. */
  viewer?: Viewer;
};
