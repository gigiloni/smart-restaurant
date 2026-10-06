import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../database/prisma.service.js';
import { GUEST_COOKIE } from './access-metadata.js';
import type { GuestViewer } from './viewer.types.js';

/** A dinner rarely outlasts this; the session being cleared ends access sooner. */
const GUEST_COOKIE_MAX_AGE_SECONDS = 12 * 60 * 60;

/**
 * Guest identity without accounts.
 *
 * A table's QR code carries a token that proves the holder is at that table.
 * Presenting it joins the table's session and sets a cookie naming that
 * session, a random browser identity and a signed expiry. Re-entering the same
 * visit preserves that identity. The cookie is bound to the session, so it
 * stops working the moment service clears the table: the party that just left
 * cannot watch the next one order.
 *
 * Both are HMACs under a key derived from the auth secret, so neither can be
 * forged and neither shares a MAC with anything Better Auth signs.
 */
@Injectable()
export class GuestAccessService {
  private readonly key: Buffer;
  private readonly secureCookies: boolean;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.key = createHmac('sha256', config.getOrThrow<string>('auth.secret'))
      .update('smart-restaurant/guest-access/v1')
      .digest();
    this.secureCookies = config.getOrThrow<string>('auth.url').startsWith('https:');
  }

  tableToken(tableId: number): string {
    return this.mac(`table:${tableId}`);
  }

  verifyTableToken(tableId: number, token: string): boolean {
    return this.equal(token, this.tableToken(tableId));
  }

  /** The `Set-Cookie` header value that makes the caller a guest of `tableSessionId`. */
  cookieFor(tableSessionId: number, previous?: GuestViewer): string {
    const guestId = previous?.tableSessionId === tableSessionId ? previous.guestId : randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + GUEST_COOKIE_MAX_AGE_SECONDS;
    const payload = `${tableSessionId}.${guestId}.${expiresAt}`;
    const value = `${payload}.${this.mac(`guest:v2:${payload}`)}`;

    return [
      `${GUEST_COOKIE}=${value}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${GUEST_COOKIE_MAX_AGE_SECONDS}`,
      ...(this.secureCookies ? ['Secure'] : []),
    ].join('; ');
  }

  /**
   * The guest a request comes from, or null when it carries no valid guest
   * cookie or the session it names has been closed.
   */
  async resolve(cookieHeader: string | undefined): Promise<GuestViewer | null> {
    const value = readCookie(cookieHeader, GUEST_COOKIE);
    const [id, guestId, expiresAt, mac, extra] = value?.split('.') ?? [];
    const tableSessionId = Number(id);

    if (
      !Number.isSafeInteger(tableSessionId) ||
      tableSessionId <= 0 ||
      !mac ||
      extra ||
      !guestId ||
      !/^[0-9a-f-]{36}$/.test(guestId) ||
      !Number.isSafeInteger(Number(expiresAt)) ||
      Number(expiresAt) <= Date.now() / 1000
    ) {
      return null;
    }

    if (!this.equal(mac, this.mac(`guest:v2:${id}.${guestId}.${expiresAt}`))) {
      return null;
    }

    const session = await this.prisma.tableSession.findUnique({
      where: { id: tableSessionId },
      select: { tableId: true, closedAt: true },
    });

    if (!session || session.closedAt) {
      return null;
    }

    return { kind: 'guest', guestId, tableSessionId, tableId: session.tableId };
  }

  private mac(message: string): string {
    return createHmac('sha256', this.key).update(message).digest('base64url');
  }

  private equal(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);

    return left.length === right.length && timingSafeEqual(left, right);
  }
}

function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of header?.split(';') ?? []) {
    const separator = part.indexOf('=');

    if (separator !== -1 && part.slice(0, separator).trim() === name) {
      // Our values are digits, a dot and base64url: nothing to decode.
      return part.slice(separator + 1).trim();
    }
  }

  return undefined;
}
