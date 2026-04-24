/**
 * Auth plugin — decorate request với citizenId/sessionId/kioskId.
 *
 * Cách dùng:
 *   app.get('/protected', { preHandler: [app.requireAuth] }, async (req) => {
 *     return { citizenId: req.auth.citizenId };
 *   });
 *
 * Header client cần gửi: `Authorization: Bearer {sessionToken}`
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { validateSession, type ValidatedSession } from '../services/session.service.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: ValidatedSession;
  }
  interface FastifyInstance {
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

async function authPlugin(app: FastifyInstance) {
  app.decorate(
    'requireAuth',
    async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'Missing bearer token' });
      }
      const token = header.slice(7).trim();
      const session = await validateSession(token);
      if (!session) {
        return reply.code(401).send({ error: 'Invalid or expired session' });
      }
      req.auth = session;
    },
  );
}

export default fp(authPlugin, { name: 'auth' });
