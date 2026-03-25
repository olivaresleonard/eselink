import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Relation } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { OrderStatus } from '../../common/entities/domain.enums.js';
import { Account } from '../accounts/account.entity.js';
import { Channel } from '../channels/channel.entity.js';
import { OrderAssignment } from '../order-assignments/order-assignment.entity.js';
import { OrderComment } from '../order-comments/order-comment.entity.js';
import { OrderEvent } from '../order-events/order-event.entity.js';
import { OrderItem } from '../order-items/order-item.entity.js';
import { OrderTag } from '../order-tags/order-tag.entity.js';
import { Workspace } from '../workspaces/workspace.entity.js';

@Index('idx_orders_workspace_status', ['workspaceId', 'status'])
@Index('idx_orders_workspace_account_created', ['workspaceId', 'accountId', 'createdAt'])
@Index('idx_orders_workspace_channel_created', ['workspaceId', 'channelId', 'createdAt'])
@Index('uq_orders_workspace_account_external', ['workspaceId', 'accountId', 'externalOrderId'], {
  unique: true,
})
@Index('idx_orders_external_order_id', ['externalOrderId'])
@Index('idx_orders_account_id', ['accountId'])
@Index('idx_orders_status', ['status'])
@Index('idx_orders_placed_at', ['placedAt'])
@Entity('orders')
export class Order extends BaseEntity {
  @Column({ name: 'workspace_id' })
  workspaceId!: string;

  @Column({ name: 'account_id' })
  accountId!: string;

  @Column({ name: 'channel_id' })
  channelId!: string;

  @Column({ name: 'external_order_id' })
  externalOrderId!: string;

  @Column({ name: 'order_number' })
  orderNumber!: string;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status!: OrderStatus;

  @Column({ name: 'external_status', type: 'text', nullable: true })
  externalStatus?: string | null;

  @Column({ name: 'financial_status', type: 'text', nullable: true })
  financialStatus?: string | null;

  @Column({ name: 'fulfillment_status', type: 'text', nullable: true })
  fulfillmentStatus?: string | null;

  @Column({ default: 'CLP' })
  currency!: string;

  @Column({ name: 'customer_name', type: 'text', nullable: true })
  customerName?: string | null;

  @Column({ name: 'customer_email', type: 'text', nullable: true })
  customerEmail?: string | null;

  @Column({ name: 'customer_phone', type: 'text', nullable: true })
  customerPhone?: string | null;

  @Column({ name: 'shipping_name', type: 'text', nullable: true })
  shippingName?: string | null;

  @Column({ name: 'shipping_address_1', type: 'text', nullable: true })
  shippingAddress1?: string | null;

  @Column({ name: 'shipping_address_2', type: 'text', nullable: true })
  shippingAddress2?: string | null;

  @Column({ name: 'shipping_city', type: 'text', nullable: true })
  shippingCity?: string | null;

  @Column({ name: 'shipping_region', type: 'text', nullable: true })
  shippingRegion?: string | null;

  @Column({ name: 'shipping_postal_code', type: 'text', nullable: true })
  shippingPostalCode?: string | null;

  @Column({ name: 'shipping_country', type: 'text', nullable: true })
  shippingCountry?: string | null;

  @Column('numeric', { name: 'subtotal_amount', precision: 12, scale: 2, nullable: true })
  subtotalAmount?: string | null;

  @Column('numeric', { name: 'shipping_amount', precision: 12, scale: 2, nullable: true })
  shippingAmount?: string | null;

  @Column('numeric', { name: 'tax_amount', precision: 12, scale: 2, nullable: true })
  taxAmount?: string | null;

  @Column('numeric', { name: 'discount_amount', precision: 12, scale: 2, nullable: true })
  discountAmount?: string | null;

  @Column('numeric', { name: 'total_amount', precision: 12, scale: 2, default: 0 })
  totalAmount!: string;

  @Column({ name: 'placed_at', type: 'timestamptz', nullable: true })
  placedAt?: Date | null;

  @Column({ name: 'external_created_at', type: 'timestamptz', nullable: true })
  externalCreatedAt?: Date | null;

  @Column({ name: 'imported_at', type: 'timestamptz', nullable: true })
  importedAt?: Date | null;

  @Column({ name: 'shipping_type', type: 'text', nullable: true })
  shippingType?: string | null;

  @Column({ name: 'shipping_status', type: 'text', nullable: true })
  shippingStatus?: string | null;

  @Column({ name: 'shipping_substatus', type: 'text', nullable: true })
  shippingSubstatus?: string | null;

  @Column({ name: 'shipping_stage', type: 'text', nullable: true })
  shippingStage?: string | null;

  @Column({ name: 'shipping_expected_date', type: 'timestamptz', nullable: true })
  shippingExpectedDate?: Date | null;

  @Column({ name: 'shipping_synced_at', type: 'timestamptz', nullable: true })
  shippingSyncedAt?: Date | null;

  @Column({ name: 'raw_payload', type: 'jsonb', nullable: true })
  rawPayload?: Record<string, unknown> | null;

  @ManyToOne(() => Workspace, (workspace) => workspace.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Relation<Workspace>;

  @ManyToOne(() => Account, (account) => account.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Relation<Account>;

  @ManyToOne(() => Channel, (channel) => channel.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_id' })
  channel!: Relation<Channel>;

  @OneToMany(() => OrderItem, (item) => item.order)
  items!: Relation<OrderItem[]>;

  @OneToMany(() => OrderEvent, (event) => event.order)
  events!: Relation<OrderEvent[]>;

  @OneToMany(() => OrderAssignment, (assignment) => assignment.order)
  assignments!: Relation<OrderAssignment[]>;

  @OneToMany(() => OrderComment, (comment) => comment.order)
  comments!: Relation<OrderComment[]>;

  @OneToMany(() => OrderTag, (tag) => tag.order)
  tags!: Relation<OrderTag[]>;
}
