import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderComment } from './order-comment.entity.js';
import { OrderCommentsController } from './order-comments.controller.js';
import { OrderCommentsRepository } from './order-comments.repository.js';
import { OrderCommentsService } from './order-comments.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([OrderComment])],
  controllers: [OrderCommentsController],
  providers: [OrderCommentsRepository, OrderCommentsService],
  exports: [OrderCommentsService],
})
export class OrderCommentsModule {}
