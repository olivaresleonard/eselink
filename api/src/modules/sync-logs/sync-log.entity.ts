import { Column, Entity, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { SyncLogLevel } from '../../common/entities/domain.enums.js';
import { Account } from '../accounts/account.entity.js';
import { Listing } from '../listings/listing.entity.js';
import { SyncJob } from '../sync-jobs/sync-job.entity.js';
import { Workspace } from '../workspaces/workspace.entity.js';

@Entity('sync_logs')
export class SyncLog extends BaseEntity {
  @Column({ name: 'workspace_id' })
  workspaceId!: string;

  @Column({ name: 'sync_job_id', type: 'text', nullable: true })
  syncJobId?: string | null;

  @Column({ name: 'account_id', type: 'text', nullable: true })
  accountId?: string | null;

  @Column({ name: 'listing_id', type: 'text', nullable: true })
  listingId?: string | null;

  @Column()
  action!: string;

  @Column()
  status!: string;

  @Column({ type: 'enum', enum: SyncLogLevel, default: SyncLogLevel.INFO })
  level!: SyncLogLevel;

  @Column()
  message!: string;

  @Column({ name: 'correlation_id', type: 'text', nullable: true })
  correlationId?: string | null;

  @Column({ name: 'payload_summary', type: 'jsonb', nullable: true })
  payloadSummary?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  context?: Record<string, unknown> | null;

  @ManyToOne(() => Workspace, (workspace) => workspace.syncLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Relation<Workspace>;

  @ManyToOne(() => SyncJob, (syncJob) => syncJob.logs, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'sync_job_id' })
  syncJob?: Relation<SyncJob> | null;

  @ManyToOne(() => Account, (account) => account.syncLogs, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'account_id' })
  account?: Relation<Account> | null;

  @ManyToOne(() => Listing, (listing) => listing.syncLogs, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'listing_id' })
  listing?: Relation<Listing> | null;
}
