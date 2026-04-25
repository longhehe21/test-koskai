import type { FastifyInstance } from 'fastify';
import { eq, asc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { sessionMessages } from '../../db/schema.js';

interface SaveMessageBody {
  senderType?: string;
  messageType?: string;
  messageContent?: string;
}

export default async function sessionMessagesRoute(app: FastifyInstance) {
  app.post<{ Body: SaveMessageBody }>(
    '/session-messages',
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const { senderType = 'user', messageType = 'voice', messageContent } = request.body ?? {};

      if (!messageContent?.trim()) return reply.code(400).send({ error: 'Missing messageContent' });
      if (!['user', 'ai', 'system'].includes(senderType)) {
        return reply.code(400).send({ error: 'Invalid senderType' });
      }

      const [inserted] = await db
        .insert(sessionMessages)
        .values({ sessionId: request.auth!.sessionId, senderType, messageType, messageContent: messageContent.trim() })
        .returning({ id: sessionMessages.id, createdAt: sessionMessages.createdAt });

      return reply.code(201).send(inserted);
    },
  );

  app.get(
    '/session-messages',
    { preHandler: [app.requireAuth] },
    async (request) => {
      return db
        .select({
          id: sessionMessages.id,
          senderType: sessionMessages.senderType,
          messageType: sessionMessages.messageType,
          messageContent: sessionMessages.messageContent,
          createdAt: sessionMessages.createdAt,
        })
        .from(sessionMessages)
        .where(eq(sessionMessages.sessionId, request.auth!.sessionId))
        .orderBy(asc(sessionMessages.createdAt));
    },
  );
}
