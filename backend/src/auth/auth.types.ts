import type { IncomingHttpHeaders } from 'node:http';
import type { EmployeeRole } from '../generated/prisma/enums.js';

export type AuthenticatedEmployee = {
  id: number;
  role: EmployeeRole;
};

export type AuthenticatedRequest = {
  method: string;
  headers: IncomingHttpHeaders;
  employee: AuthenticatedEmployee;
};
