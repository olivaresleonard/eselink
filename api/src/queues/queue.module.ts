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
          host: configService.get<string>('REDIS_HOST', '127.0.0.1'),
          port: Number(configService.get<string>('REDIS_PORT', '6379')),
          password: configService.get<string>('REDIS_PASSWORD', ''),
          db: Number(configService.get<string>('REDIS_DB', '0')),
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
