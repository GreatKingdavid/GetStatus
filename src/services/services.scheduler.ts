
import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ServicesService } from './services.service';

@Injectable()
export class ServicesScheduler {
  private readonly logger = new Logger(ServicesScheduler.name);
  private isRunning = false;

  constructor(private readonly servicesService: ServicesService) {}

  @Interval(60_000)
  async handleAutomaticChecks() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      await this.servicesService.checkAllAutomatically();
    } catch (error) {
      this.logger.error(
        'Automatic monitoring cycle failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isRunning = false;
    }
  }
}
