import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEvent } from './order-event.entity.js';
import { OrderEventsController } from './order-events.controller.js';
import { OrderEventsRepository } from './order-events.repository.js';
import { OrderEventsService } from './order-events.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([OrderEvent])],
  controllers: [OrderEventsController],
  providers: [OrderEventsRepository, OrderEventsService],
  exports: [OrderEventsService],
})
export class OrderEventsModule {}
