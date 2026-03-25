import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { syncQueueNames } from '../modules/sync-jobs/sync-jobs.constants.js';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.get<string>('REDIS_URL', 'redis://localhost:6379'),
        },
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 200,
          removeOnFail: 500,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: syncQueueNames.import_orders },
      { name: syncQueueNames.sync_inventory },
      { name: syncQueueNames.sync_price },
      { name: syncQueueNames.publish_listing },
      { name: syncQueueNames.process_webhook },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
