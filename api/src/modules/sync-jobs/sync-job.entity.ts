import { Column, Entity, JoinColumn, ManyToOne, OneToMany, Relation } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { SyncJobStatus, SyncJobType } from '../../common/entities/domain.enums.js';
import { Account } from '../accounts/account.entity.js';
import { SyncLog } from '../sync-logs/sync-log.entity.js';
import { Workspace } from '../workspaces/workspace.entity.js';

@Entity('sync_jobs')
export class SyncJob extends BaseEntity {
  @Column({ name: 'workspace_id' })
  workspaceId!: string;

  @Column({ name: 'account_id', type: 'text', nullable: true })
  accountId?: string | null;

  @Column({ type: 'enum', enum: SyncJobType })
  type!: SyncJobType;

  @Column({ name: 'entity_type' })
  entityType!: string;

  @Column({ name: 'entity_id' })
  entityId!: string;

  @Column({ type: 'enum', enum: SyncJobStatus, default: SyncJobStatus.PENDING })
  status!: SyncJobStatus;

  @Column({ name: 'queue_name', type: 'text', nullable: true })
  queueName?: string | null;

  @Column({ name: 'dedupe_key', type: 'text', nullable: true })
  dedupeKey?: string | null;

  @Column({ type: 'int', default: 0 })
  priority!: number;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ name: 'max_attempts', type: 'int', default: 5 })
  maxAttempts!: number;

  @Column({ type: 'jsonb', nullable: true })
  payload?: Record<string, unknown> | null;

  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt?: Date | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt?: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt?: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string | null;

  @ManyToOne(() => Workspace, (workspace) => workspace.syncJobs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Relation<Workspace>;

  @ManyToOne(() => Account, (account) => account.syncJobs, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'account_id' })
  account?: Relation<Account> | null;

  @OneToMany(() => SyncLog, (log) => log.syncJob)
  logs!: Relation<SyncLog[]>;
}
