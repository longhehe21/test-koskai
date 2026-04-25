import type { FastifyInstance } from 'fastify';
import { classifyScannedDocument } from './scan.service.js';

export default async function scanRoute(app: FastifyInstance) {
  app.post('/scan/classify', { preHandler: [app.requireAuth] }, async (request, reply) => {
    const parts = request.parts();
    let imageBuffer: Buffer | null = null;
    let procedureCode: string | null = null;

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'image') {
        imageBuffer = await part.toBuffer();
      } else if (part.type === 'field' && part.fieldname === 'procedureCode') {
        procedureCode = String(part.value);
      }
    }

    if (!imageBuffer) return reply.code(400).send({ error: 'Missing "image" file field' });
    if (!procedureCode) return reply.code(400).send({ error: 'Missing "procedureCode" field' });

    try {
      const result = await classifyScannedDocument({ imageBuffer, procedureCode });
      return reply.send(result);
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 422) {
        return reply.code(statusCode).send({ error: (err as Error).message });
      }
      request.log.error({ err }, 'OCR/classify failed');
      return reply.code(500).send({ error: 'OCR extraction failed' });
    }
  });
}
