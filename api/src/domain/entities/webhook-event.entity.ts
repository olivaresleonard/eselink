import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { PlatformCode } from '../../common/entities/domain.enums.js';

@Entity('webhook_events')
export class WebhookEvent extends BaseEntity {
  @Column({ type: 'enum', enum: PlatformCode })
  channel!: PlatformCode;

  @Column({ name: 'event_type' })
  eventType!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ default: false })
  processed!: boolean;
}
