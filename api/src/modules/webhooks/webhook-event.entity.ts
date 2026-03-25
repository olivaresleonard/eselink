import { Column, Entity, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { PlatformCode, WebhookStatus } from '../../common/entities/domain.enums.js';
import { Account } from '../accounts/account.entity.js';
import { Workspace } from '../workspaces/workspace.entity.js';

@Entity('webhook_events')
export class WebhookEvent extends BaseEntity {
  @Column({ name: 'workspace_id' })
  workspaceId!: string;

  @Column({ name: 'account_id', type: 'text', nullable: true })
  accountId?: string | null;

  @Column({ type: 'enum', enum: PlatformCode })
  platform!: PlatformCode;

  @Column()
  topic!: string;

  @Column({ name: 'event_key', type: 'text', nullable: true })
  eventKey?: string | null;

  @Column({ name: 'external_id', type: 'text', nullable: true })
  externalId?: string | null;

  @Column({ type: 'enum', enum: WebhookStatus, default: WebhookStatus.PENDING })
  status!: WebhookStatus;

  @Column({ type: 'text', nullable: true })
  signature?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  headers?: Record<string, unknown> | null;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ name: 'received_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  receivedAt!: Date;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt?: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string | null;

  @ManyToOne(() => Workspace, (workspace) => workspace.webhookEvents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Relation<Workspace>;

  @ManyToOne(() => Account, (account) => account.webhookEvents, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'account_id' })
  account?: Relation<Account> | null;
}
