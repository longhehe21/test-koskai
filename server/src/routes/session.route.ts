/**
 * POST /sessions/create
 *
 * Tạo phiên kiosk sau khi user xác thực CCCD + face match.
 *
 * Body:
 *  - cccd: string (12 chữ số)
 *  - loginMethod: 'cccd_nfc' | 'vneid' | 'qr' | 'guest' (default 'cccd_nfc')
 *  - identityVerified: boolean (true nếu đã pass face match)
 *
 * Return:
 *  - sessionToken: string — bearer để client gửi ở request tiếp theo
 *  - sessionId: number
 *  - citizenId: number
 *  - isNewCitizen: boolean — true nếu lần đầu user dùng kiosk
 *
 * Errors:
 *  - 400: cccd không hợp lệ
 *  - 500: DB error
 */
import type { FastifyInstance } from 'fastify';
import { createSession } from '../services/session.service.js';

interface CreateSessionBody {
  cccd?: string;
  loginMethod?: 'cccd_nfc' | 'vneid' | 'qr' | 'guest';
  identityVerified?: boolean;
}

export default async function sessionRoute(app: FastifyInstance) {
  // GET /sessions/me — validate bearer token, trả thông tin session hiện tại
  app.get(
    '/sessions/me',
    { preHandler: [app.requireAuth] },
    async (request) => {
      const { sessionId, citizenId, kioskId } = request.auth!;
      return { sessionId, citizenId, kioskId };
    },
  );

  app.post<{ Body: CreateSessionBody }>('/sessions/create', async (request, reply) => {
    const { cccd, loginMethod = 'cccd_nfc', identityVerified = false } = request.body ?? {};

    if (!cccd || !/^\d{12}$/.test(cccd)) {
      return reply.code(400).send({ error: 'cccd phải là 12 chữ số' });
    }

    try {
      const result = await createSession({
        cccdNumber: cccd,
        loginMethod,
        identityVerified,
      });
      return reply.send(result);
    } catch (err) {
      request.log.error({ err }, 'Create session failed');
      return reply.code(500).send({ error: 'Tạo phiên thất bại' });
    }
  });
}
