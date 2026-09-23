import { Global, Module } from '@nestjs/common';
import { FastCacheService } from './fast-cache.service';

@Global()
@Module({
  providers: [FastCacheService],
  exports: [FastCacheService],
})
export class FastCacheModule {}
