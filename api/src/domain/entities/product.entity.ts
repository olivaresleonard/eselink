import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { ProductVariant } from './product-variant.entity.js';

@Entity('products')
export class Product extends BaseEntity {
  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @OneToMany(() => ProductVariant, (productVariant) => productVariant.product)
  variants!: ProductVariant[];
}
