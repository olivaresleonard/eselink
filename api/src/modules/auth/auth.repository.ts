import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity.js';

@Injectable()
export class AuthRepository {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findUserByEmail(email: string) {
    return this.usersRepository.findOne({
      where: { email },
      relations: { workspaceUsers: true },
    });
  }

  findUserById(id: string) {
    return this.usersRepository.findOne({
      where: { id },
    });
  }

  updateRefreshToken(id: string, refreshToken: string) {
    return this.usersRepository.update({ id }, { refreshToken });
  }
}
