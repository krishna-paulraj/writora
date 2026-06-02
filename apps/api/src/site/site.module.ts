import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SiteController } from './site.controller';
import { SiteService } from './site.service';
import { SiteContextGuard } from './site-context.guard';

// Global so every feature controller can apply @UseGuards(JwtAuthGuard,
// SiteContextGuard) and read @CurrentSite() without importing SiteModule.
@Global()
@Module({
  imports: [AuthModule],
  controllers: [SiteController],
  providers: [SiteService, SiteContextGuard],
  exports: [SiteService, SiteContextGuard],
})
export class SiteModule {}
