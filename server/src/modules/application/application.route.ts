import type { FastifyInstance } from 'fastify';
import {
  createDraft,
  findByIdWithOwnership,
  listDraftsBySession,
  listByCitizen,
  softDeleteDraft,
  submitDraft,
  updateFormData,
} from './application.service.js';
import { listFilesByAppId } from './application.repository.js';

interface CreateDraftBody { procedureCode?: string }
interface UpdateFormDataBody { formData?: Record<string, unknown> }

export default async function applicationRoute(app: FastifyInstance) {
  app.post<{ Body: CreateDraftBody }>(
    '/applications',
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const { procedureCode } = request.body ?? {};
      if (!procedureCode) return reply.code(400).send({ error: 'Missing procedureCode' });
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

  app.patch<{ Params: { id: string }; Body: UpdateFormDataBody }>(
    '/applications/:id',
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const appId = Number(request.params.id);
      if (!Number.isInteger(appId) || appId <= 0) return reply.code(400).send({ error: 'Invalid id' });
      const { formData } = request.body ?? {};
      if (!formData || typeof formData !== 'object') return reply.code(400).send({ error: 'Missing formData' });
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

  app.post<{ Params: { id: string } }>(
    '/applications/:id/submit',
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const appId = Number(request.params.id);
      if (!Number.isInteger(appId) || appId <= 0) return reply.code(400).send({ error: 'Invalid id' });
      const updated = await submitDraft({ appId, citizenId: request.auth!.citizenId });
      if (!updated) return reply.code(409).send({ error: 'Not found, not owner, or already submitted' });
      return reply.send({ id: updated.id, statusId: updated.statusId, submittedAt: updated.submittedAt });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/applications/:id',
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const appId = Number(request.params.id);
      if (!Number.isInteger(appId) || appId <= 0) return reply.code(400).send({ error: 'Invalid id' });
      const ok = await softDeleteDraft({ appId, citizenId: request.auth!.citizenId });
      if (!ok) return reply.code(404).send({ error: 'Not found, already deleted, or cannot delete submitted application' });
      return reply.code(204).send();
    },
  );

  app.get('/applications/me', { preHandler: [app.requireAuth] }, async (request) => {
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
  });

  app.get('/applications/me/by-citizen', { preHandler: [app.requireAuth] }, async (request, reply) => {
    const citizenId = request.auth!.citizenId;
    if (!citizenId) return reply.send([]);
    return listByCitizen(citizenId);
  });

  app.get<{ Params: { id: string } }>(
    '/applications/:id/files',
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const appId = Number(request.params.id);
      if (!Number.isInteger(appId) || appId <= 0) return reply.code(400).send({ error: 'Invalid id' });
      const found = await findByIdWithOwnership(appId, request.auth!.sessionId, request.auth!.citizenId);
      if (!found) return reply.code(404).send({ error: 'Not found' });
      return listFilesByAppId(appId);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/applications/:id',
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const appId = Number(request.params.id);
      if (!Number.isInteger(appId) || appId <= 0) return reply.code(400).send({ error: 'Invalid id' });
      const found = await findByIdWithOwnership(appId, request.auth!.sessionId, request.auth!.citizenId);
      if (!found) return reply.code(404).send({ error: 'Not found' });
      return {
        id: found.id,
        trackingCode: found.trackingCode,
        procedureId: found.procedureId,
        procedureCode: found.procedureCode,
        procedureName: found.procedureName,
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
