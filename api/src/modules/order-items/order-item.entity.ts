import { Column, Entity, Index, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { Listing } from '../listings/listing.entity.js';
import { ProductVariant } from '../product-variants/product-variant.entity.js';
import { Order } from '../orders/order.entity.js';
import { Workspace } from '../workspaces/workspace.entity.js';

@Index('idx_order_items_workspace_order', ['workspaceId', 'orderId'])
@Index('idx_order_items_workspace_variant', ['workspaceId', 'variantId'])
@Index('idx_order_items_workspace_external_sku', ['workspaceId', 'externalSku'])
@Entity('order_items')
export class OrderItem extends BaseEntity {
  @Column({ name: 'workspace_id' })
  workspaceId!: string;

  @Column({ name: 'order_id' })
  orderId!: string;

  @Column({ name: 'listing_id', type: 'text', nullable: true })
  listingId?: string | null;

  @Column({ name: 'variant_id', type: 'text', nullable: true })
  variantId?: string | null;

  @Column({ name: 'external_item_id', type: 'text', nullable: true })
  externalItemId?: string | null;

  @Column({ name: 'external_sku', type: 'text', nullable: true })
  externalSku?: string | null;

  @Column()
  title!: string;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({ default: 'CLP' })
  currency!: string;

  @Column('numeric', { name: 'unit_price', precision: 12, scale: 2, default: 0 })
  unitPrice!: string;

  @Column('numeric', { name: 'discount_amount', precision: 12, scale: 2, nullable: true })
  discountAmount?: string | null;

  @Column('numeric', { name: 'total_amount', precision: 12, scale: 2, nullable: true })
  totalAmount?: string | null;

  @ManyToOne(() => Workspace, (workspace) => workspace.orderItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Relation<Workspace>;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Relation<Order>;

  @ManyToOne(() => Listing, (listing) => listing.orderItems, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'listing_id' })
  listing?: Relation<Listing> | null;

  @ManyToOne(() => ProductVariant, (variant) => variant.orderItems, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'variant_id' })
  variant?: Relation<ProductVariant> | null;
}
