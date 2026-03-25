import { Column, Entity, OneToMany, Relation } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { AuditEntry } from '../audit/audit-entry.entity.js';
import { OrderAssignment } from '../order-assignments/order-assignment.entity.js';
import { OrderComment } from '../order-comments/order-comment.entity.js';
import { WorkspaceUser } from '../workspace-users/workspace-user.entity.js';

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  email!: string;

  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column({ name: 'first_name', type: 'text', nullable: true })
  firstName?: string | null;

  @Column({ name: 'last_name', type: 'text', nullable: true })
  lastName?: string | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'refresh_token', type: 'text', nullable: true })
  refreshToken?: string | null;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt?: Date | null;

  @OneToMany(() => WorkspaceUser, (workspaceUser) => workspaceUser.user)
  workspaceUsers!: Relation<WorkspaceUser[]>;

  @OneToMany(() => OrderAssignment, (assignment) => assignment.user)
  orderAssignments!: Relation<OrderAssignment[]>;

  @OneToMany(() => OrderComment, (comment) => comment.user)
  orderComments!: Relation<OrderComment[]>;

  @OneToMany(() => AuditEntry, (auditEntry) => auditEntry.user)
  auditEntries!: Relation<AuditEntry[]>;
}
