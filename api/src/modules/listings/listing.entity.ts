import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Relation } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { ListingStatus } from '../../common/entities/domain.enums.js';
import { Account } from '../accounts/account.entity.js';
import { Channel } from '../channels/channel.entity.js';
import { OrderItem } from '../order-items/order-item.entity.js';
import { ProductVariant } from '../product-variants/product-variant.entity.js';
import { Product } from '../products/product.entity.js';
import { SkuMapping } from '../sku-mappings/sku-mapping.entity.js';
import { SyncLog } from '../sync-logs/sync-log.entity.js';
import { Workspace } from '../workspaces/workspace.entity.js';

@Index('uq_listings_workspace_account_external', ['workspaceId', 'accountId', 'externalListingId'], {
  unique: true,
})
@Entity('listings')
export class Listing extends BaseEntity {
  @Column({ name: 'workspace_id' })
  workspaceId!: string;

  @Column({ name: 'product_id' })
  productId!: string;

  @Column({ name: 'product_variant_id', type: 'text', nullable: true })
  variantId?: string | null;

  @Column({ name: 'account_id' })
  accountId!: string;

  @Column({ name: 'channel_id' })
  channelId!: string;

  @Column({ name: 'external_listing_id', type: 'text', nullable: true })
  externalListingId?: string | null;

  @Column({ name: 'external_sku', type: 'text', nullable: true })
  externalSku?: string | null;

  @Column({ name: 'external_status', type: 'text', nullable: true })
  externalStatus?: string | null;

  @Column()
  title!: string;

  @Column({ type: 'enum', enum: ListingStatus, default: ListingStatus.DRAFT })
  status!: ListingStatus;

  @Column({ type: 'text', nullable: true })
  permalink?: string | null;

  @Column({ default: 'CLP' })
  currency!: string;

  @Column('numeric', { precision: 12, scale: 2, nullable: true })
  price?: string | null;

  @Column({ type: 'int', nullable: true })
  stock?: number | null;

  @Column({ name: 'last_published_at', type: 'timestamptz', nullable: true })
  lastPublishedAt?: Date | null;

  @Column({ name: 'last_price_sync_at', type: 'timestamptz', nullable: true })
  lastPriceSyncAt?: Date | null;

  @Column({ name: 'last_inventory_sync_at', type: 'timestamptz', nullable: true })
  lastInventorySyncAt?: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @ManyToOne(() => Product, (product) => product.listings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: Relation<Product>;

  @ManyToOne(() => ProductVariant, (variant) => variant.listings, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'product_variant_id' })
  variant?: Relation<ProductVariant> | null;

  @ManyToOne(() => Account, (account) => account.listings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Relation<Account>;

  @ManyToOne(() => Channel, (channel) => channel.listings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_id' })
  channel!: Relation<Channel>;

  @ManyToOne(() => Workspace, (workspace) => workspace.listings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Relation<Workspace>;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.listing)
  orderItems!: Relation<OrderItem[]>;

  @OneToMany(() => SkuMapping, (mapping) => mapping.listing)
  skuMappings!: Relation<SkuMapping[]>;

  @OneToMany(() => SyncLog, (syncLog) => syncLog.listing)
  syncLogs!: Relation<SyncLog[]>;
}
