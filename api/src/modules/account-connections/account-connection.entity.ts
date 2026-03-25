import { Column, Entity, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { ConnectionStatus } from '../../common/entities/domain.enums.js';
import { Account } from '../accounts/account.entity.js';
import { Workspace } from '../workspaces/workspace.entity.js';

@Entity('account_connections')
export class AccountConnection extends BaseEntity {
  @Column({ name: 'workspace_id' })
  workspaceId!: string;

  @Column({ name: 'account_id' })
  accountId!: string;

  @Column({ type: 'enum', enum: ConnectionStatus, default: ConnectionStatus.PENDING })
  status!: ConnectionStatus;

  @Column({ name: 'auth_type', type: 'text', nullable: true })
  authType?: string | null;

  @Column({ name: 'access_token', type: 'text', nullable: true })
  accessToken?: string | null;

  @Column({ name: 'refresh_token', type: 'text', nullable: true })
  refreshToken?: string | null;

  @Column({ name: 'token_type', type: 'text', nullable: true })
  tokenType?: string | null;

  @Column('text', { array: true, default: [] })
  scopes!: string[];

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date | null;

  @Column({ name: 'last_validated_at', type: 'timestamptz', nullable: true })
  lastValidatedAt?: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @ManyToOne(() => Workspace, (workspace) => workspace.accountConnections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Relation<Workspace>;

  @ManyToOne(() => Account, (account) => account.connections, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account!: Relation<Account>;
}
