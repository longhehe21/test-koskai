import { randomBytes } from 'node:crypto';
import { and, eq, isNull, desc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { applications, procedureFormVersions, procedures, statuses } from '../../db/schema.js';

export interface ApplicationWithDetails {
  id: number;
  trackingCode: string;
  procedureId: number;
  procedureCode: string | null;
  procedureName: string | null;
  statusId: number;
  statusCode: string | null;
  statusName: string | null;
  statusColor: string | null;
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date | null;
  draftExpiresAt: Date | null;
}

export interface ApplicationDetail {
  id: number;
  sessionId: number;
  citizenId: number | null;
  procedureId: number;
  formVersion: number;
  trackingCode: string;
  statusId: number;
  formDataEncrypted: boolean;
  formDataJson: unknown;
  submittedAt: Date | null;
  draftExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  procedureCode: string | null;
  procedureName: string | null;
}

export type Application = typeof applications.$inferSelect;

function generateTrackingCode(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return `KA-${yyyy}${mm}${dd}-${rand}`;
}

export interface CreateDraftParams {
  sessionId: number;
  citizenId: number | null;
  procedureCode: string | null;
}

export async function createDraft(params: CreateDraftParams): Promise<Application> {
  const procRows = await db
    .select({ id: procedures.id, currentVersion: procedures.currentFormVersion })
    .from(procedures)
    .where(eq(procedures.code, params.procedureCode ?? ''))
    .limit(1);
  const proc = procRows[0];
  if (!proc) throw new Error(`Procedure not found: ${params.procedureCode}`);

  const versionRows = await db
    .select({ version: procedureFormVersions.version })
    .from(procedureFormVersions)
    .where(and(eq(procedureFormVersions.procedureId, proc.id), eq(procedureFormVersions.version, proc.currentVersion)))
    .limit(1);
  if (!versionRows[0]) throw new Error(`Form version ${proc.currentVersion} missing for procedure ${params.procedureCode}`);

  const existing = await db
    .select()
    .from(applications)
    .where(and(eq(applications.sessionId, params.sessionId), eq(applications.procedureId, proc.id), isNull(applications.submittedAt), isNull(applications.deletedAt)))
    .limit(1);
  if (existing[0]) return existing[0];

  const draftStatus = await db.select({ id: statuses.id }).from(statuses).where(eq(statuses.code, 'draft')).limit(1);
  if (!draftStatus[0]) throw new Error("Status 'draft' not seeded");

  const draftExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const [inserted] = await db
    .insert(applications)
    .values({
      sessionId: params.sessionId,
      procedureId: proc.id,
      formVersion: proc.currentVersion,
      citizenId: params.citizenId,
      trackingCode: generateTrackingCode(),
      statusId: draftStatus[0].id,
      formDataEncrypted: true,
      draftExpiresAt: draftExpires,
    })
    .returning();
  if (!inserted) throw new Error('createDraft: insert failed');
  return inserted;
}

export async function updateFormData(params: {
  appId: number;
  sessionId: number;
  citizenId: number | null;
  formData: Record<string, unknown>;
}): Promise<Application | null> {
  const existing = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, params.appId), isNull(applications.deletedAt)))
    .limit(1);
  const row = existing[0];
  if (!row) return null;
  if (row.sessionId !== params.sessionId && row.citizenId !== params.citizenId) return null;
  if (row.submittedAt) return null;

  const [draftStatusRow] = await db.select({ id: statuses.id }).from(statuses).where(eq(statuses.code, 'draft')).limit(1);
  if (!draftStatusRow || row.statusId !== draftStatusRow.id) return null;

  const [updated] = await db
    .update(applications)
    .set({ formDataJson: params.formData, formDataEncrypted: false, updatedAt: new Date() })
    .where(eq(applications.id, params.appId))
    .returning();
  return updated ?? null;
}

