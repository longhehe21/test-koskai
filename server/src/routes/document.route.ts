/**
 * Documents route — upload/download ảnh scan đã mã hoá.
 *
 *  POST /documents/upload  — multipart {image, applicationId, docCode}
 *                            → encrypt → MinIO → insert application_files row
 *                            → return {id, fileKey, checksum, size}
 *
 *  GET  /documents/:id     — verify ownership → download + decrypt → stream JPEG
 *
 * Protected: yêu cầu Bearer token. citizenId phải match application.
 */
import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { applicationFiles, applications } from '../db/schema.js';
import {
  uploadEncrypted,
  downloadDecrypted,
} from '../services/storage.service.js';
import {
  findByIdForCitizen,
  findByIdForSession,
} from '../services/application.service.js';

export default async function documentRoute(app: FastifyInstance) {
  // ---------- UPLOAD ----------
  app.post(
    '/documents/upload',
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const auth = request.auth!;
      if (!auth.citizenId) {
        return reply.code(403).send({ error: 'Session thiếu citizen' });
      }

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
          if (part.fieldname === 'applicationId') {
            applicationId = Number(part.value);
          } else if (part.fieldname === 'docCode') {
            docCode = String(part.value);
          }
        }
      }

      if (!imageBuffer) return reply.code(400).send({ error: 'Missing image' });
      if (!applicationId || !Number.isInteger(applicationId)) {
        return reply.code(400).send({ error: 'Missing applicationId' });
      }
      if (!docCode) return reply.code(400).send({ error: 'Missing docCode' });

      // Verify ownership: session hiện tại hoặc citizen cùng token.
      // Cross-session cần thiết khi resume draft: appId tạo ở session cũ,
      // user quét CCCD lại → session mới nhưng cùng citizen.
      let appRow = await findByIdForSession(applicationId, auth.sessionId);
      if (!appRow) {
        appRow = await findByIdForCitizen(applicationId, auth.citizenId);
      }
      if (!appRow) {
        return reply.code(404).send({ error: 'Application not found' });
      }

      // Encrypt + upload MinIO
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

      // Insert DB row
      const [inserted] = await db
        .insert(applicationFiles)
        .values({
          applicationId,
          documentCode: docCode,
          fileName: `${docCode}.${mimeType.split('/')[1] ?? 'jpg'}`,
          fileUrl: uploadResult.fileKey, // MinIO key
          fileType: 'image',
          mimeType,
          fileSize: uploadResult.size,
          checksum: uploadResult.checksum,
          ocrEncrypted: true, // default, OCR text chưa lưu ở Phase này
        })
        .returning({ id: applicationFiles.id });

      if (!inserted) {
        return reply.code(500).send({ error: 'DB insert failed' });
      }

      return reply.send({
        id: inserted.id,
        fileKey: uploadResult.fileKey,
        checksum: uploadResult.checksum,
        size: uploadResult.size,
      });
    },
  );

  // ---------- DOWNLOAD ----------
  app.get<{ Params: { id: string } }>(
    '/documents/:id',
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const auth = request.auth!;
      if (!auth.citizenId) {
        return reply.code(403).send({ error: 'Session thiếu citizen' });
      }

      const fileId = Number(request.params.id);
      if (!Number.isInteger(fileId) || fileId <= 0) {
        return reply.code(400).send({ error: 'Invalid id' });
      }

      // Join file → application để check ownership.
      // Cross-session: chấp nhận session hiện tại HOẶC citizen của token —
      // cho resume draft sau khi đóng kiosk + quét CCCD lại.
      const rows = await db
        .select({
          fileUrl: applicationFiles.fileUrl,
          mimeType: applicationFiles.mimeType,
          checksum: applicationFiles.checksum,
          fileSize: applicationFiles.fileSize,
          applicationId: applicationFiles.applicationId,
          sessionId: applications.sessionId,
          citizenId: applications.citizenId,
        })
        .from(applicationFiles)
        .innerJoin(
          applications,
          eq(applications.id, applicationFiles.applicationId),
        )
        .where(eq(applicationFiles.id, fileId))
        .limit(1);

      const candidate = rows[0];
      if (candidate) {
        const ownedBySession = candidate.sessionId === auth.sessionId;
        const ownedByCitizen =
          auth.citizenId !== null && candidate.citizenId === auth.citizenId;
        if (!ownedBySession && !ownedByCitizen) {
          return reply.code(404).send({ error: 'Not found' });
        }
      }

      const row = rows[0];
      if (!row) return reply.code(404).send({ error: 'Not found' });

      let plaintext: Buffer;
      try {
        plaintext = await downloadDecrypted({
          fileKey: row.fileUrl,
          citizenId: auth.citizenId,
        });
      } catch (err) {
        request.log.error({ err }, 'Decrypt failed');
        return reply.code(500).send({ error: 'Decrypt failed' });
      }

      // Verify checksum trước khi trả (integrity check)
      const actualHash = createHash('sha256').update(plaintext).digest('hex');
      if (actualHash !== row.checksum) {
        request.log.warn({ fileId }, 'Checksum mismatch — possible tampering');
        return reply.code(500).send({ error: 'Integrity check failed' });
      }

      reply.header('Content-Type', row.mimeType);
      reply.header('Content-Length', row.fileSize);
      reply.header('Cache-Control', 'private, no-store');
      return reply.send(plaintext);
    },
  );
}
