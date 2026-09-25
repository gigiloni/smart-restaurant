import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedEmployee, AuthenticatedRequest } from './auth.types.js';

export const CurrentEmployee = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedEmployee =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().employee,
);
