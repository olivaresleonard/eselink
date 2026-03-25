import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTypeOrmRepository } from '../../common/repositories/base-typeorm.repository.js';
import { WebhookEvent } from './webhook-event.entity.js';

@Injectable()
export class WebhooksRepository extends BaseTypeOrmRepository<WebhookEvent> {
  constructor(@InjectRepository(WebhookEvent) repository: Repository<WebhookEvent>) {
    super(repository, 'webhooks');
  }
}
