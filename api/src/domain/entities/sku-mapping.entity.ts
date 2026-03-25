import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { Account } from './account.entity.js';
import { ProductVariant } from './product-variant.entity.js';

@Entity('sku_mappings')
export class SkuMapping extends BaseEntity {
  @Column({ name: 'product_variant_id' })
  productVariantId!: string;

  @Column({ name: 'account_id' })
  accountId!: string;

  @Column({ name: 'external_sku' })
  externalSku!: string;

  @ManyToOne(() => ProductVariant, (productVariant) => productVariant.skuMappings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_variant_id' })
  productVariant!: ProductVariant;

  @ManyToOne(() => Account, (account) => account.skuMappings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Account;
}
