import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { Order } from './order.entity.js';

@Entity('order_items')
export class OrderItem extends BaseEntity {
  @Column({ name: 'order_id' })
  orderId!: string;

  @Column({ name: 'external_sku', nullable: true })
  externalSku?: string | null;

  @Column({ type: 'int' })
  quantity!: number;

  @Column('numeric', { precision: 12, scale: 2, default: 0 })
  price!: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;
}
