
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { ServicesScheduler } from './services.scheduler';

@Module({
  imports: [AuthModule],
  controllers: [ServicesController],
  providers: [ServicesService, ServicesScheduler],
})
export class ServicesModule {}
