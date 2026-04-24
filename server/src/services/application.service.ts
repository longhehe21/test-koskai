/**
 * Application service — quản lý hồ sơ (draft + submit).
 *
 * Trách nhiệm Phase 4:
 *  - createDraft: tạo row applications status 'draft' khi user bắt đầu flow.
 *  - getByTrackingCode: lookup hồ sơ theo mã tracking.
 *  - listBySession: list drafts trong session hiện tại (resume flow).
 *
 * Sau Phase 4 (Phase 5):
 *  - submitDraft: transition draft → submitted
 *  - sendToCa: forward BCA
 *  - updateFormData: patch form step-by-step
 */
import { randomBytes } from 'node:crypto';
import { and, eq, isNull, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  applications,
  procedureFormVersions,
  procedures,
  statuses,
} from '../db/schema.js';

export type Application = typeof applications.$inferSelect;

/**
 * Sinh tracking_code dạng `KA-{YYYYMMDD}-{6_HEX}` — 21 ký tự.
 * Unique qua constraint DB; collision cực hiếm (6 hex = 16M combos / ngày).
 */
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
  procedureCode: string;
}

/**
 * Tạo draft application — status 'draft', form_version = latest procedure version.
 * Idempotent theo {sessionId, procedureId}: nếu đã có draft cho cặp này, return existing.
 */
