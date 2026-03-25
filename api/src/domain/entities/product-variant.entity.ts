import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { InventoryItem } from './inventory-item.entity.js';
import { InventoryMovement } from './inventory-movement.entity.js';
import { Listing } from './listing.entity.js';
import { Product } from './product.entity.js';
import { SkuMapping } from './sku-mapping.entity.js';

@Entity('product_variants')
export class ProductVariant extends BaseEntity {
  @Column({ name: 'product_id' })
  productId!: string;

  @Column()
  sku!: string;

  @Column()
  name!: string;

  @Column('numeric', { name: 'base_price', precision: 12, scale: 2, default: 0 })
  basePrice!: string;

  @ManyToOne(() => Product, (product) => product.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @OneToMany(() => Listing, (listing) => listing.productVariant)
  listings!: Listing[];

  @OneToMany(() => InventoryItem, (inventoryItem) => inventoryItem.productVariant)
  inventoryItems!: InventoryItem[];

  @OneToMany(() => InventoryMovement, (inventoryMovement) => inventoryMovement.productVariant)
  inventoryMovements!: InventoryMovement[];

  @OneToMany(() => SkuMapping, (skuMapping) => skuMapping.productVariant)
  skuMappings!: SkuMapping[];
}
