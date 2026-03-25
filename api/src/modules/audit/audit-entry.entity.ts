import { Column, Entity, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { User } from '../users/user.entity.js';
import { Workspace } from '../workspaces/workspace.entity.js';

@Entity('audit_entries')
export class AuditEntry extends BaseEntity {
  @Column({ name: 'workspace_id' })
  workspaceId!: string;

  @Column({ name: 'user_id', type: 'text', nullable: true })
  userId?: string | null;

  @Column({ type: 'text', nullable: true })
  module?: string | null;

  @Column()
  action!: string;

  @Column({ name: 'entity_type' })
  entityType!: string;

  @Column({ name: 'entity_id' })
  entityId!: string;

  @Column({ name: 'ip_address', type: 'text', nullable: true })
  ipAddress?: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload?: Record<string, unknown> | null;

  @ManyToOne(() => Workspace, (workspace) => workspace.auditEntries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Relation<Workspace>;

  @ManyToOne(() => User, (user) => user.auditEntries, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'user_id' })
  user?: Relation<User> | null;
}
