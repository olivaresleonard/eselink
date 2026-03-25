import { Column, Entity, JoinColumn, ManyToOne, OneToMany, Relation } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { ProductStatus } from '../../common/entities/domain.enums.js';
import { Listing } from '../listings/listing.entity.js';
import { ProductVariant } from '../product-variants/product-variant.entity.js';
import { Workspace } from '../workspaces/workspace.entity.js';

@Entity('products')
export class Product extends BaseEntity {
  @Column({ name: 'workspace_id' })
  workspaceId!: string;

  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  handle?: string | null;

  @Column({ name: 'internal_reference', type: 'text', nullable: true })
  internalReference?: string | null;

  @Column({ name: 'internal_category', type: 'text', nullable: true })
  internalCategory?: string | null;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'text', nullable: true })
  brand?: string | null;

  @Column({ type: 'enum', enum: ProductStatus, default: ProductStatus.DRAFT })
  status!: ProductStatus;

  @Column({ type: 'jsonb', nullable: true })
  attributes?: Record<string, unknown> | null;

  @ManyToOne(() => Workspace, (workspace) => workspace.products, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Relation<Workspace>;

  @OneToMany(() => ProductVariant, (variant) => variant.product)
  variants!: Relation<ProductVariant[]>;

  @OneToMany(() => Listing, (listing) => listing.product)
  listings!: Relation<Listing[]>;
}
