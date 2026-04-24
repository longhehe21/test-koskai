/**
 * Application service — wrapper các API /applications/* cho FE.
 * Dùng bởi các page TaoHoSo* (lưu nháp) + HoSoCuaToiPage (list).
 */
import { api, ApiError } from './api';
import type { DraftForm } from '@store/draftFormStore';

export interface DraftSummary {
  id: number;
  trackingCode: string;
  procedureId: number;
  procedureCode: string;
  procedureName: string;
  statusId: number;
  statusCode: string;
  statusName: string;
  statusColor: string;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  draftExpiresAt: string | null;
}

export interface DraftDetail {
  id: number;
  trackingCode: string;
  procedureId: number;
  procedureCode: string;
  procedureName: string;
  statusId: number;
  formVersion: number;
  formDataJson: DraftForm | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  draftExpiresAt: string | null;
}

interface CreateDraftResponse {
  id: number;
  trackingCode: string;
  procedureId: number;
  formVersion: number;
  draftExpiresAt: string | null;
}

/** POST /applications — tạo draft */
export async function createDraft(procedureCode: string): Promise<CreateDraftResponse> {
  return api.post<CreateDraftResponse>('/applications', { procedureCode });
}

/** PATCH /applications/:id — cập nhật formDataJson */
export async function saveFormData(
  appId: number,
  formData: DraftForm,
): Promise<{ id: number; updatedAt: string }> {
  return api.patch<{ id: number; updatedAt: string }>(
    `/applications/${appId}`,
    { formData },
  );
}

/** GET /applications/:id — detail + formDataJson để resume */
export async function getApplication(appId: number): Promise<DraftDetail> {
  return api.get<DraftDetail>(`/applications/${appId}`);
}

/** GET /applications/me/by-citizen — tất cả applications của citizen (cross-session) */
export async function listMyApplications(): Promise<DraftSummary[]> {
  return api.get<DraftSummary[]>('/applications/me/by-citizen');
}

/**
 * DELETE /applications/:id — soft-delete draft. Server chặn xóa hồ sơ đã
 * submit (trả 404). Return void on success.
 */
export async function deleteApplication(appId: number): Promise<void> {
  await api.delete<void>(`/applications/${appId}`);
}

interface SubmitResponse {
  id: number;
  statusId: number;
  submittedAt: string;
}

/**
 * POST /applications/:id/submit — chuyển status draft → submitted.
 * Server trả 409 nếu hồ sơ đã submit hoặc không phải draft của citizen.
 */
export async function submitApplication(appId: number): Promise<SubmitResponse> {
  return api.post<SubmitResponse>(`/applications/${appId}/submit`);
}

export interface ApplicationFile {
  id: number;
  documentCode: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
}

/**
 * GET /applications/:id/files — list ảnh đã upload trong hồ sơ. Dùng cho
 * resume: FE fetch blob từng file để hydrate scanStore.
 */
export async function listApplicationFiles(appId: number): Promise<ApplicationFile[]> {
  return api.get<ApplicationFile[]>(`/applications/${appId}/files`);
}

/** Convert Blob → dataURL cho img src + scanStore.dataUrl. */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error ?? new Error('FileReader failed'));
    fr.readAsDataURL(blob);
  });
}

/**
 * GET /documents/:id — download decrypted blob + convert sang dataURL.
 * Server tự verify ownership qua sessionId hoặc citizenId trong Bearer token.
 */
export async function fetchDocumentDataUrl(fileId: number): Promise<string> {
  const blob = await api.get<Blob>(`/documents/${fileId}`);
  return blobToDataUrl(blob);
}

/**
 * Parse docCode lưu trên server thành {baseCode, scannedAt} để reconstruct
 * scanStore entry. ScanTaiLieuPage gen docCode = `${baseCode}-${Date.now()}`
 * nên timestamp là ms epoch.
 */
function parseDocCode(docCode: string): { baseCode: string; scannedAt: string } {
  const m = /^(.+)-(\d{10,15})$/.exec(docCode);
  if (m) return { baseCode: m[1], scannedAt: new Date(Number(m[2])).toISOString() };
  return { baseCode: docCode, scannedAt: new Date().toISOString() };
}

/**
 * Resume helper: fetch tất cả ảnh đã upload cho appId + hydrate vào scanStore
 * dưới key `${flowKey}:${docCode}`. Các doc đã ở store giữ nguyên (upload
 * state = 'synced' khi đã có fileId).
 *
 * matchName bị mất sau resume (server không lưu) — UI fallback hiển thị
 * baseCode. User có thể rescan để refresh metadata.
 */
export async function hydrateScansFromServer(
  appId: number,
  flowKey: string,
  saveDoc: (
    flowKey: string,
    docCode: string,
    doc: {
      dataUrl: string;
      matchScore: number;
      matchCode: string;
      matchName: string;
      scannedAt: string;
      uploadState: 'synced';
      fileId: number;
    },
  ) => void,
): Promise<void> {
  const files = await listApplicationFiles(appId);
  await Promise.all(
    files.map(async (f) => {
      try {
        const dataUrl = await fetchDocumentDataUrl(f.id);
        const { baseCode, scannedAt } = parseDocCode(f.documentCode);
        saveDoc(flowKey, f.documentCode, {
          dataUrl,
          matchScore: 1,
          matchCode: baseCode,
          matchName: baseCode,
          scannedAt,
          uploadState: 'synced',
          fileId: f.id,
        });
      } catch (err) {
        console.warn('[hydrateScans] fetch file fail', f.id, (err as Error).message);
      }
    }),
  );
}

/**
 * Helper: tạo-hoặc-update draft.
 *  - Nếu chưa có appId → POST create + PATCH form
 *  - Nếu đã có → PATCH; nếu PATCH trả 404 (appId stale — đã submit / bị xóa /
 *    không còn là draft) → fallback tạo draft mới rồi PATCH lại.
 * Trả về {appId, trackingCode}.
 */
export async function createOrUpdateDraft(
  procedureCode: string,
  formData: DraftForm,
  existingAppId: number | null,
): Promise<{ appId: number; trackingCode: string }> {
  const createNew = async (): Promise<{ appId: number; trackingCode: string }> => {
    const created = await createDraft(procedureCode);
    await saveFormData(created.id, formData);
    return { appId: created.id, trackingCode: created.trackingCode };
  };

  if (!existingAppId) {
    return createNew();
  }

  try {
    // Load existing để lấy trackingCode — nếu 404 → stale, create fresh
    const detail = await getApplication(existingAppId);
    await saveFormData(existingAppId, formData);
    return { appId: existingAppId, trackingCode: detail.trackingCode };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return createNew();
    }
    throw err;
  }
}
