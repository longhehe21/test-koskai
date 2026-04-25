import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';

export default fp(async function swaggerPlugin(app: FastifyInstance) {
  if (env.NODE_ENV === 'production') return;

  const { default: swagger } = await import('@fastify/swagger');
  const { default: swaggerUi } = await import('@fastify/swagger-ui');

  await app.register(swagger, {
    openapi: {
      info: { title: 'KioskAI API', version: '1.0.0' },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer' },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list' },
  });
}, { name: 'swagger' });