export async function createDraft(
  params: CreateDraftParams,
): Promise<Application> {
  // Lookup procedure + current form version
  const procRows = await db
    .select({
      id: procedures.id,
      currentVersion: procedures.currentFormVersion,
    })
    .from(procedures)
    .where(eq(procedures.code, params.procedureCode))
    .limit(1);

  const proc = procRows[0];
  if (!proc) {
    throw new Error(`Procedure not found: ${params.procedureCode}`);
  }

  // Verify form version exists
  const versionRows = await db
    .select({ version: procedureFormVersions.version })
    .from(procedureFormVersions)
    .where(
      and(
        eq(procedureFormVersions.procedureId, proc.id),
        eq(procedureFormVersions.version, proc.currentVersion),
      ),
    )
    .limit(1);
  if (!versionRows[0]) {
    throw new Error(
      `Form version ${proc.currentVersion} missing for procedure ${params.procedureCode}`,
    );
  }

  // Check existing active draft (cùng session + procedure, chưa deleted)
  const existing = await db
    .select()
    .from(applications)
    .where(
      and(
        eq(applications.sessionId, params.sessionId),
        eq(applications.procedureId, proc.id),
        isNull(applications.submittedAt),
        isNull(applications.deletedAt),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];

  // Lookup status 'draft'
  const draftStatus = await db
    .select({ id: statuses.id })
    .from(statuses)
    .where(eq(statuses.code, 'draft'))
    .limit(1);
  if (!draftStatus[0]) throw new Error("Status 'draft' not seeded");

  // 48h TTL theo CLAUDE.md
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

/**
 * Update form data (JSON) của draft — dùng cho "Lưu nháp".
 * Verify ownership qua sessionId hoặc citizenId (cho phép resume qua session khác).
 *
 * Demo: lưu plaintext jsonb. Production: encrypt qua identity_snapshots.
 */
export async function updateFormData(params: {
  appId: number;
  sessionId: number;
  citizenId: number | null;
  formData: Record<string, unknown>;
}): Promise<Application | null> {
  // Lookup theo id — verify ownership qua sessionId HOẶC citizenId để resume cross-session
  const existing = await db
    .select()
    .from(applications)
    .where(
      and(
        eq(applications.id, params.appId),
        isNull(applications.deletedAt),
      ),
    )
    .limit(1);
  const row = existing[0];
  if (!row) return null;

  // Verify ownership
  if (row.sessionId !== params.sessionId && row.citizenId !== params.citizenId) {
    return null;
  }

  // Chặn edit sau khi đã nộp — status phải là draft, chưa có submittedAt
  if (row.submittedAt) return null;
  const draftStatus = await db
    .select({ id: statuses.id })
    .from(statuses)
    .where(eq(statuses.code, 'draft'))
    .limit(1);
  if (!draftStatus[0] || row.statusId !== draftStatus[0].id) return null;

  const [updated] = await db
    .update(applications)
    .set({
      formDataJson: params.formData,
      formDataEncrypted: false, // đánh dấu đang plaintext (demo)
      updatedAt: new Date(),
    })
    .where(eq(applications.id, params.appId))
    .returning();

  return updated ?? null;
}

/**
 * Lookup application theo id — cho phép owner từ session hoặc cùng citizenId.
 * Dùng khi resume draft: user login lại ở session mới nhưng cùng citizen.
 */
export async function findByIdForCitizen(
  appId: number,
  citizenId: number | null,
): Promise<Application | null> {
  if (!citizenId) return null;
  const rows = await db
    .select()
    .from(applications)
    .where(
      and(
        eq(applications.id, appId),
        eq(applications.citizenId, citizenId),
        isNull(applications.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Lookup application theo id + verify ownership qua sessionId.
 * Return null nếu không tồn tại hoặc không phải của session.
 */
export async function findByIdForSession(
  appId: number,
  sessionId: number,
): Promise<Application | null> {
  const rows = await db
    .select()
    .from(applications)
    .where(
      and(
        eq(applications.id, appId),
        eq(applications.sessionId, sessionId),
        isNull(applications.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * List drafts của session hiện tại — để resume flow khi quay lại page.
 */
export async function listDraftsBySession(
  sessionId: number,
): Promise<Application[]> {
  return db
    .select()
    .from(applications)
    .where(
      and(
        eq(applications.sessionId, sessionId),
        isNull(applications.submittedAt),
        isNull(applications.deletedAt),
      ),
    )
    .orderBy(desc(applications.createdAt));
}

/**
 * Transition draft → submitted. Chỉ cho phép chủ hồ sơ (citizen trùng token),
 * trạng thái hiện tại phải là 'draft', và chưa bị xóa mềm.
 * Set submittedAt = now, statusId = 'submitted'.
 *
 * Return row cập nhật, hoặc null nếu không đủ điều kiện (không tồn tại /
 * đã nộp / không phải owner / đã xóa).
 */
export async function submitDraft(params: {
  appId: number;
  citizenId: number | null;
}): Promise<Application | null> {
  if (!params.citizenId) return null;

  // Lookup status 'submitted' id
  const submittedStatus = await db
    .select({ id: statuses.id })
    .from(statuses)
    .where(eq(statuses.code, 'submitted'))
    .limit(1);
  if (!submittedStatus[0]) {
    throw new Error("Status 'submitted' not seeded");
  }

  const draftStatus = await db
    .select({ id: statuses.id })
    .from(statuses)
    .where(eq(statuses.code, 'draft'))
    .limit(1);
  if (!draftStatus[0]) {
    throw new Error("Status 'draft' not seeded");
  }

  const now = new Date();
  const rows = await db
    .update(applications)
    .set({
      statusId: submittedStatus[0].id,
      submittedAt: now,
      updatedAt: now,
      draftExpiresAt: null, // không còn là draft → clear expiry
    })
    .where(
      and(
        eq(applications.id, params.appId),
        eq(applications.citizenId, params.citizenId),
        eq(applications.statusId, draftStatus[0].id),
        isNull(applications.submittedAt),
        isNull(applications.deletedAt),
      ),
    )
    .returning();

  return rows[0] ?? null;
}

/**
 * Soft-delete draft application — set deleted_at = now.
 * Chỉ xóa được draft của citizen, và KHÔNG cho phép xóa hồ sơ đã submit
 * (submittedAt != null) → draft cũ còn, nhưng phải giữ audit trail cho hồ sơ
 * đã nộp.
 *
 * Return: true nếu xóa thành công, false nếu không tìm thấy / không có quyền
 * / đã submit.
 */
export async function softDeleteDraft(params: {
  appId: number;
  citizenId: number | null;
}): Promise<boolean> {
  if (!params.citizenId) return false;
  // Only soft-delete drafts (submittedAt null) owned by this citizen.
  const rows = await db
    .update(applications)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(applications.id, params.appId),
        eq(applications.citizenId, params.citizenId),
        isNull(applications.submittedAt),
        isNull(applications.deletedAt),
      ),
    )
    .returning({ id: applications.id });
  return rows.length > 0;
}

/**
 * List tất cả applications (draft + submitted) của citizen — cho HoSoCuaToiPage.
 * Cross-session: user login lại vẫn thấy drafts cũ.
 */
export async function listByCitizen(
  citizenId: number,
): Promise<Application[]> {
  return db
    .select()
    .from(applications)
    .where(
      and(
        eq(applications.citizenId, citizenId),
        isNull(applications.deletedAt),
      ),
    )
    .orderBy(desc(applications.createdAt));
}
