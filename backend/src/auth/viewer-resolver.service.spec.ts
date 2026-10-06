import { describe, expect, it, vi } from 'vitest';

import { stub } from '../../test/support/unit.js';
import type { PrismaService } from '../database/prisma.service.js';
import type { AuthService } from './auth.service.js';
import type { GuestAccessService } from './guest-access.service.js';
import { ViewerResolver } from './viewer-resolver.service.js';
import type { GuestViewer } from './viewer.types.js';

const guest: GuestViewer = { kind: 'guest', tableSessionId: 2, tableId: 3 };

const findEmployee = vi.fn();

function resolver(
  session: { user: { id: string } } | null,
  employee: { id: number; role: string } | null,
  guestViewer: GuestViewer | null,
) {
  findEmployee.mockReset().mockResolvedValue(employee);

  return new ViewerResolver(
    stub<AuthService>({ auth: { api: { getSession: vi.fn().mockResolvedValue(session) } } }),
    stub<PrismaService>({ employee: { findUnique: findEmployee } }),
    stub<GuestAccessService>({ resolve: vi.fn().mockResolvedValue(guestViewer) }),
  );
}

describe('U-VR-01..04 ViewerResolver', () => {
  it('prefers a staff login over a guest cookie', async () => {
    const resolved = await resolver({ user: { id: 'u' } }, { id: 4, role: 'BAR' }, guest).resolve(
      {},
      { allowGuests: true },
    );

    expect(resolved?.viewer).toEqual({ kind: 'staff', employeeId: 4, role: 'BAR' });
    expect(findEmployee).toHaveBeenCalledWith(expect.objectContaining({ where: { authUserId: 'u' } }));
  });

  it('falls back to the guest cookie', async () => {
    const resolved = await resolver(null, null, guest).resolve({}, { allowGuests: true });

    expect(resolved?.viewer).toEqual(guest);
  });

  it('ignores guests when they are not allowed', async () => {
    await expect(resolver(null, null, guest).resolve({}, { allowGuests: false })).resolves.toBeNull();
  });

  it('treats a login without an employee as anonymous', async () => {
    await expect(
      resolver({ user: { id: 'u' } }, null, null).resolve({}, { allowGuests: true }),
    ).resolves.toBeNull();
  });
});
