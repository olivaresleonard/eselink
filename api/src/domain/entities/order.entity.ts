import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { OrderStatus } from '../../common/entities/domain.enums.js';
import { Account } from './account.entity.js';
import { OrderItem } from './order-item.entity.js';

@Entity('orders')
export class Order extends BaseEntity {
  @Column({ name: 'account_id' })
  accountId!: string;

  @Column({ name: 'external_order_id' })
  externalOrderId!: string;

  @Column({ name: 'customer_name', nullable: true })
  customerName?: string | null;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status!: OrderStatus;

  @Column({ default: 'CLP' })
  currency!: string;

  @Column('numeric', { name: 'total_amount', precision: 12, scale: 2, default: 0 })
  totalAmount!: string;

  @Column({ name: 'placed_at', type: 'timestamptz', nullable: true })
  placedAt?: Date | null;

  @ManyToOne(() => Account, (account) => account.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Account;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order)
  items!: OrderItem[];
}
