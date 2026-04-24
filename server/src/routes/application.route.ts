/**
 * Applications route — tạo/update/list drafts, support resume cross-session.
 *
 *  POST   /applications                 — body {procedureCode} → tạo/lấy draft
 *  PATCH  /applications/:id             — body {formData}     → cập nhật formDataJson (lưu nháp)
 *  DELETE /applications/:id             — soft-delete draft (chỉ draft chưa submit)
 *  GET    /applications/me              — list drafts session hiện tại
 *  GET    /applications/me/by-citizen   — list tất cả applications của citizen (resume)
 *  GET    /applications/:id             — detail + formDataJson (cho load draft)
 *  GET    /applications/:id/files       — list ảnh đã upload cho application (resume)
 */
import type { FastifyInstance } from 'fastify';
import {
  createDraft,
  findByIdForSession,
  findByIdForCitizen,
  listDraftsBySession,
  listByCitizen,
  softDeleteDraft,
  submitDraft,
  updateFormData,
} from '../services/application.service.js';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { applicationFiles, procedures, statuses } from '../db/schema.js';

interface CreateDraftBody {
  procedureCode?: string;
}

interface UpdateFormDataBody {
  formData?: Record<string, unknown>;
}

export default async function applicationRoute(app: FastifyInstance) {
  app.post<{ Body: CreateDraftBody }>(
    '/applications',
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const { procedureCode } = request.body ?? {};
      if (!procedureCode) {
        return reply.code(400).send({ error: 'Missing procedureCode' });
      }
      try {
        const draft = await createDraft({
          sessionId: request.auth!.sessionId,
          citizenId: request.auth!.citizenId,
          procedureCode,
        });
        return reply.send({
          id: draft.id,
          trackingCode: draft.trackingCode,
          procedureId: draft.procedureId,
          formVersion: draft.formVersion,
          draftExpiresAt: draft.draftExpiresAt,
        });
      } catch (err) {
        request.log.error({ err }, 'createDraft failed');
        return reply.code(400).send({ error: (err as Error).message });
      }
    },
  );

  // PATCH — lưu nháp form data
  app.patch<{ Params: { id: string }; Body: UpdateFormDataBody }>(
    '/applications/:id',
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const appId = Number(request.params.id);
      if (!Number.isInteger(appId) || appId <= 0) {
        return reply.code(400).send({ error: 'Invalid id' });
      }
      const { formData } = request.body ?? {};
      if (!formData || typeof formData !== 'object') {
        return reply.code(400).send({ error: 'Missing formData' });
      }
      const updated = await updateFormData({
        appId,
        sessionId: request.auth!.sessionId,
        citizenId: request.auth!.citizenId,
        formData,
      });
      if (!updated) return reply.code(404).send({ error: 'Not found or forbidden' });
      return reply.send({ id: updated.id, updatedAt: updated.updatedAt });
    },
  );

  // POST — submit draft → chuyển status 'draft' → 'submitted'
  app.post<{ Params: { id: string } }>(
    '/applications/:id/submit',
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const appId = Number(request.params.id);
      if (!Number.isInteger(appId) || appId <= 0) {
        return reply.code(400).send({ error: 'Invalid id' });
      }
      const updated = await submitDraft({
        appId,
        citizenId: request.auth!.citizenId,
      });
      if (!updated) {
        return reply.code(409).send({ error: 'Not found, not owner, or already submitted' });
      }
      return reply.send({
        id: updated.id,
        statusId: updated.statusId,
        submittedAt: updated.submittedAt,
      });
    },
  );

  // DELETE — soft-delete draft (chỉ owner + chưa submit)
  app.delete<{ Params: { id: string } }>(
    '/applications/:id',
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const appId = Number(request.params.id);
      if (!Number.isInteger(appId) || appId <= 0) {
        return reply.code(400).send({ error: 'Invalid id' });
      }
      const ok = await softDeleteDraft({
        appId,
        citizenId: request.auth!.citizenId,
      });
      if (!ok) {
        return reply.code(404).send({ error: 'Not found, already deleted, or cannot delete submitted application' });
      }
      return reply.code(204).send();
    },
  );

  // Draft của session hiện tại
  app.get(
    '/applications/me',
    { preHandler: [app.requireAuth] },
    async (request) => {
      const list = await listDraftsBySession(request.auth!.sessionId);
      return list.map((a) => ({
        id: a.id,
        trackingCode: a.trackingCode,
        procedureId: a.procedureId,
        statusId: a.statusId,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        draftExpiresAt: a.draftExpiresAt,
      }));
    },
  );

  // Toàn bộ applications của citizen (cross-session) — cho HoSoCuaToiPage
  app.get(
    '/applications/me/by-citizen',
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const citizenId = request.auth!.citizenId;
      if (!citizenId) return reply.send([]);

      const list = await listByCitizen(citizenId);

      // Enrich: lookup procedure name + status code/name
      const procRows = await db.select().from(procedures);
      const statusRows = await db.select().from(statuses);
      const procMap = new Map(procRows.map((p) => [p.id, p]));
      const statusMap = new Map(statusRows.map((s) => [s.id, s]));

      return list.map((a) => {
        const p = procMap.get(a.procedureId);
        const s = statusMap.get(a.statusId);
        return {
          id: a.id,
          trackingCode: a.trackingCode,
          procedureId: a.procedureId,
          procedureCode: p?.code ?? '',
          procedureName: p?.name ?? '',
          statusId: a.statusId,
          statusCode: s?.code ?? '',
          statusName: s?.name ?? '',
          statusColor: s?.color ?? '',
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
          submittedAt: a.submittedAt,
          draftExpiresAt: a.draftExpiresAt,
        };
      });
    },
  );

  // List files đã upload cho application (cho resume — FE fetch lại ảnh đã scan)
  app.get<{ Params: { id: string } }>(
    '/applications/:id/files',
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const appId = Number(request.params.id);
      if (!Number.isInteger(appId) || appId <= 0) {
        return reply.code(400).send({ error: 'Invalid id' });
      }
      // Verify ownership (session hoặc citizen — resume cross-session)
      let found = await findByIdForSession(appId, request.auth!.sessionId);
      if (!found) {
        found = await findByIdForCitizen(appId, request.auth!.citizenId);
      }
      if (!found) return reply.code(404).send({ error: 'Not found' });

      const files = await db
        .select({
          id: applicationFiles.id,
          documentCode: applicationFiles.documentCode,
          fileName: applicationFiles.fileName,
          mimeType: applicationFiles.mimeType,
          fileSize: applicationFiles.fileSize,
          uploadedAt: applicationFiles.uploadedAt,
        })
        .from(applicationFiles)
        .where(eq(applicationFiles.applicationId, appId));

      return files;
    },
  );

  // Detail + formDataJson → cho load draft resume
  app.get<{ Params: { id: string } }>(
    '/applications/:id',
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const appId = Number(request.params.id);
      if (!Number.isInteger(appId) || appId <= 0) {
        return reply.code(400).send({ error: 'Invalid id' });
      }
      // Try by session first, fallback to citizen (resume cross-session)
      let found = await findByIdForSession(appId, request.auth!.sessionId);
      if (!found) {
        found = await findByIdForCitizen(appId, request.auth!.citizenId);
      }
      if (!found) return reply.code(404).send({ error: 'Not found' });

      // Lookup procedure code
      const procRow = await db
        .select({ code: procedures.code, name: procedures.name })
        .from(procedures)
        .where(eq(procedures.id, found.procedureId))
        .limit(1);

      return {
        id: found.id,
        trackingCode: found.trackingCode,
        procedureId: found.procedureId,
        procedureCode: procRow[0]?.code ?? '',
        procedureName: procRow[0]?.name ?? '',
        statusId: found.statusId,
        formVersion: found.formVersion,
        formDataJson: found.formDataJson,
        createdAt: found.createdAt,
        updatedAt: found.updatedAt,
        submittedAt: found.submittedAt,
        draftExpiresAt: found.draftExpiresAt,
      };
    },
  );
}
