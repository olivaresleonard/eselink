import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { ProductVariant } from './product-variant.entity.js';

@Entity('inventory_items')
export class InventoryItem extends BaseEntity {
  @Column({ name: 'product_variant_id' })
  productVariantId!: string;

  @Column({ name: 'available_stock', type: 'int', default: 0 })
  availableStock!: number;

  @Column({ name: 'reserved_stock', type: 'int', default: 0 })
  reservedStock!: number;

  @ManyToOne(() => ProductVariant, (productVariant) => productVariant.inventoryItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_variant_id' })
  productVariant!: ProductVariant;
}
