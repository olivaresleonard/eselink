import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { ListingStatus } from '../../common/entities/domain.enums.js';
import { Account } from './account.entity.js';
import { ProductVariant } from './product-variant.entity.js';

@Entity('listings')
export class Listing extends BaseEntity {
  @Column({ name: 'account_id' })
  accountId!: string;

  @Column({ name: 'product_variant_id' })
  productVariantId!: string;

  @Column({ name: 'external_listing_id', nullable: true })
  externalListingId?: string | null;

  @Column({ name: 'external_sku', nullable: true })
  externalSku?: string | null;

  @Column('numeric', { precision: 12, scale: 2, default: 0 })
  price!: string;

  @Column({ type: 'enum', enum: ListingStatus, default: ListingStatus.DRAFT })
  status!: ListingStatus;

  @ManyToOne(() => Account, (account) => account.listings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Account;

  @ManyToOne(() => ProductVariant, (productVariant) => productVariant.listings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_variant_id' })
  productVariant!: ProductVariant;
}
