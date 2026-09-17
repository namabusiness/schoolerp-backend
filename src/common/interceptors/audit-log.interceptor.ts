import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;

    // Only audit mutating requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const user = req.user;
      const schoolId = user?.schoolId || req.headers['x-school-id'] || null;
      const url = req.url;
      const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      const device = req.headers['user-agent'] || 'Web Browser';
      const moduleName = url.split('/')[2] || 'platform';
      const action = `${method} ${url}`;

      return next.handle().pipe(
        tap(async (response) => {
          try {
            await this.prisma.auditLog.create({
              data: {
                schoolId: schoolId || undefined,
                userId: user?.id || undefined,
                userEmail: user?.email || 'anonymous',
                module: moduleName.toUpperCase(),
                action,
                recordId: response?.id ? String(response.id) : undefined,
                ipAddress,
                device,
                previousValue: req.body ? JSON.stringify(req.body).slice(0, 1000) : null,
                newValue: response ? JSON.stringify(response).slice(0, 1000) : null,
              },
            });
          } catch (err) {
            this.logger.warn(`Failed to persist audit log: ${err?.message}`);
          }
        }),
      );
    }

    return next.handle();
  }
}
