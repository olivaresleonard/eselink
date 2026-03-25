import {Global, Module} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {ConfigService} from '@nestjs/config';
import {TypeOrmModule} from '@nestjs/typeorm';

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: Number(configService.get<string>('DB_PORT', '5432')),
        username: configService.get<string>(
          'DB_USERNAME', 'postgres'
        ),
        password: configService.get<string>(
          'DB_PASSWORD', 'postgres'
        ),
        database: configService.get<string>(
          'DB_DATABASE', 'eselink'
        ),
        ssl: configService.get<string>('DB_SSL', 'false') === 'true',
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {
}
