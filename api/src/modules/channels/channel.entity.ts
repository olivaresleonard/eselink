import { Column, Entity, JoinColumn, ManyToOne, OneToMany, Relation } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { PlatformCode } from '../../common/entities/domain.enums.js';
import { Account } from '../accounts/account.entity.js';
import { Listing } from '../listings/listing.entity.js';
import { Order } from '../orders/order.entity.js';
import { Workspace } from '../workspaces/workspace.entity.js';

@Entity('channels')
export class Channel extends BaseEntity {
  @Column({ name: 'workspace_id' })
  workspaceId!: string;

  @Column()
  name!: string;

  @Column({ type: 'enum', enum: PlatformCode })
  code!: PlatformCode;

  @Column({ name: 'country_code', type: 'text', nullable: true })
  countryCode?: string | null;

  @Column({ type: 'text', nullable: true })
  region?: string | null;

  @Column({ name: 'is_enabled', default: true })
  isEnabled!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  settings?: Record<string, unknown> | null;

  @ManyToOne(() => Workspace, (workspace) => workspace.channels, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Relation<Workspace>;

  @OneToMany(() => Account, (account) => account.channel)
  accounts!: Relation<Account[]>;

  @OneToMany(() => Listing, (listing) => listing.channel)
  listings!: Relation<Listing[]>;

  @OneToMany(() => Order, (order) => order.channel)
  orders!: Relation<Order[]>;
}
