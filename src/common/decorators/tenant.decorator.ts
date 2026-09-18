import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Tenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // Allow header override if specified or fallback to user schoolId or greenwood default
    return request.headers['x-school-id'] || request.headers['x-demo-school-id'] || request.user?.schoolId || 'school-greenwood-high';
  },
);
