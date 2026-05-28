import { Module } from '@nestjs/common';
import { KeywordController } from './keyword.controller';
import { KeywordService } from './keyword.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [KeywordController],
  providers: [KeywordService],
  exports: [KeywordService],
})
export class KeywordModule {}
