import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiCookieAuth } from '@nestjs/swagger';

export const REQUIRE_LOGIN = 'smart-restaurant:require-login';

/** The cookie that identifies a guest; see `GuestAccessService`. */
export const GUEST_COOKIE = 'sr_guest';

export interface LoginRequirement {
  /** Also accept a guest seated through a table QR code, not only staff. */
  guests?: boolean;
}

/**
 * Makes a route require a login. Routes are public unless marked: the
 * frontend has no login pages yet, so access control is switched off for now.
 *
 * To put a route behind login again, add `@RequireLogin()` (staff only) or
 * `@RequireLogin({ guests: true })` (staff or a seated guest), and restore its
 * role check from `AccessService`, e.g. `this.access.requireAdmin(actor)`.
 */
export const RequireLogin = (requirement: LoginRequirement = {}) =>
  applyDecorators(
    SetMetadata(REQUIRE_LOGIN, requirement),
    ApiCookieAuth('better-auth.session_token'),
    ...(requirement.guests ? [ApiCookieAuth(GUEST_COOKIE)] : []),
  );
