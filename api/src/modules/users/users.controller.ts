import { Controller } from '@nestjs/common';
import { BaseDomainController } from '../../common/controllers/base-domain.controller.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController extends BaseDomainController {
  constructor(usersService: UsersService) {
    super(usersService);
  }
}

