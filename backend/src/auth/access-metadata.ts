import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiCookieAuth } from '@nestjs/swagger';

export const ALLOW_GUESTS = 'smart-restaurant:allow-guests';
export const ALLOW_ANONYMOUS = 'smart-restaurant:allow-anonymous';

/** The cookie that identifies a guest; see `GuestAccessService`. */
export const GUEST_COOKIE = 'sr_guest';

/**
 * Lets guests seated through a table QR code reach this route as well as
 * staff. The handler must read the caller with `@CurrentViewer()`: for a guest
 * there is no employee, so `@CurrentEmployee()` is undefined.
 */
export const AllowGuests = () =>
  applyDecorators(
    SetMetadata(ALLOW_GUESTS, true),
    ApiCookieAuth('better-auth.session_token'),
    ApiCookieAuth(GUEST_COOKIE),
  );

/**
 * Lets a request through with no identity at all. Only for the route a guest
 * uses to obtain one.
 */
export const AllowAnonymous = () => SetMetadata(ALLOW_ANONYMOUS, true);
