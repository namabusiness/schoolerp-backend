import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Tenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const rawId =
      request.headers['x-school-id'] ||
      request.headers['x-demo-school-id'] ||
      request.user?.schoolId;

    if (!rawId || rawId === 'greenwood-high') {
      return 'school-greenwood-high';
    }
    return rawId;
  },
);
