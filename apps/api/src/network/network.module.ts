import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NetworkController } from './network.controller';
import { NetworkService } from './network.service';

@Module({
  imports: [AuthModule],
  controllers: [NetworkController],
  providers: [NetworkService],
  exports: [NetworkService],
})
export class NetworkModule {}
