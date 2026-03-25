import { Column, Entity, Index, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { Order } from '../orders/order.entity.js';
import { User } from '../users/user.entity.js';
import { Workspace } from '../workspaces/workspace.entity.js';

@Index('idx_order_assignments_workspace_user', ['workspaceId', 'userId'])
@Index('uq_order_assignments_order_user', ['orderId', 'userId'], { unique: true })
@Entity('order_assignments')
export class OrderAssignment extends BaseEntity {
  @Column({ name: 'workspace_id' })
  workspaceId!: string;

  @Column({ name: 'order_id' })
  orderId!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'assigned_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  assignedAt!: Date;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @ManyToOne(() => Workspace, (workspace) => workspace.orderAssignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Relation<Workspace>;

  @ManyToOne(() => Order, (order) => order.assignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Relation<Order>;

  @ManyToOne(() => User, (user) => user.orderAssignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;
}
