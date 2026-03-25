import { Injectable } from '@nestjs/common';
import { BaseDomainService } from '../../common/services/base-domain.service.js';
import { UsersRepository } from './users.repository.js';

@Injectable()
export class UsersService extends BaseDomainService {
  constructor(repository: UsersRepository) {
    super(repository);
  }
}
