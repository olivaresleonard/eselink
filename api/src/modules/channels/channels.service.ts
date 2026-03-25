import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseDomainService } from '../../common/services/base-domain.service.js';
import { OperationContextService } from '../../core/operation-context/operation-context.service.js';
import type { CreateChannelDto } from './dto/create-channel.dto.js';
import { Channel } from './channel.entity.js';
import { ChannelsRepository } from './channels.repository.js';

@Injectable()
export class ChannelsService extends BaseDomainService {
  constructor(
    repository: ChannelsRepository,
    @InjectRepository(Channel)
    private readonly channelsOrmRepository: Repository<Channel>,
    private readonly operationContextService: OperationContextService,
  ) {
    super(repository);
  }

  async create(data: Record<string, unknown>) {
    const dto = data as unknown as CreateChannelDto;
    const workspaceId =
      dto.workspaceId ?? (await this.operationContextService.getDefaultWorkspaceId());

    return this.channelsOrmRepository.save(
      this.channelsOrmRepository.create({
        workspaceId,
        name: dto.name,
        code: dto.code,
      }),
    );
  }

  async findAll() {
    const channels = await this.channelsOrmRepository.find({
      order: { name: 'ASC' },
    });

    return channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      countryCode: channel.countryCode ?? null,
      type: channel.code,
    }));
  }
}
