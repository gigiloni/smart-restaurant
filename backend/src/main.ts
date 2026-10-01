import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from './app/app.module.js';
import { configureApp } from './app/configure-app.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  const configService = app.get(ConfigService);

  const port = configService.get<number>('app.port') ?? 3000;

  configureApp(app);

  await app.listen({
    port,
    host: '0.0.0.0',
  });
}

await bootstrap();
