import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedRequest } from './auth.types.js';
import type { Viewer } from './viewer.types.js';

/**
 * The staff member or guest making the request. Works on every guarded route,
 * including those marked `@AllowGuests()`.
 */
export const CurrentViewer = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Viewer =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().viewer,
);
