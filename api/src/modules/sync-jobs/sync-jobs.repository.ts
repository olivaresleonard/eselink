import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { BaseTypeOrmRepository } from '../../common/repositories/base-typeorm.repository.js';
import { SyncJob } from './sync-job.entity.js';

@Injectable()
export class SyncJobsRepository extends BaseTypeOrmRepository<SyncJob> {
  constructor(
    @InjectRepository(SyncJob)
    private readonly syncJobsOrmRepository: Repository<SyncJob>,
  ) {
    super(syncJobsOrmRepository, 'sync-jobs');
  }

  override findAll() {
    return this.syncJobsOrmRepository.find({
      relations: {
        logs: true,
      },
      take: 100,
      order: { createdAt: 'DESC' },
    });
  }

  findTrackedJobOrFail(id: string) {
    return this.findOne(id);
  }

  async updateTrackedJob(id: string, data: DeepPartial<SyncJob>) {
    const job = await this.findOne(id);
    const merged = this.syncJobsOrmRepository.merge(job, data);
    return this.syncJobsOrmRepository.save(merged);
  }
}
