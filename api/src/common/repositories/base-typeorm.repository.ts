import { Injectable, NotFoundException } from '@nestjs/common';
import { DeepPartial, Repository } from 'typeorm';

@Injectable()
export class BaseTypeOrmRepository<TEntity extends { id: string }> {
  constructor(
    protected readonly repository: Repository<TEntity>,
    private readonly resource: string,
  ) {}

  findAll() {
    return this.repository.find({
      take: 100,
      order: { createdAt: 'DESC' } as never,
    });
  }

  async findOne(id: string) {
    const item = await this.repository.findOne({
      where: { id } as never,
    });

    if (!item) {
      throw new NotFoundException(`${this.resource} ${id} not found`);
    }

    return item;
  }

  async create(data: DeepPartial<TEntity>) {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async update(id: string, data: DeepPartial<TEntity>) {
    const entity = await this.findOne(id);
    const merged = this.repository.merge(entity, data);
    return this.repository.save(merged);
  }

  async remove(id: string) {
    const entity = await this.findOne(id);
    await this.repository.remove(entity);
    return { deleted: true, id };
  }

  getMetadata() {
    return {
      resource: this.resource,
      capabilities: ['findAll', 'findOne', 'create', 'update', 'remove'],
    };
  }
}
