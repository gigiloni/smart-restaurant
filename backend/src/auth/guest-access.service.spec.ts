import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import { stub } from '../../test/support/unit.js';
import type { PrismaService } from '../database/prisma.service.js';
import { GuestAccessService } from './guest-access.service.js';

const SECRET = 's'.repeat(32);

function config(secret = SECRET, url = 'http://localhost:3000') {
  const values: Record<string, string> = { 'auth.secret': secret, 'auth.url': url };

  return stub<ConfigService>({ getOrThrow: (key: string) => values[key] });
}

function prismaFinding(session: { tableId: number; closedAt: Date | null } | null) {
  const findUnique = vi.fn().mockResolvedValue(session);

  return { findUnique, prisma: stub<PrismaService>({ tableSession: { findUnique } }) };
}

const guests = (prisma = prismaFinding(null).prisma, secret?: string, url?: string) =>
  new GuestAccessService(config(secret, url), prisma);

/** The `name=value` part of the cookie for a session. */
const cookieValue = (service: GuestAccessService, sessionId: number) =>
  service.cookieFor(sessionId).split(';')[0];

describe('U-GA-01..03 table tokens', () => {
  const service = guests();

  it('are deterministic and differ per table', () => {
    expect(service.tableToken(1)).toBe(service.tableToken(1));
    expect(service.tableToken(1)).not.toBe(service.tableToken(2));
  });

  it('depend on the secret', () => {
    expect(guests(undefined, 't'.repeat(32)).tableToken(1)).not.toBe(service.tableToken(1));
  });

  it("verify only the table's own token", () => {
    expect(service.verifyTableToken(1, service.tableToken(1))).toBe(true);
    expect(service.verifyTableToken(2, service.tableToken(1))).toBe(false);
    expect(service.verifyTableToken(1, 'short')).toBe(false);
  });
});

describe('U-GA-04..05 guest cookie', () => {
  it('is HTTP-only, SameSite=Lax and lasts 12 hours', () => {
    expect(guests().cookieFor(5)).toMatch(
      /^sr_guest=5\.[A-Za-z0-9_-]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=43200$/,
    );
  });

  it('is Secure only behind https', () => {
    expect(guests().cookieFor(5)).not.toContain('Secure');
    expect(guests(undefined, undefined, 'https://api.example.com').cookieFor(5)).toMatch(/; Secure$/);
  });
});

describe('U-GA-06..08 resolving the cookie', () => {
  it('names the guest of an open session', async () => {
    const { prisma, findUnique } = prismaFinding({ tableId: 3, closedAt: null });
    const service = guests(prisma);

    await expect(service.resolve(`theme=dark; ${cookieValue(service, 5)}`)).resolves.toEqual({
      kind: 'guest',
      tableSessionId: 5,
      tableId: 3,
    });
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 5 } }));
  });

  it('stops working once the session is closed or gone', async () => {
    const closed = guests(prismaFinding({ tableId: 3, closedAt: new Date() }).prisma);
    const gone = guests(prismaFinding(null).prisma);

    await expect(closed.resolve(cookieValue(closed, 5))).resolves.toBeNull();
    await expect(gone.resolve(cookieValue(gone, 5))).resolves.toBeNull();
  });

  it('rejects malformed and forged cookies without touching the database', async () => {
    const { prisma, findUnique } = prismaFinding({ tableId: 3, closedAt: null });
    const service = guests(prisma);
    const macOfSession5 = cookieValue(service, 5).split('.')[1];

    for (const header of [
      undefined,
      '',
      'sr_guest=',
      'sr_guest=5',
      'sr_guest=abc.x',
      'sr_guest=0.x',
      'sr_guest=-5.x',
      `sr_guest=6.${macOfSession5}`,
      'sr_guest=5.forged',
      // A table's QR token is a MAC too, but of a different message: it must
      // not double as the cookie of the session with the same number.
      `sr_guest=5.${service.tableToken(5)}`,
    ]) {
      await expect(service.resolve(header)).resolves.toBeNull();
    }

    expect(findUnique).not.toHaveBeenCalled();
  });
});
