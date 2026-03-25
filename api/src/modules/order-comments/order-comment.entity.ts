import { Column, Entity, Index, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { Order } from '../orders/order.entity.js';
import { User } from '../users/user.entity.js';
import { Workspace } from '../workspaces/workspace.entity.js';

@Index('idx_order_comments_workspace_order_created', ['workspaceId', 'orderId', 'createdAt'])
@Entity('order_comments')
export class OrderComment extends BaseEntity {
  @Column({ name: 'workspace_id' })
  workspaceId!: string;

  @Column({ name: 'order_id' })
  orderId!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'is_internal', default: true })
  isInternal!: boolean;

  @ManyToOne(() => Workspace, (workspace) => workspace.orderComments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Relation<Workspace>;

  @ManyToOne(() => Order, (order) => order.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Relation<Order>;

  @ManyToOne(() => User, (user) => user.orderComments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;
}
