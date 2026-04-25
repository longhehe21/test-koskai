import type { FastifyInstance } from 'fastify';
import { createSession } from './session.service.js';
import {
  createSessionBodySchema,
  createSessionResponseSchema,
  sessionMeResponseSchema,
} from './session.schema.js';

interface CreateSessionBody {
  cccd?: string;
  loginMethod?: 'cccd_nfc' | 'vneid' | 'qr' | 'guest';
  identityVerified?: boolean;
}

export default async function sessionRoute(app: FastifyInstance) {
  app.get(
    '/sessions/me',
    {
      preHandler: [app.requireAuth],
      schema: { response: { 200: sessionMeResponseSchema } },
    },
    async (request) => {
      const { sessionId, citizenId, kioskId } = request.auth!;
      return { sessionId, citizenId, kioskId };
    },
  );

  app.post<{ Body: CreateSessionBody }>(
    '/sessions/create',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        body: createSessionBodySchema,
        response: { 200: createSessionResponseSchema },
      },
    },
    async (request, reply) => {
      const { cccd, loginMethod = 'cccd_nfc', identityVerified = false } = request.body ?? {};

      if (!cccd || !/^\d{12}$/.test(cccd)) {
        return reply.code(400).send({ error: 'cccd phải là 12 chữ số' });
      }

      try {
        const result = await createSession({ cccdNumber: cccd, loginMethod, identityVerified });
        return reply.send(result);
      } catch (err) {
        request.log.error({ err }, 'Create session failed');
        return reply.code(500).send({ error: 'Tạo phiên thất bại' });
      }
    },
  );
}
