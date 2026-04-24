/**
 * useDraftLifecycle — tập trung logic lưu/nộp/resume cho các trang tạo hồ sơ.
 *
 * Trang dùng hook này phải cung cấp `procedureCode` + `buildFormData` callback.
 * Hook trả về state + handlers sẵn sàng wire vào FormFooter + modals.
 *
 * Responsibility:
 *  - persistDraftSilent: save form + upload scans, trả về appId. KHÔNG toast.
 *  - handleSaveDraft: persist + show DraftSavedToast
 *  - handleConfirmSubmit: persist + submit API + clear cache + navigate success
 *  - Quản lý state showDraft + draftTrackingCode + isDirty reset
 */
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDraftFormStore, type DraftForm } from '@store/draftFormStore';
import { useScanStore } from '@store/scanStore';
import {
  createOrUpdateDraft,
  submitApplication,
} from '@services/applicationService';
import { useScanUpload } from './useScanUpload';
import { sound } from '@services/soundService';

interface UseDraftLifecycleParams {
  procedureCode: string;
  /** Collect state thành JSON để gửi lên server. Gọi mỗi lần save/submit. */
  buildFormData: () => DraftForm;
  /**
   * Optional: clear thêm state ngoài cache khi submit thành công (VD hoKhauFlowStore).
   * Mặc định chỉ clear draftFormStore[procedureCode] + scanStore flowKey.
   */
  onClearAfterSubmit?: () => void;
}

export function useDraftLifecycle(params: UseDraftLifecycleParams) {
  const { procedureCode, buildFormData, onClearAfterSubmit } = params;
  const navigate = useNavigate();
  const { upload: uploadScan } = useScanUpload();
  const setAppId = useDraftFormStore((s) => s.setAppId);
  const getAppId = useDraftFormStore((s) => s.getAppId);
  const setForm = useDraftFormStore((s) => s.setForm);

  const [showDraft, setShowDraft] = useState(false);
  const [draftTrackingCode, setDraftTrackingCode] = useState<string | null>(null);

  /**
   * Upload các ảnh scan chưa synced của procedure này. Skip docs có fileId
   * (đã upload). Lỗi từng file log warning, không throw — save formData vẫn thành công.
   */
  const uploadPendingScans = useCallback(
    async (appId: number): Promise<void> => {
      const allDocs = useScanStore.getState().docs;
      const prefix = `${procedureCode}:`;
      const pending = Object.entries(allDocs).filter(
        ([k, d]) => k.startsWith(prefix) && !d.fileId && d.uploadState !== 'synced',
      );
      await Promise.all(
        pending.map(async ([key, doc]) => {
          const docCode = key.slice(prefix.length);
          try {
            await uploadScan({
              flowKey: procedureCode,
              docCode,
              applicationId: appId,
              dataUrl: doc.dataUrl,
            });
          } catch (err) {
            console.warn(`[${procedureCode}] upload scan fail`, docCode, (err as Error).message);
          }
        }),
      );
    },
    [procedureCode, uploadScan],
  );

  /** Core save: persist formData + upload scans. KHÔNG toast — caller tự quyết. */
  const persistDraftSilent = useCallback(async (): Promise<number | null> => {
    const formData = buildFormData();
    setForm(procedureCode, formData);
    const existingAppId = getAppId(procedureCode);
    const { appId, trackingCode } = await createOrUpdateDraft(
      procedureCode,
      formData,
      existingAppId,
    );
    setAppId(procedureCode, appId);
    await uploadPendingScans(appId);
    setDraftTrackingCode(trackingCode || null);
    return appId;
  }, [buildFormData, procedureCode, setForm, getAppId, setAppId, uploadPendingScans]);

  /** Nút "Lưu nháp" trong FormFooter → persist + show toast. */
  const handleSaveDraft = useCallback(async () => {
    try {
      await persistDraftSilent();
      setShowDraft(true);
    } catch (err) {
      console.warn(`[${procedureCode}] save draft fail:`, (err as Error).message);
      setDraftTrackingCode(null);
      setShowDraft(true);
    }
  }, [persistDraftSilent, procedureCode]);

  /**
   * Nút "Nộp hồ sơ" sau modal xác nhận → persist + submit API + clear + navigate.
   * Fallback navigate khi lỗi để user không kẹt.
   */
  const handleConfirmSubmit = useCallback(async () => {
    let submittedAppId: number | null = null;
    try {
      const appId = await persistDraftSilent();
      if (appId) {
        await submitApplication(appId);
        submittedAppId = appId;
        // Clear cache thủ tục này → lần sau user tạo hồ sơ mới sẽ fresh (tránh
        // PATCH stale appId đã submit → 404).
        useDraftFormStore.getState().clearProcedure(procedureCode);
        useScanStore.getState().clearFlow(procedureCode);
        onClearAfterSubmit?.();
      }
    } catch (err) {
      console.warn(`[${procedureCode}] submit fail:`, (err as Error).message);
    }
    sound.success();
    navigate(
      submittedAppId
        ? `/nop-ho-so-thanh-cong?appId=${submittedAppId}`
        : '/nop-ho-so-thanh-cong',
    );
  }, [persistDraftSilent, procedureCode, navigate, onClearAfterSubmit]);

  return {
    // State — wire vào DraftSavedToast
    showDraft,
    setShowDraft,
    draftTrackingCode,
    // Handlers — wire vào FormFooter + ConfirmSubmitModal + SubmitBlockedModal
    persistDraftSilent,
    handleSaveDraft,
    handleConfirmSubmit,
  };
}
