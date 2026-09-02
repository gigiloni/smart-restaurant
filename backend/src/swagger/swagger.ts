import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type SwaggerDocumentOptions,
} from '@nestjs/swagger';
import { createSchema } from 'zod-openapi';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Smart Restaurant API')
    .setDescription('REST API for the Smart Restaurant project')
    .setVersion('1.0.0')
    .build();

  const documentOptions: SwaggerDocumentOptions = {
    standardSchemaConverter: (schema, { schemaType }) => {
      const converted = createSchema(schema as never, {
        io: schemaType,
        openapiVersion: '3.0.0',
      });

      return {
        schema: converted.schema,
        components: converted.components,
      };
    },
  };

  const document = SwaggerModule.createDocument(
    app,
    config,
    documentOptions,
  );

  SwaggerModule.setup(
    'api/docs',
    app,
    document,
  );
}
