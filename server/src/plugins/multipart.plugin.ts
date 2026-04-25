import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';

export default fp(async function multipartPlugin(app: FastifyInstance) {
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  });
}, { name: 'multipart' });
