import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { stub } from '../../test/support/unit.js';
import type { LoginRequirement } from './access-metadata.js';
import { AuthGuard } from './auth.guard.js';
import type { AuthenticatedRequest } from './auth.types.js';
import type { ResolvedViewer, ViewerResolver } from './viewer-resolver.service.js';

const staff: ResolvedViewer = {
  viewer: { kind: 'staff', employeeId: 1, role: 'SERVICE' },
  employee: { id: 1, role: 'SERVICE' },
};
const guest: ResolvedViewer = { viewer: { kind: 'guest', tableSessionId: 2, tableId: 3 } };

function guard(
  resolved: ResolvedViewer | null,
  requirement?: LoginRequirement,
  frontendUrl = 'http://localhost:4200',
) {
  const config = stub<ConfigService>({
    getOrThrow: () => 'http://localhost:3000',
    get: () => frontendUrl,
  });
  const reflector = stub<Reflector>({ getAllAndOverride: () => requirement });
  const viewers = stub<ViewerResolver>({ resolve: vi.fn().mockResolvedValue(resolved) });

  return new AuthGuard(config, reflector, viewers);
}

function request(method: string, origin?: string): AuthenticatedRequest {
  return { method, headers: origin ? { origin } : {} };
}

function context(req: AuthenticatedRequest) {
  return stub<ExecutionContext>({
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => undefined,
    getClass: () => undefined,
  });
}

describe('U-AG-01..05 origin check', () => {
  it('lets anonymous callers use public routes', async () => {
    await expect(guard(null).canActivate(context(request('POST')))).resolves.toBe(true);
  });

  it('rejects a state-changing request from a foreign origin', async () => {
    await expect(
      guard(null).canActivate(context(request('POST', 'http://evil.test'))),
    ).rejects.toThrow(ForbiddenException);
  });

  it('accepts the frontend and the API origin', async () => {
    await expect(
      guard(null).canActivate(context(request('POST', 'http://localhost:4200'))),
    ).resolves.toBe(true);
    await expect(
      guard(null).canActivate(context(request('DELETE', 'http://localhost:3000'))),
    ).resolves.toBe(true);
  });

  it('lets reads from any origin through', async () => {
    await expect(
      guard(null).canActivate(context(request('GET', 'http://evil.test'))),
    ).resolves.toBe(true);
  });

  it('compares origins, not configured URLs', async () => {
    await expect(
      guard(null, undefined, 'http://localhost:4200/').canActivate(
        context(request('POST', 'http://localhost:4200')),
      ),
    ).resolves.toBe(true);
  });
});

describe('U-AG-06..09 login requirement', () => {
  it('turns anonymous callers and guests away from @RequireLogin()', async () => {
    await expect(guard(null, {}).canActivate(context(request('GET')))).rejects.toThrow(
      'Login required',
    );
    await expect(guard(guest, {}).canActivate(context(request('GET')))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lets guests through @RequireLogin({ guests: true })', async () => {
    await expect(guard(guest, { guests: true }).canActivate(context(request('GET')))).resolves.toBe(
      true,
    );
    await expect(guard(null, { guests: true }).canActivate(context(request('GET')))).rejects.toThrow(
      'scan the QR code',
    );
  });

  it('lets staff through either requirement', async () => {
    await expect(guard(staff, {}).canActivate(context(request('GET')))).resolves.toBe(true);
  });

  it('puts the caller on the request', async () => {
    const staffRequest = request('GET');
    await guard(staff).canActivate(context(staffRequest));
    expect(staffRequest.employee).toEqual(staff.employee);
    expect(staffRequest.viewer).toEqual(staff.viewer);

    const guestRequest = request('GET');
    await guard(guest).canActivate(context(guestRequest));
    expect(guestRequest.employee).toBeUndefined();
    expect(guestRequest.viewer).toEqual(guest.viewer);
  });
});
