import { Column, Entity, JoinColumn, ManyToOne, Relation } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { Workspace } from '../workspaces/workspace.entity.js';

@Entity('reports')
export class Report extends BaseEntity {
  @Column({ name: 'workspace_id' })
  workspaceId!: string;

  @Column()
  name!: string;

  @Column()
  type!: string;

  @Column({ default: 'draft' })
  status!: string;

  @Column({ type: 'jsonb', nullable: true })
  filters?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  result?: Record<string, unknown> | null;

  @ManyToOne(() => Workspace, (workspace) => workspace.reports, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Relation<Workspace>;
}
