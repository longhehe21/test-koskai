import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { uploadEncrypted, downloadDecrypted } from './storage.service.js';
import { findFileWithApplication, insertApplicationFile } from './document.repository.js';
import { findByIdForSession, findByIdForCitizen } from '../application/application.service.js';

export default async function documentRoute(app: FastifyInstance) {
  app.post(
    '/documents/upload',
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const auth = request.auth!;
      if (!auth.citizenId) return reply.code(403).send({ error: 'Session thiếu citizen' });

      let imageBuffer: Buffer | null = null;
      let applicationId: number | null = null;
      let docCode: string | null = null;
      let mimeType = 'image/jpeg';

      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'image') {
          imageBuffer = await part.toBuffer();
          mimeType = part.mimetype || mimeType;
        } else if (part.type === 'field') {
          if (part.fieldname === 'applicationId') applicationId = Number(part.value);
          else if (part.fieldname === 'docCode') docCode = String(part.value);
        }
      }

      if (!imageBuffer) return reply.code(400).send({ error: 'Missing image' });
      if (!applicationId || !Number.isInteger(applicationId)) return reply.code(400).send({ error: 'Missing applicationId' });
      if (!docCode) return reply.code(400).send({ error: 'Missing docCode' });

      let appRow = await findByIdForSession(applicationId, auth.sessionId);
      if (!appRow) appRow = await findByIdForCitizen(applicationId, auth.citizenId);
      if (!appRow) return reply.code(404).send({ error: 'Application not found' });

      let uploadResult;
      try {
        uploadResult = await uploadEncrypted({
          citizenId: auth.citizenId,
          applicationId,
          docCode,
          plaintext: imageBuffer,
          ext: mimeType.split('/')[1] ?? 'jpg',
        });
      } catch (err) {
        request.log.error({ err }, 'Upload MinIO failed');
        return reply.code(500).send({ error: 'Storage upload failed' });
      }

      const inserted = await insertApplicationFile({
        applicationId,
        documentCode: docCode,
        fileName: `${docCode}.${mimeType.split('/')[1] ?? 'jpg'}`,
        fileUrl: uploadResult.fileKey,
        mimeType,
        fileSize: uploadResult.size,
        checksum: uploadResult.checksum,
      });

      return reply.send({ id: inserted.id, fileKey: uploadResult.fileKey, checksum: uploadResult.checksum, size: uploadResult.size });
    },
  );

  app.get<{ Params: { id: string } }>(
    '/documents/:id',
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const auth = request.auth!;
      if (!auth.citizenId) return reply.code(403).send({ error: 'Session thiếu citizen' });

      const fileId = Number(request.params.id);
      if (!Number.isInteger(fileId) || fileId <= 0) return reply.code(400).send({ error: 'Invalid id' });

      const candidate = await findFileWithApplication(fileId);
      if (!candidate) return reply.code(404).send({ error: 'Not found' });

      const ownedBySession = candidate.sessionId === auth.sessionId;
      const ownedByCitizen = auth.citizenId !== null && candidate.citizenId === auth.citizenId;
      if (!ownedBySession && !ownedByCitizen) return reply.code(404).send({ error: 'Not found' });

      let plaintext: Buffer;
      try {
        plaintext = await downloadDecrypted({ fileKey: candidate.fileUrl, citizenId: auth.citizenId });
      } catch (err) {
        request.log.error({ err }, 'Decrypt failed');
        return reply.code(500).send({ error: 'Decrypt failed' });
      }

      const actualHash = createHash('sha256').update(plaintext).digest('hex');
      if (actualHash !== candidate.checksum) {
        request.log.warn({ fileId }, 'Checksum mismatch — possible tampering');
        return reply.code(500).send({ error: 'Integrity check failed' });
      }

      reply.header('Content-Type', candidate.mimeType);
      reply.header('Content-Length', candidate.fileSize);
      reply.header('Cache-Control', 'private, no-store');
      return reply.send(plaintext);
    },
  );
}
