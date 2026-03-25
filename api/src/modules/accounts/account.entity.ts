import { Column, Entity, JoinColumn, ManyToOne, OneToMany, Relation } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { AccountStatus } from '../../common/entities/domain.enums.js';
import { AccountConnection } from '../account-connections/account-connection.entity.js';
import { Channel } from '../channels/channel.entity.js';
import { Listing } from '../listings/listing.entity.js';
import { Order } from '../orders/order.entity.js';
import { SkuMapping } from '../sku-mappings/sku-mapping.entity.js';
import { SyncJob } from '../sync-jobs/sync-job.entity.js';
import { SyncLog } from '../sync-logs/sync-log.entity.js';
import { WebhookEvent } from '../webhooks/webhook-event.entity.js';
import { Workspace } from '../workspaces/workspace.entity.js';

@Entity('accounts')
export class Account extends BaseEntity {
  @Column({ name: 'workspace_id' })
  workspaceId!: string;

  @Column({ name: 'channel_id' })
  channelId!: string;

  @Column()
  name!: string;

  @Column({ name: 'external_id' })
  externalId!: string;

  @Column({ name: 'access_token', type: 'text', nullable: true })
  accessToken?: string | null;

  @Column({ name: 'refresh_token', type: 'text', nullable: true })
  refreshToken?: string | null;

  @Column({ name: 'external_name', type: 'text', nullable: true })
  externalName?: string | null;

  @Column({ type: 'enum', enum: AccountStatus, default: AccountStatus.ACTIVE })
  status!: AccountStatus;

  @Column({ default: 'CLP' })
  currency!: string;

  @Column({ name: 'country_code', type: 'text', nullable: true })
  countryCode?: string | null;

  @Column({ type: 'text', nullable: true })
  timezone?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  settings?: Record<string, unknown> | null;

  @Column({ name: 'last_sync_at', type: 'timestamptz', nullable: true })
  lastSyncAt?: Date | null;

  @Column({ name: 'last_orders_sync_at', type: 'timestamptz', nullable: true })
  lastOrdersSyncAt?: Date | null;

  @Column({ name: 'last_stock_sync_at', type: 'timestamptz', nullable: true })
  lastStockSyncAt?: Date | null;

  @Column({ name: 'last_price_sync_at', type: 'timestamptz', nullable: true })
  lastPriceSyncAt?: Date | null;

  @ManyToOne(() => Workspace, (workspace) => workspace.accounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Relation<Workspace>;

  @ManyToOne(() => Channel, (channel) => channel.accounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_id' })
  channel!: Relation<Channel>;

  @OneToMany(() => AccountConnection, (connection) => connection.account)
  connections!: Relation<AccountConnection[]>;

  @OneToMany(() => SkuMapping, (mapping) => mapping.account)
  skuMappings!: Relation<SkuMapping[]>;

  @OneToMany(() => Listing, (listing) => listing.account)
  listings!: Relation<Listing[]>;

  @OneToMany(() => Order, (order) => order.account)
  orders!: Relation<Order[]>;

  @OneToMany(() => WebhookEvent, (event) => event.account)
  webhookEvents!: Relation<WebhookEvent[]>;

  @OneToMany(() => SyncJob, (job) => job.account)
  syncJobs!: Relation<SyncJob[]>;

  @OneToMany(() => SyncLog, (log) => log.account)
  syncLogs!: Relation<SyncLog[]>;
}
