import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { SyncJobStatus, SyncJobType } from '../../common/entities/domain.enums.js';
import { SyncLog } from './sync-log.entity.js';

@Entity('sync_jobs')
export class SyncJob extends BaseEntity {
  @Column({ type: 'enum', enum: SyncJobType })
  type!: SyncJobType;

  @Column({ name: 'entity_type' })
  entityType!: string;

  @Column({ name: 'entity_id' })
  entityId!: string;

  @Column({ type: 'enum', enum: SyncJobStatus, default: SyncJobStatus.PENDING })
  status!: SyncJobStatus;

  @Column({ type: 'jsonb', nullable: true })
  payload?: Record<string, unknown> | null;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @OneToMany(() => SyncLog, (syncLog) => syncLog.job)
  logs!: SyncLog[];
}
