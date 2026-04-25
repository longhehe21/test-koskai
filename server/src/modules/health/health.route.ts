import type { FastifyInstance } from 'fastify';

export default async function healthRoute(app: FastifyInstance) {
  app.get(
    '/health',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
    },
  );
}
