import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTypeOrmRepository } from '../../common/repositories/base-typeorm.repository.js';
import { Report } from './report.entity.js';

@Injectable()
export class ReportsRepository extends BaseTypeOrmRepository<Report> {
  constructor(@InjectRepository(Report) repository: Repository<Report>) {
    super(repository, 'reports');
  }
}
