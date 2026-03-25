import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderAssignment } from './order-assignment.entity.js';
import { OrderAssignmentsController } from './order-assignments.controller.js';
import { OrderAssignmentsRepository } from './order-assignments.repository.js';
import { OrderAssignmentsService } from './order-assignments.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([OrderAssignment])],
  controllers: [OrderAssignmentsController],
  providers: [OrderAssignmentsRepository, OrderAssignmentsService],
  exports: [OrderAssignmentsService],
})
export class OrderAssignmentsModule {}
