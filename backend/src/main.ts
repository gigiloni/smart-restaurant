import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';

import { AppModule } from './app/app.module.js';
import { setupSwagger } from './swagger/swagger.js';

async function bootstrap(): Promise<void> {
  const app =
    await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
    );

  const configService = app.get(ConfigService);

  const port =
    configService.get<number>('app.port') ?? 3000;

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new StandardSchemaValidationPipe({
      transform: true,
    }),
  );

  setupSwagger(app);

  await app.listen({
    port,
    host: '0.0.0.0',
  });
}

await bootstrap();
