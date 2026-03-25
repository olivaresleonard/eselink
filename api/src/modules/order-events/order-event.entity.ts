import { Column, Entity, Index, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { OrderEventType } from '../../common/entities/domain.enums.js';
import { Order } from '../orders/order.entity.js';
import { Workspace } from '../workspaces/workspace.entity.js';

@Index('idx_order_events_workspace_order_occurred', ['workspaceId', 'orderId', 'occurredAt'])
@Index('idx_order_events_workspace_type', ['workspaceId', 'type'])
@Entity('order_events')
export class OrderEvent extends BaseEntity {
  @Column({ name: 'workspace_id' })
  workspaceId!: string;

  @Column({ name: 'order_id' })
  orderId!: string;

  @Column({ type: 'enum', enum: OrderEventType })
  type!: OrderEventType;

  @Column({ name: 'external_status', type: 'text', nullable: true })
  externalStatus?: string | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload?: Record<string, unknown> | null;

  @Column({ name: 'occurred_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  occurredAt!: Date;

  @ManyToOne(() => Workspace, (workspace) => workspace.orderEvents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Relation<Workspace>;

  @ManyToOne(() => Order, (order) => order.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Relation<Order>;
}
