import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiCookieAuth } from '@nestjs/swagger';
import type { EmployeeRole } from '@smart-restaurant/contracts';

export const REQUIRE_LOGIN = 'smart-restaurant:require-login';

/** The cookie that identifies a guest; see `GuestAccessService`. */
export const GUEST_COOKIE = 'sr_guest';

export interface LoginRequirement {
  /** Also accept a guest seated through a table QR code, not only staff. */
  guests?: boolean;
  roles?: readonly EmployeeRole[];
}

/**
 * Public catalog routes stay unmarked. Protected routes require staff or an
 * explicitly accepted table guest; optional roles restrict staff further.
 */
export const RequireLogin = (requirement: LoginRequirement = {}) =>
  applyDecorators(
    SetMetadata(REQUIRE_LOGIN, requirement),
    ApiCookieAuth('better-auth.session_token'),
    ...(requirement.guests ? [ApiCookieAuth(GUEST_COOKIE)] : []),
  );
