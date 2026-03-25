import { Controller } from '@nestjs/common';
import { BaseDomainController } from '../../common/controllers/base-domain.controller.js';
import { ChannelsService } from './channels.service.js';

@Controller('channels')
export class ChannelsController extends BaseDomainController {
  constructor(channelsService: ChannelsService) {
    super(channelsService);
  }
}

