/**
 * Public tracking route — KHÔNG auth, cho web tracker (QR scan từ mobile).
 *
 *  GET /public/tracking/:code
 *    - Lookup application theo trackingCode (không để đoán ID)
 *    - Return: procedureName, status, submittedAt, dự kiến trả, timeline
 *    - KHÔNG return PII (tên, CCCD, địa chỉ, SĐT, email, formData)
 *
 * Rate-limit: strict hơn default để chống scrape (10 req/phút/IP).
 */
import type { FastifyInstance } from 'fastify';
import { and, eq, isNull, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  applicationStatusLogs,
  applications,
  procedures,
  statuses,
} from '../db/schema.js';

export default async function publicRoute(app: FastifyInstance) {
  app.get<{ Params: { code: string } }>(
    '/public/tracking/:code',
    {
      // Tăng rate-limit chặt — public endpoint dễ bị scrape.
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const code = request.params.code?.trim();
      // Tracking code format: KA-YYYYMMDD-XXXXXX (21 ký tự) — validate sơ để
      // tránh truy vấn với input lộn xộn.
      if (!code || code.length < 5 || code.length > 50) {
        return reply.code(400).send({ error: 'Invalid tracking code' });
      }

      const rows = await db
        .select({
          id: applications.id,
          trackingCode: applications.trackingCode,
          procedureId: applications.procedureId,
          statusId: applications.statusId,
          createdAt: applications.createdAt,
          submittedAt: applications.submittedAt,
          updatedAt: applications.updatedAt,
          formDataJson: applications.formDataJson,
        })
        .from(applications)
        .where(
          and(
            eq(applications.trackingCode, code),
            isNull(applications.deletedAt),
          ),
        )
        .limit(1);

      const appRow = rows[0];
      if (!appRow) return reply.code(404).send({ error: 'Not found' });

      // Lookup procedure + status tên hiển thị
      const procRow = await db
        .select({
          code: procedures.code,
          name: procedures.name,
          processingDays: procedures.processingDays,
        })
        .from(procedures)
        .where(eq(procedures.id, appRow.procedureId))
        .limit(1);
      const statusRow = await db
        .select({ code: statuses.code, name: statuses.name, color: statuses.color })
        .from(statuses)
        .where(eq(statuses.id, appRow.statusId))
        .limit(1);

      // Timeline: log đổi status theo thứ tự thời gian — join status tên.
      const logs = await db
        .select({
          id: applicationStatusLogs.id,
          toStatusId: applicationStatusLogs.toStatusId,
          reasonNote: applicationStatusLogs.reasonNote,
          changedAt: applicationStatusLogs.changedAt,
        })
        .from(applicationStatusLogs)
        .where(eq(applicationStatusLogs.applicationId, appRow.id))
        .orderBy(asc(applicationStatusLogs.changedAt));

      // Enrich logs với tên status. Có thể batch join nhưng data nhỏ nên ok query trong loop.
      const allStatuses = await db
        .select({ id: statuses.id, code: statuses.code, name: statuses.name })
        .from(statuses);
      const statusMap = new Map(allStatuses.map((s) => [s.id, s]));

      const timeline = logs.map((log) => {
        const s = statusMap.get(log.toStatusId);
        return {
          statusCode: s?.code ?? '',
          statusName: s?.name ?? '',
          note: log.reasonNote,
          changedAt: log.changedAt,
        };
      });

      // Nếu chưa có log (vd trước khi migrate status-log) → fallback 1 event
      // từ submittedAt cho timeline không rỗng.
      if (timeline.length === 0 && appRow.submittedAt) {
        timeline.push({
          statusCode: statusRow[0]?.code ?? '',
          statusName: statusRow[0]?.name ?? '',
          note: null,
          changedAt: appRow.submittedAt,
        });
      }

      // Extract cơ quan xử lý từ formDataJson.section1.coquan.name
      // (KHÔNG phải PII — chỉ là tên đơn vị hành chính công, VD "Công an Phường Ba Đình")
      const formData = (appRow.formDataJson ?? {}) as {
        section1?: { coquan?: { name?: string } | null };
      };
      const agencyName = formData.section1?.coquan?.name ?? null;

      // Dự kiến trả = submittedAt + processingDays (nếu đã submit + có cấu hình)
      const processingDays = procRow[0]?.processingDays ?? null;
      let expectedResultDate: string | null = null;
      if (appRow.submittedAt && processingDays) {
        const d = new Date(appRow.submittedAt);
        d.setDate(d.getDate() + processingDays);
        expectedResultDate = d.toISOString();
      }

      return reply.send({
        trackingCode: appRow.trackingCode,
        procedureCode: procRow[0]?.code ?? '',
        procedureName: procRow[0]?.name ?? '',
        statusCode: statusRow[0]?.code ?? '',
        statusName: statusRow[0]?.name ?? '',
        statusColor: statusRow[0]?.color ?? '',
        agencyName,
        processingDays,
        expectedResultDate,
        createdAt: appRow.createdAt,
        submittedAt: appRow.submittedAt,
        updatedAt: appRow.updatedAt,
        timeline,
      });
    },
  );
}
