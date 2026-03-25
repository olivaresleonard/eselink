import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Relation } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { InventoryItem } from '../inventory/inventory-item.entity.js';
import { Listing } from '../listings/listing.entity.js';
import { OrderItem } from '../order-items/order-item.entity.js';
import { Product } from '../products/product.entity.js';
import { SkuMapping } from '../sku-mappings/sku-mapping.entity.js';
import { Workspace } from '../workspaces/workspace.entity.js';

@Index('uq_product_variants_workspace_sku', ['workspaceId', 'sku'], { unique: true })
@Entity('product_variants')
export class ProductVariant extends BaseEntity {
  @Column({ name: 'workspace_id' })
  workspaceId!: string;

  @Column({ name: 'product_id' })
  productId!: string;

  @Column()
  sku!: string;

  @Column({ type: 'text', nullable: true })
  barcode?: string | null;

  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  option1?: string | null;

  @Column({ type: 'text', nullable: true })
  option2?: string | null;

  @Column({ type: 'text', nullable: true })
  option3?: string | null;

  @Column('numeric', { precision: 12, scale: 2, default: 0 })
  price!: string;

  @Column('numeric', { name: 'compare_at_price', precision: 12, scale: 2, nullable: true })
  compareAtPrice?: string | null;

  @Column('numeric', { precision: 12, scale: 2, nullable: true })
  cost?: string | null;

  @Column({ name: 'supplier_name', type: 'text', nullable: true })
  supplierName?: string | null;

  @Column({ name: 'supplier_product_alias', type: 'text', nullable: true })
  supplierProductAlias?: string | null;

  @Column({ default: 'CLP' })
  currency!: string;

  @Column({ name: 'weight_grams', type: 'int', nullable: true })
  weightGrams?: number | null;

  @Column({ type: 'jsonb', nullable: true })
  attributes?: Record<string, unknown> | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @ManyToOne(() => Product, (product) => product.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: Relation<Product>;

  @ManyToOne(() => Workspace, (workspace) => workspace.productVariants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Relation<Workspace>;

  @OneToMany(() => SkuMapping, (mapping) => mapping.variant)
  skuMappings!: Relation<SkuMapping[]>;

  @OneToMany(() => InventoryItem, (inventoryItem) => inventoryItem.variant)
  inventoryItems!: Relation<InventoryItem[]>;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.variant)
  orderItems!: Relation<OrderItem[]>;

  @OneToMany(() => Listing, (listing) => listing.variant)
  listings!: Relation<Listing[]>;
}
