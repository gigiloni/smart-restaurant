import type { IncomingHttpHeaders } from 'node:http';

import { Injectable } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';

import { PrismaService } from '../database/prisma.service.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedEmployee } from './auth.types.js';
import { GuestAccessService } from './guest-access.service.js';
import type { Viewer } from './viewer.types.js';

export type ResolvedViewer =
  | { viewer: Extract<Viewer, { kind: 'staff' }>; employee: AuthenticatedEmployee }
  | { viewer: Extract<Viewer, { kind: 'guest' }>; employee?: undefined };

/**
 * Works out who a request comes from. A staff login wins over a guest cookie
 * sent alongside it. Used by the guard for every request, and by the live
 * stream to re-check a connection that outlives the request that opened it.
 */
@Injectable()
export class ViewerResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly guestAccess: GuestAccessService,
  ) {}

  async resolve(
    headers: IncomingHttpHeaders,
    options: { allowGuests: boolean },
  ): Promise<ResolvedViewer | null> {
    const employee = await this.findEmployee(headers);

    if (employee) {
      return {
        employee,
        viewer: { kind: 'staff', employeeId: employee.id, role: employee.role },
      };
    }

    if (!options.allowGuests) {
      return null;
    }

    const guest = await this.guestAccess.resolve(headers.cookie);

    return guest ? { viewer: guest } : null;
  }

  /** The employee behind the request's Better Auth session, if there is one. */
  private async findEmployee(headers: IncomingHttpHeaders): Promise<AuthenticatedEmployee | null> {
    const session = await this.authService.auth.api.getSession({
      headers: fromNodeHeaders(headers),
    });

    if (!session) {
      return null;
    }

    return this.prisma.employee.findUnique({
      where: { authUserId: session.user.id },
      select: { id: true, role: true },
    });
  }
}
