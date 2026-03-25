import { Column, Entity, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { InventoryMovementType } from '../../common/entities/domain.enums.js';
import { InventoryItem } from '../inventory/inventory-item.entity.js';
import { Workspace } from '../workspaces/workspace.entity.js';

@Entity('inventory_movements')
export class InventoryMovement extends BaseEntity {
  @Column({ name: 'workspace_id' })
  workspaceId!: string;

  @Column({ name: 'inventory_item_id' })
  inventoryItemId!: string;

  @Column({ type: 'enum', enum: InventoryMovementType })
  type!: InventoryMovementType;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({ name: 'previous_available', type: 'int', nullable: true })
  previousAvailable?: number | null;

  @Column({ name: 'new_available', type: 'int', nullable: true })
  newAvailable?: number | null;

  @Column({ name: 'reference_type', type: 'text', nullable: true })
  referenceType?: string | null;

  @Column({ name: 'reference_id', type: 'text', nullable: true })
  referenceId?: string | null;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @ManyToOne(() => Workspace, (workspace) => workspace.inventoryMovements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Relation<Workspace>;

  @ManyToOne(() => InventoryItem, (inventoryItem) => inventoryItem.movements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventory_item_id' })
  inventoryItem!: Relation<InventoryItem>;
}
