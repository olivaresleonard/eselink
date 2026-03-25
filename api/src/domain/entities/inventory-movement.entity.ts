import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { InventoryMovementType } from '../../common/entities/domain.enums.js';
import { ProductVariant } from './product-variant.entity.js';

@Entity('inventory_movements')
export class InventoryMovement extends BaseEntity {
  @Column({ name: 'product_variant_id' })
  productVariantId!: string;

  @Column({ type: 'enum', enum: InventoryMovementType })
  type!: InventoryMovementType;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({ nullable: true })
  reason?: string | null;

  @ManyToOne(() => ProductVariant, (productVariant) => productVariant.inventoryMovements, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_variant_id' })
  productVariant!: ProductVariant;
}