export async function findByIdForCitizen(appId: number, citizenId: number | null): Promise<Application | null> {
  if (!citizenId) return null;
  const rows = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, appId), eq(applications.citizenId, citizenId), isNull(applications.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findByIdForSession(appId: number, sessionId: number): Promise<Application | null> {
  const rows = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, appId), eq(applications.sessionId, sessionId), isNull(applications.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listDraftsBySession(sessionId: number): Promise<Application[]> {
  return db
    .select()
    .from(applications)
    .where(and(eq(applications.sessionId, sessionId), isNull(applications.submittedAt), isNull(applications.deletedAt)))
    .orderBy(desc(applications.createdAt));
}

export async function submitDraft(params: { appId: number; citizenId: number | null }): Promise<Application | null> {
  if (!params.citizenId) return null;
  const [submittedRows, draftRows] = await Promise.all([
    db.select({ id: statuses.id }).from(statuses).where(eq(statuses.code, 'submitted')).limit(1),
    db.select({ id: statuses.id }).from(statuses).where(eq(statuses.code, 'draft')).limit(1),
  ]);
  if (!submittedRows[0]) throw new Error("Status 'submitted' not seeded");
  if (!draftRows[0]) throw new Error("Status 'draft' not seeded");

  const now = new Date();
  const rows = await db
    .update(applications)
    .set({ statusId: submittedRows[0].id, submittedAt: now, updatedAt: now, draftExpiresAt: null })
    .where(and(eq(applications.id, params.appId), eq(applications.citizenId, params.citizenId), eq(applications.statusId, draftRows[0].id), isNull(applications.submittedAt), isNull(applications.deletedAt)))
    .returning();
  return rows[0] ?? null;
}

export async function softDeleteDraft(params: { appId: number; citizenId: number | null }): Promise<boolean> {
  if (!params.citizenId) return false;
  const rows = await db
    .update(applications)
    .set({ deletedAt: new Date() })
    .where(and(eq(applications.id, params.appId), eq(applications.citizenId, params.citizenId), isNull(applications.submittedAt), isNull(applications.deletedAt)))
    .returning({ id: applications.id });
  return rows.length > 0;
}

export async function listByCitizen(citizenId: number): Promise<ApplicationWithDetails[]> {
  return db
    .select({
      id: applications.id,
      trackingCode: applications.trackingCode,
      procedureId: applications.procedureId,
      procedureCode: procedures.code,
      procedureName: procedures.name,
      statusId: applications.statusId,
      statusCode: statuses.code,
      statusName: statuses.name,
      statusColor: statuses.color,
      createdAt: applications.createdAt,
      updatedAt: applications.updatedAt,
      submittedAt: applications.submittedAt,
      draftExpiresAt: applications.draftExpiresAt,
    })
    .from(applications)
    .leftJoin(procedures, eq(procedures.id, applications.procedureId))
    .leftJoin(statuses, eq(statuses.id, applications.statusId))
    .where(and(eq(applications.citizenId, citizenId), isNull(applications.deletedAt)))
    .orderBy(desc(applications.createdAt));
}

export async function findByIdWithOwnership(
  appId: number,
  sessionId: number,
  citizenId: number | null,
): Promise<ApplicationDetail | null> {
  const rows = await db
    .select({
      id: applications.id,
      sessionId: applications.sessionId,
      citizenId: applications.citizenId,
      procedureId: applications.procedureId,
      formVersion: applications.formVersion,
      trackingCode: applications.trackingCode,
      statusId: applications.statusId,
      formDataEncrypted: applications.formDataEncrypted,
      formDataJson: applications.formDataJson,
      submittedAt: applications.submittedAt,
      draftExpiresAt: applications.draftExpiresAt,
      createdAt: applications.createdAt,
      updatedAt: applications.updatedAt,
      procedureCode: procedures.code,
      procedureName: procedures.name,
    })
    .from(applications)
    .leftJoin(procedures, eq(procedures.id, applications.procedureId))
    .where(and(eq(applications.id, appId), isNull(applications.deletedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.sessionId !== sessionId && row.citizenId !== citizenId) return null;
  return row as ApplicationDetail;
}
