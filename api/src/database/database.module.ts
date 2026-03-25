import {Global, Module} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {TypeOrmModule} from '@nestjs/typeorm';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_DATABASE ?? 'eselink',
      ssl: { rejectUnauthorized: false },
      autoLoadEntities: true,
      synchronize: true,
      useUTC: true,
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {
}
