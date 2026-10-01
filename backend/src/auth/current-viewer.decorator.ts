import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedRequest } from './auth.types.js';
import type { Viewer } from './viewer.types.js';

/**
 * The staff member or seated guest making the request, or undefined for an
 * anonymous caller.
 */
export const CurrentViewer = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Viewer | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().viewer,
);
