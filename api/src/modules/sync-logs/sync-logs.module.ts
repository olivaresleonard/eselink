import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncLogsController } from './sync-logs.controller.js';
import { SyncLog } from './sync-log.entity.js';
import { SyncLogsRepository } from './sync-logs.repository.js';
import { SyncLogsService } from './sync-logs.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([SyncLog])],
  providers: [SyncLogsRepository, SyncLogsService],
  controllers: [SyncLogsController],
  exports: [SyncLogsService],
})
export class SyncLogsModule {}
