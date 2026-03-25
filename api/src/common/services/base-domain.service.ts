import { Injectable } from '@nestjs/common';
import { BaseTypeOrmRepository } from '../repositories/base-typeorm.repository.js';

@Injectable()
export class BaseDomainService {
  constructor(
    protected readonly repository: BaseTypeOrmRepository<any>,
  ) {}

  async findAll() {
    return this.repository.findAll();
  }

  async findOne(id: string) {
    return this.repository.findOne(id);
  }

  async create(data: Record<string, unknown>) {
    return this.repository.create(data);
  }

  async update(id: string, data: Record<string, unknown>) {
    return this.repository.update(id, data);
  }

  async remove(id: string) {
    return this.repository.remove(id);
  }

  getMetadata() {
    return this.repository.getMetadata();
  }
}
