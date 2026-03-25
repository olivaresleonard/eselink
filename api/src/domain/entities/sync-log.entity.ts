import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { SyncJob } from './sync-job.entity.js';

@Entity('sync_logs')
export class SyncLog extends BaseEntity {
  @Column({ name: 'job_id', nullable: true })
  jobId?: string | null;

  @Column()
  action!: string;

  @Column()
  status!: string;

  @Column()
  message!: string;

  @ManyToOne(() => SyncJob, (syncJob) => syncJob.logs, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'job_id' })
  job?: SyncJob | null;
}
