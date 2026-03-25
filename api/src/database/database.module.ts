import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: Number(configService.get<string>('DB_PORT', '5432')),
        username: configService.get<string>(
          'DB_USER',
          configService.get<string>('POSTGRES_USER', 'postgres'),
        ),
        password: configService.get<string>(
          'DB_PASSWORD',
          configService.get<string>('POSTGRES_PASSWORD', 'postgres'),
        ),
        database: configService.get<string>(
          'DB_NAME',
          configService.get<string>('POSTGRES_DB', 'eselink'),
        ),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
