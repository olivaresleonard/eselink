import { Column, Entity, OneToMany, Relation } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { AccountConnection } from '../account-connections/account-connection.entity.js';
import { Account } from '../accounts/account.entity.js';
import { AuditEntry } from '../audit/audit-entry.entity.js';
import { Channel } from '../channels/channel.entity.js';
import { InventoryItem } from '../inventory/inventory-item.entity.js';
import { InventoryMovement } from '../inventory-movements/inventory-movement.entity.js';
import { Listing } from '../listings/listing.entity.js';
import { OrderAssignment } from '../order-assignments/order-assignment.entity.js';
import { OrderComment } from '../order-comments/order-comment.entity.js';
import { OrderEvent } from '../order-events/order-event.entity.js';
import { OrderItem } from '../order-items/order-item.entity.js';
import { OrderTag } from '../order-tags/order-tag.entity.js';
import { Order } from '../orders/order.entity.js';
import { ProductVariant } from '../product-variants/product-variant.entity.js';
import { Product } from '../products/product.entity.js';
import { Report } from '../reports/report.entity.js';
import { SkuMapping } from '../sku-mappings/sku-mapping.entity.js';
import { SyncJob } from '../sync-jobs/sync-job.entity.js';
import { SyncLog } from '../sync-logs/sync-log.entity.js';
import { WebhookEvent } from '../webhooks/webhook-event.entity.js';
import { WorkspaceUser } from '../workspace-users/workspace-user.entity.js';

@Entity('workspaces')
export class Workspace extends BaseEntity {
  @Column()
  name!: string;

  @Column({ unique: true })
  slug!: string;

  @Column({ default: 'active' })
  status!: string;

  @Column({ default: 'America/Santiago' })
  timezone!: string;

  @Column({ default: 'CLP' })
  currency!: string;

  @Column({ type: 'jsonb', nullable: true })
  settings?: Record<string, unknown> | null;

  @OneToMany(() => WorkspaceUser, (workspaceUser) => workspaceUser.workspace)
  workspaceUsers!: Relation<WorkspaceUser[]>;

  @OneToMany(() => Channel, (channel) => channel.workspace)
  channels!: Relation<Channel[]>;

  @OneToMany(() => Account, (account) => account.workspace)
  accounts!: Relation<Account[]>;

  @OneToMany(() => AccountConnection, (connection) => connection.workspace)
  accountConnections!: Relation<AccountConnection[]>;

  @OneToMany(() => Product, (product) => product.workspace)
  products!: Relation<Product[]>;

  @OneToMany(() => ProductVariant, (variant) => variant.workspace)
  productVariants!: Relation<ProductVariant[]>;

  @OneToMany(() => SkuMapping, (mapping) => mapping.workspace)
  skuMappings!: Relation<SkuMapping[]>;

  @OneToMany(() => Listing, (listing) => listing.workspace)
  listings!: Relation<Listing[]>;

  @OneToMany(() => InventoryItem, (inventoryItem) => inventoryItem.workspace)
  inventoryItems!: Relation<InventoryItem[]>;

  @OneToMany(() => InventoryMovement, (movement) => movement.workspace)
  inventoryMovements!: Relation<InventoryMovement[]>;

  @OneToMany(() => Order, (order) => order.workspace)
  orders!: Relation<Order[]>;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.workspace)
  orderItems!: Relation<OrderItem[]>;

  @OneToMany(() => OrderEvent, (orderEvent) => orderEvent.workspace)
  orderEvents!: Relation<OrderEvent[]>;

  @OneToMany(() => OrderComment, (comment) => comment.workspace)
  orderComments!: Relation<OrderComment[]>;

  @OneToMany(() => OrderAssignment, (assignment) => assignment.workspace)
  orderAssignments!: Relation<OrderAssignment[]>;

  @OneToMany(() => OrderTag, (tag) => tag.workspace)
  orderTags!: Relation<OrderTag[]>;

  @OneToMany(() => WebhookEvent, (event) => event.workspace)
  webhookEvents!: Relation<WebhookEvent[]>;

  @OneToMany(() => SyncJob, (job) => job.workspace)
  syncJobs!: Relation<SyncJob[]>;

  @OneToMany(() => SyncLog, (log) => log.workspace)
  syncLogs!: Relation<SyncLog[]>;

  @OneToMany(() => Report, (report) => report.workspace)
  reports!: Relation<Report[]>;

  @OneToMany(() => AuditEntry, (auditEntry) => auditEntry.workspace)
  auditEntries!: Relation<AuditEntry[]>;
}
