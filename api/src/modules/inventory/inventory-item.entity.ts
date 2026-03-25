import { Column, Entity, JoinColumn, ManyToOne, OneToMany, Relation } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { InventoryMovement } from '../inventory-movements/inventory-movement.entity.js';
import { ProductVariant } from '../product-variants/product-variant.entity.js';
import { Workspace } from '../workspaces/workspace.entity.js';

@Entity('inventory_items')
export class InventoryItem extends BaseEntity {
  @Column({ name: 'workspace_id' })
  workspaceId!: string;

  @Column({ name: 'variant_id' })
  variantId!: string;

  @Column({ name: 'location_code', type: 'text', nullable: true })
  locationCode?: string | null;

  @Column({ name: 'on_hand', type: 'int', default: 0 })
  onHand!: number;

  @Column({ type: 'int', default: 0 })
  available!: number;

  @Column({ type: 'int', default: 0 })
  reserved!: number;

  @Column({ type: 'int', default: 0 })
  incoming!: number;

  @Column({ name: 'safety_stock', type: 'int', default: 0 })
  safetyStock!: number;

  @Column({ name: 'reorder_point', type: 'int', default: 0 })
  reorderPoint!: number;

  @ManyToOne(() => Workspace, (workspace) => workspace.inventoryItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Relation<Workspace>;

  @ManyToOne(() => ProductVariant, (variant) => variant.inventoryItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_id' })
  variant!: Relation<ProductVariant>;

  @OneToMany(() => InventoryMovement, (movement) => movement.inventoryItem)
  movements!: Relation<InventoryMovement[]>;
}
