import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderTag } from './order-tag.entity.js';
import { OrderTagsController } from './order-tags.controller.js';
import { OrderTagsRepository } from './order-tags.repository.js';
import { OrderTagsService } from './order-tags.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([OrderTag])],
  controllers: [OrderTagsController],
  providers: [OrderTagsRepository, OrderTagsService],
  exports: [OrderTagsService],
})
export class OrderTagsModule {}
