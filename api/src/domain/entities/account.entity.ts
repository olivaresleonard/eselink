import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { AccountStatus } from '../../common/entities/domain.enums.js';
import { Channel } from './channel.entity.js';
import { Listing } from './listing.entity.js';
import { Order } from './order.entity.js';
import { SkuMapping } from './sku-mapping.entity.js';

@Entity('accounts')
export class Account extends BaseEntity {
  @Column()
  name!: string;

  @Column({ name: 'channel_id' })
  channelId!: string;

  @Column({ name: 'access_token', type: 'text', nullable: true })
  accessToken?: string | null;

  @Column({ name: 'refresh_token', type: 'text', nullable: true })
  refreshToken?: string | null;

  @Column({ type: 'enum', enum: AccountStatus, default: AccountStatus.ACTIVE })
  status!: AccountStatus;

  @ManyToOne(() => Channel, (channel) => channel.accounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_id' })
  channel!: Channel;

  @OneToMany(() => Listing, (listing) => listing.account)
  listings!: Listing[];

  @OneToMany(() => Order, (order) => order.account)
  orders!: Order[];

  @OneToMany(() => SkuMapping, (skuMapping) => skuMapping.account)
  skuMappings!: SkuMapping[];
}
