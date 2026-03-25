import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity.js';
import { PlatformCode } from '../../common/entities/domain.enums.js';
import { Account } from './account.entity.js';

@Entity('channels')
export class Channel extends BaseEntity {
  @Column()
  name!: string;

  @Column({ type: 'enum', enum: PlatformCode })
  type!: PlatformCode;

  @OneToMany(() => Account, (account) => account.channel)
  accounts!: Account[];
}
