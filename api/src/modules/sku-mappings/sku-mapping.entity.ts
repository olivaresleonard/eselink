import { Column, Entity, Index, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { Account } from '../accounts/account.entity.js';
import { Listing } from '../listings/listing.entity.js';
import { ProductVariant } from '../product-variants/product-variant.entity.js';
import { Workspace } from '../workspaces/workspace.entity.js';

@Index('uq_sku_mappings_workspace_account_external_sku', ['workspaceId', 'accountId', 'externalSku'], {
  unique: true,
})
@Entity('sku_mappings')
export class SkuMapping extends BaseEntity {
  @Column({ name: 'workspace_id' })
  workspaceId!: string;

  @Column({ name: 'variant_id' })
  variantId!: string;

  @Column({ name: 'account_id' })
  accountId!: string;

  @Column({ name: 'listing_id', type: 'text', nullable: true })
  listingId?: string | null;

  @Column({ name: 'internal_sku' })
  internalSku!: string;

  @Column({ name: 'external_sku' })
  externalSku!: string;

  @Column({ name: 'external_product_id', type: 'text', nullable: true })
  externalProductId?: string | null;

  @Column({ name: 'external_variant_id', type: 'text', nullable: true })
  externalVariantId?: string | null;

  @Column({ name: 'is_primary', default: false })
  isPrimary!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @ManyToOne(() => Workspace, (workspace) => workspace.skuMappings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Relation<Workspace>;

  @ManyToOne(() => ProductVariant, (variant) => variant.skuMappings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_id' })
  variant!: Relation<ProductVariant>;

  @ManyToOne(() => Account, (account) => account.skuMappings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Relation<Account>;

  @ManyToOne(() => Listing, (listing) => listing.skuMappings, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'listing_id' })
  listing?: Relation<Listing> | null;
}
