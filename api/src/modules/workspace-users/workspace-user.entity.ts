import { Column, Entity, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { WorkspaceUserRole } from '../../common/entities/domain.enums.js';
import { User } from '../users/user.entity.js';
import { Workspace } from '../workspaces/workspace.entity.js';

@Entity('workspace_users')
export class WorkspaceUser extends BaseEntity {
  @Column({ name: 'workspace_id' })
  workspaceId!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({
    type: 'enum',
    enum: WorkspaceUserRole,
    default: WorkspaceUserRole.OPERATOR,
  })
  role!: WorkspaceUserRole;

  @Column({ name: 'invited_at', type: 'timestamptz', nullable: true })
  invitedAt?: Date | null;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt?: Date | null;

  @ManyToOne(() => Workspace, (workspace) => workspace.workspaceUsers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Relation<Workspace>;

  @ManyToOne(() => User, (user) => user.workspaceUsers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;
}
