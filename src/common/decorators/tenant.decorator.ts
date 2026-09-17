import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Tenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // Allow header override if user is SUPER_ADMIN
    if (request.user?.role === 'SUPER_ADMIN' && request.headers['x-school-id']) {
      return request.headers['x-school-id'];
    }
    return request.user?.schoolId || request.headers['x-school-id'] || null;
  },
);
