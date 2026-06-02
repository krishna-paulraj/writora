import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

// Global: emitted from many feature services (ai, blog, publish, content-plan),
// so export it everywhere rather than importing this module into each. AuthModule
// is still imported here for the controller's JwtAuthGuard.
@Global()
@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
