import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTypeOrmRepository } from '../../common/repositories/base-typeorm.repository.js';
import { Channel } from './channel.entity.js';

@Injectable()
export class ChannelsRepository extends BaseTypeOrmRepository<Channel> {
  constructor(@InjectRepository(Channel) repository: Repository<Channel>) {
    super(repository, 'channels');
  }
}
