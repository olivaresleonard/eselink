import { Column, Entity, Index, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { Order } from '../orders/order.entity.js';
import { Workspace } from '../workspaces/workspace.entity.js';

@Index('idx_order_tags_workspace_order', ['workspaceId', 'orderId'])
@Entity('order_tags')
export class OrderTag extends BaseEntity {
  @Column({ name: 'workspace_id' })
  workspaceId!: string;

  @Column({ name: 'order_id' })
  orderId!: string;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  color?: string | null;

  @ManyToOne(() => Workspace, (workspace) => workspace.orderTags, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Relation<Workspace>;

  @ManyToOne(() => Order, (order) => order.tags, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Relation<Order>;
}
